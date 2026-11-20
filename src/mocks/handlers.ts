import { delay, http, HttpResponse, type AnyHandler } from 'msw'
import type { components } from '../api/generated/schema'
import { adminHandlers } from './adminData'
import { buildLessonDetail, LESSON_MOCK, recordFlush } from './lessonData'
import { buildHome, buildLessons, STUDENT_MOCK } from './studentData'
import { systemHandlers } from './systemData'
import { teacherHandlers } from './teacherData'
import { buildWords, recordWordStudy } from './wordData'

// dev:mock·테스트용 목 응답. 경로·본문은 openapi 생성 타입을 따른다(백엔드 PR #10 기준 문구·오류 code).
// 인증 목은 로그인 상태를 메모리에 들고 있다 — 새로 고침하면 로그아웃 상태(S-02 확인용)

type Schemas = components['schemas']
type MockUser = Schemas['UserInfo']
type MockRole = MockUser['role']

/** 화면 확인·테스트에 쓰는 값 */
export const AUTH_MOCK = {
  joinCode: 'G7KM2XP4',
  personalCode: '3817',
  /** 올바른 가입 코드와 함께면 423 LOCKED */
  lockedPersonalCode: '0000',
  /** 이 가입 코드는 verify 429(until 없음 — 드문 경우) */
  rateLimitedJoinCode: 'ZZZZZZZZ',
  /**
   * 한도 창(BE #57): 이 가입 코드를 확인하거나 이 개인 코드로 로그인하면 limitMs 동안 반 확인·학생 로그인이
   * 코드와 무관하게 429 + until. 창은 값마다 한 번만 열린다 — 풀린 뒤 이 가입 코드는 목 반의 코드처럼 통한다
   */
  limitedJoinCode: 'WAIT2222',
  limitedPersonalCode: '4290',
  limitMs: 20_000,
  /** 교사·관리자 비밀번호(백엔드 local 시드와 같은 값) */
  staffPassword: 'local-teacher-1234',
  /** 이 아이디는 423 LOCKED(교사 비밀번호 5회 실패) */
  lockedLoginId: 'locked01',
  className: '겨울 그린 A반',
  academyName: 'JEY 어학원',
  /** 백엔드 LOCKED의 고정 문구 */
  lockedTitle: '잠시 후 다시 시도해 주세요',
  lockedDetail: '잠시 쉬었다가 다시 시도해 주세요',
  /** 잠금 해제 시각(UTC) = 한국 시간 2026-11-11 오후 3시 42분 */
  lockedUntil: '2026-11-11T06:42:00Z',
} as const

const STUDENT: MockUser = { id: 301, name: '김민준', role: 'student' }
const STAFF: Record<string, MockUser> = {
  teacher01: { id: 21, name: '이선생', role: 'teacher' },
  admin01: { id: 11, name: '박원장', role: 'admin' },
  super01: { id: 1, name: '운영자', role: 'superadmin' },
}

const MOCK_ACADEMY_ID = 1

let session: MockUser | null = null
/** 한도 창이 풀리는 시각(epoch ms)과 이미 창을 연 값 */
let limitedUntil = 0
const limitOpened = new Set<string>()

export function resetAuthMock() {
  session = null
  limitedUntil = 0
  limitOpened.clear()
}

function openLimitOnce(trigger: string) {
  if (limitOpened.has(trigger)) return
  limitOpened.add(trigger)
  limitedUntil = Date.now() + AUTH_MOCK.limitMs
}

/** 한도 창이 열려 있으면 429 + until, 아니면 undefined */
function limited(request: Request) {
  if (Date.now() >= limitedUntil) return undefined
  return problem(request, 429, 'RATE_LIMITED', '잠시 후 다시 시도해 주세요', {
    detail: '잠시 후 다시 시도해 주세요',
    until: new Date(limitedUntil).toISOString(),
  })
}

const isClassCode = (code: unknown) =>
  code === AUTH_MOCK.joinCode || code === AUTH_MOCK.limitedJoinCode

/** 테스트에서 로그인한 상태로 시작할 때 */
export function setMockSession(role: MockRole) {
  const staff = { teacher: STAFF.teacher01, admin: STAFF.admin01, superadmin: STAFF.super01 }
  session = role === 'student' ? STUDENT : staff[role]
}

function problem(
  request: Request,
  status: number,
  code: string,
  title: string,
  extra: Record<string, unknown> = {},
) {
  return HttpResponse.json(
    {
      type: `/problems/${code.toLowerCase().replace(/_/g, '-')}`,
      title,
      status,
      instance: new URL(request.url).pathname,
      code,
      requestId: '0000000000000000',
      ...extra,
    },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => ({}))
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
}

const authHandlers: AnyHandler[] = [
  http.post('*/api/v1/auth/code/verify', async ({ request }) => {
    await delay()
    const { code } = await readJson(request)
    if (code === AUTH_MOCK.rateLimitedJoinCode) {
      return problem(request, 429, 'RATE_LIMITED', '잠시 후 다시 시도해 주세요', {
        detail: '1분 뒤에 다시 시도해 주세요',
      })
    }
    if (code === AUTH_MOCK.limitedJoinCode) openLimitOnce('join')
    const blocked = limited(request)
    if (blocked) return blocked
    if (!isClassCode(code)) {
      return problem(request, 404, 'INVALID_CODE', '가입 코드를 찾을 수 없어요')
    }
    return HttpResponse.json<Schemas['CodeVerifyResponse']>({
      class: {
        id: 12,
        name: AUTH_MOCK.className,
        academyName: AUTH_MOCK.academyName,
        // 학생 목과 같은 레벨(dev:mock `?level=` 스위치가 바꾼다 — 들어가기 화면 다섯 레벨 확인용, 기본 L2)
        level: { ...STUDENT_MOCK.level },
        book: { code: 'L2-B1', season: '겨울' },
      },
    })
  }),

  http.post('*/api/v1/auth/student/login', async ({ request }) => {
    await delay()
    const { code, personalCode } = await readJson(request)
    if (personalCode === AUTH_MOCK.limitedPersonalCode) openLimitOnce('pin')
    const blocked = limited(request)
    if (blocked) return blocked
    if (code === AUTH_MOCK.joinCode && personalCode === AUTH_MOCK.lockedPersonalCode) {
      return problem(request, 423, 'LOCKED', AUTH_MOCK.lockedTitle, {
        detail: AUTH_MOCK.lockedDetail,
        until: AUTH_MOCK.lockedUntil,
      })
    }
    if (!isClassCode(code) || personalCode !== AUTH_MOCK.personalCode) {
      return problem(request, 401, 'INVALID_CREDENTIALS', '가입 코드 또는 개인 코드가 맞지 않아요')
    }
    session = STUDENT
    return HttpResponse.json<Schemas['StudentLoginResponse']>({
      user: STUDENT,
      class: { id: 12, name: AUTH_MOCK.className },
    })
  }),

  // 백엔드 AUTH-04: 아이디는 대소문자 구분 없음·앞뒤 공백 정리, 없는 아이디·틀린 비밀번호는 같은 401
  http.post('*/api/v1/auth/staff/login', async ({ request }) => {
    await delay()
    const body = await readJson(request)
    const loginId = typeof body.loginId === 'string' ? body.loginId.trim().toLowerCase() : ''
    if (loginId === AUTH_MOCK.lockedLoginId) {
      return problem(request, 423, 'LOCKED', AUTH_MOCK.lockedTitle, {
        detail: AUTH_MOCK.lockedDetail,
        until: AUTH_MOCK.lockedUntil,
      })
    }
    const user = STAFF[loginId]
    // 교사 로그인 응답은 교사·관리자·운영자(StaffUserInfo). 운영자는 학원이 없어 academyId null(BE #48)
    if (
      user === undefined ||
      user.role === 'student' ||
      body.password !== AUTH_MOCK.staffPassword
    ) {
      return problem(request, 401, 'INVALID_CREDENTIALS', '입력한 정보가 맞지 않아요')
    }
    session = user
    return HttpResponse.json<Schemas['StaffLoginResponse']>({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        academyId: user.role === 'superadmin' ? null : MOCK_ACADEMY_ID,
      },
    })
  }),

  // 실제 백엔드는 200 + /me와 같은 본문(쿠키 회전)
  http.post('*/api/v1/auth/refresh', ({ request }) =>
    session
      ? HttpResponse.json(me(session))
      : problem(request, 401, 'UNAUTHORIZED', '다시 들어와 주세요'),
  ),

  http.post('*/api/v1/auth/logout', () => {
    session = null
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('*/api/v1/me', async ({ request }) => {
    await delay()
    if (!session) return problem(request, 401, 'UNAUTHORIZED', '다시 들어와 주세요')
    return HttpResponse.json(me(session))
  }),
]

// 운영자(superadmin)는 학원이 없다 — /me·refresh의 academy null(BE #48)
function me(user: MockUser): Schemas['MeResponse'] {
  if (user.role === 'superadmin') return { ...user, academy: null }
  return { ...user, academy: { id: MOCK_ACADEMY_ID, name: AUTH_MOCK.academyName } }
}

// 학생 API(03 §2) — 학생 세션이 없으면 401(교사는 403)
function studentOnly(request: Request) {
  if (!session) return problem(request, 401, 'UNAUTHORIZED', '다시 들어와 주세요')
  if (session.role !== 'student')
    return problem(request, 403, 'FORBIDDEN', '이 화면을 볼 수 없어요')
  return undefined
}

const studentHandlers: AnyHandler[] = [
  http.get('*/api/v1/student/home', async ({ request }) => {
    await delay()
    return studentOnly(request) ?? HttpResponse.json(buildHome())
  }),

  http.get('*/api/v1/student/classes/:classId/lessons', async ({ request, params }) => {
    await delay()
    const denied = studentOnly(request)
    if (denied) return denied
    if (Number(params.classId) !== STUDENT_MOCK.classId) {
      return problem(request, 403, 'FORBIDDEN', '이 반을 볼 수 없어요')
    }
    return HttpResponse.json(buildLessons())
  }),

  // S-05 회차 상세(03 §2.3) — 목은 L2-B1-01~05만 열려 있다
  http.get('*/api/v1/student/lessons/:code', async ({ request, params }) => {
    await delay()
    const denied = studentOnly(request)
    if (denied) return denied
    const code = String(params.code)
    if (!/^L2-B1-\d{2}$/.test(code))
      return problem(request, 404, 'NOT_FOUND', '회차를 찾을 수 없어요')
    if (!LESSON_MOCK.openCodes.includes(code as (typeof LESSON_MOCK.openCodes)[number])) {
      return problem(request, 423, 'LESSON_LOCKED', '아직 열리지 않은 회차예요', {
        detail: '수업 날이 되면 열려요',
      })
    }
    return HttpResponse.json(buildLessonDetail(code))
  }),

  // S-06·S-06b 단어(03 §2.4) — 회차 상세와 같은 잠금
  http.get('*/api/v1/student/lessons/:code/words', async ({ request, params }) => {
    await delay()
    const denied = studentOnly(request)
    if (denied) return denied
    const code = String(params.code)
    if (!LESSON_MOCK.openCodes.includes(code as (typeof LESSON_MOCK.openCodes)[number])) {
      return problem(request, 423, 'LESSON_LOCKED', '아직 열리지 않은 회차예요', {
        detail: '수업 날이 되면 열려요',
      })
    }
    return HttpResponse.json(buildWords())
  }),

  // 카드·학습 결과 저장(2.5) — 모든 값 단조 증가
  http.put('*/api/v1/student/lessons/:code/word-study', async ({ request }) => {
    const denied = studentOnly(request)
    if (denied) return denied
    return HttpResponse.json(recordWordStudy(await readJson(request)))
  }),

  // 청취 flush(3.1) — fetch(application/json)와 sendBeacon(text/plain, 바디 csrf) 둘 다
  http.post('*/api/v1/listening/flush', async ({ request }) => {
    const denied = studentOnly(request)
    if (denied) return denied
    let body: unknown
    try {
      body = JSON.parse(await request.text())
    } catch {
      return problem(request, 400, 'VALIDATION', '요청 형식이 맞지 않아요')
    }
    const result = recordFlush(body as Parameters<typeof recordFlush>[0])
    return result === undefined
      ? problem(request, 400, 'VALIDATION', '트랙을 찾을 수 없어요')
      : HttpResponse.json(result)
  }),
]

export const handlers: AnyHandler[] = [
  ...authHandlers,
  ...studentHandlers,
  ...adminHandlers({ problem, readJson, currentUser: () => session }),
  ...teacherHandlers({ problem, readJson, currentUser: () => session }),
  ...systemHandlers({ problem, readJson, currentUser: () => session }),
]
