import { delay, http, HttpResponse, type AnyHandler } from 'msw'
import type {
  UploadTicket,
  WordTestItem,
  WordTestSection,
  WordTestSubmission,
} from '../features/student/wordtest/wordTestApi'
import { mockActiveStudents, mockStudent } from './adminData'
import { LESSON_MOCK } from './lessonData'
import { STUDENT_MOCK } from './studentData'
import { buildWords } from './wordData'

// 단어시험 사진 채점 목(#171) — 백엔드와 합의한 계약(11/24) 그대로(아래 D-1~D-7은 그 계약의 절 번호).
// 백엔드 openapi.json이 생기면 그 타입으로.
// 업로드 주소는 같은 출처 /mock-upload/…(이 PUT도 목이 받는다). 제출 뒤 조회할 때마다 pending → grading → graded.
// 문항 수는 영역·레벨마다 다르다(B 철자 쓰기: 그린 47~48, 민트 34~35) — 민트(L1)는 35개, 그 밖은 48개.
// 단어는 wordData의 지어낸 단어를 돌려 쓴다(교재 시험지를 공개 저장소에 넣지 않는다)

type Helpers = {
  problem: (
    request: Request,
    status: number,
    code: string,
    title: string,
    extra?: Record<string, unknown>,
  ) => Response
  readJson: (request: Request) => Promise<Record<string, unknown>>
  currentUser: () => { id: number; role: string } | null
}

const DEFAULTS = {
  /** 하루 제출 한도(계약 D-7) */
  dailyLimit: 3,
  /** 조회 몇 번째부터 grading · graded인가(제출 직후 첫 조회 = 1). 테스트가 바꿔 쓴다 */
  gradingAtPoll: 1,
  gradedAtPoll: 3,
}

export const WORD_TEST_MOCK = {
  ...DEFAULTS,
  totalByLevel: { mint: 35, other: 48 },
}

type Stored = { submission: WordTestSubmission; polls: number }

let nextId = 318
const submissions = new Map<number, Stored>()
const byClientId = new Map<string, number>()
const uploaded = new Set<string>()
/** `${lessonCode}:${section}` → 최근 제출 id */
const latest = new Map<string, number>()
const dailyCount = new Map<string, number>()

export function resetWordTestMock() {
  Object.assign(WORD_TEST_MOCK, DEFAULTS)
  nextId = 318
  submissions.clear()
  byClientId.clear()
  uploaded.clear()
  latest.clear()
  dailyCount.clear()
}

const SECTIONS: readonly WordTestSection[] = ['A', 'B', 'C', 'D']
const isSection = (value: unknown): value is WordTestSection =>
  SECTIONS.includes(value as WordTestSection)
const isOpen = (code: string) => (LESSON_MOCK.openCodes as readonly string[]).includes(code)

export function mockItemTotal(lessonCode: string): number {
  const mint = lessonCode.startsWith('L1-') || (STUDENT_MOCK.level.code as string) === 'L1'
  return mint ? WORD_TEST_MOCK.totalByLevel.mint : WORD_TEST_MOCK.totalByLevel.other
}

/**
 * 채점 결과 — 7번째마다 틀림(글자 하나 빠짐), 11번째마다 빈칸, 13번째마다 판단 못 함(unclear — 앞 세 글자만 읽힘).
 * unclear는 프론트 제안 값(백엔드 답 대기). 점수는 맞음만 센다(unclear는 total에만 — 제안대로)
 */
/** 정답이 늘 있는 문항(교사 응답 모양 — 교사는 unclear에도 정답을 받는다, `BE #75`) */
type MockItem = Omit<WordTestItem, 'answer'> & { answer: string }

/** 학생 응답 모양: unclear 문항은 정답이 null(`BE #73` — 판정 전이라 주지 않음) */
export function studentItems(total: number): WordTestItem[] {
  return buildItems(total).map((item) =>
    item.result === 'unclear' ? { ...item, answer: null } : item,
  )
}

export function buildItems(total: number): MockItem[] {
  const words = buildWords().items
  return Array.from({ length: total }, (_, i) => {
    const word = words[i % words.length]
    const no = i + 1
    if (no % 11 === 0)
      return { no, prompt: word.korean, written: '', result: 'blank', answer: word.english }
    if (no % 13 === 0)
      return {
        no,
        prompt: word.korean,
        written: word.english.slice(0, 3),
        result: 'unclear',
        answer: word.english,
      }
    if (no % 7 === 0) {
      const cut = Math.max(1, Math.floor(word.english.length / 2))
      const written = word.english.slice(0, cut) + word.english.slice(cut + 1)
      return { no, prompt: word.korean, written, result: 'wrong', answer: word.english }
    }
    return {
      no,
      prompt: word.korean,
      written: word.english,
      result: 'correct',
      answer: word.english,
    }
  })
}

/** 조회 응답 — graded가 아니면 score·gradedAt null, items 필드 없음(D-3) */
function view(stored: Stored): WordTestSubmission {
  const { items, ...rest } = stored.submission
  return rest.status === 'graded' ? { ...rest, items } : rest
}

function advance(stored: Stored) {
  const s = stored.submission
  if (s.status === 'graded' || s.status === 'failed') return
  stored.polls += 1
  if (stored.polls >= WORD_TEST_MOCK.gradedAtPoll) {
    const items = studentItems(s.total)
    stored.submission = {
      ...s,
      status: 'graded',
      score: items.filter((item) => item.result === 'correct').length,
      gradedAt: new Date().toISOString(),
      items,
    }
  } else if (stored.polls >= WORD_TEST_MOCK.gradingAtPoll) {
    stored.submission = { ...s, status: 'grading' }
  }
}

export function wordTestHandlers({ problem, readJson, currentUser }: Helpers): AnyHandler[] {
  const studentOnly = (request: Request) => {
    const user = currentUser()
    if (!user) return problem(request, 401, 'UNAUTHORIZED', '다시 들어와 주세요')
    if (user.role !== 'student') return problem(request, 403, 'FORBIDDEN', '이 화면을 볼 수 없어요')
    return undefined
  }
  const locked = (request: Request) =>
    problem(request, 423, 'LESSON_LOCKED', '아직 열리지 않은 회차예요', {
      detail: '수업일이 되면 열려요',
    })

  return [
    // D-1 업로드 주소 발급
    http.post('*/api/v1/word-tests/uploads', async ({ request }) => {
      await delay()
      const denied = studentOnly(request)
      if (denied) return denied
      const { lessonCode } = await readJson(request)
      if (typeof lessonCode !== 'string')
        return problem(request, 400, 'VALIDATION', '요청 형식이 맞지 않아요')
      if (!isOpen(lessonCode)) return locked(request)
      const imageKey = `homework/1/301/${crypto.randomUUID()}.jpg`
      return HttpResponse.json<UploadTicket>({
        uploadUrl: new URL(`/mock-upload/${imageKey}`, request.url).href,
        imageKey,
        headers: { 'Content-Type': 'image/jpeg' },
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      })
    }),

    // 서명 주소로 올리기(S3 흉내) — 쿠키 없이 와야 한다
    http.put('*/mock-upload/*', async ({ request }) => {
      await delay()
      const key = new URL(request.url).pathname.replace(/^\/mock-upload\//, '')
      uploaded.add(key)
      return new HttpResponse(null, { status: 200 })
    }),

    // D-2 제출 — 같은 clientSubmissionId면 기존 제출을 200
    http.post('*/api/v1/word-tests/submissions', async ({ request }) => {
      await delay()
      const denied = studentOnly(request)
      if (denied) return denied
      const body = await readJson(request)
      const { clientSubmissionId, lessonCode, section, imageKey } = body
      if (
        typeof clientSubmissionId !== 'string' ||
        typeof lessonCode !== 'string' ||
        !isSection(section) ||
        typeof imageKey !== 'string'
      )
        return problem(request, 400, 'VALIDATION', '요청 형식이 맞지 않아요')
      const existing = byClientId.get(clientSubmissionId)
      if (existing !== undefined) {
        const { id, status } = submissions.get(existing)!.submission
        return HttpResponse.json({ id, status }, { status: 200 })
      }
      if (!isOpen(lessonCode)) return locked(request)
      if (!uploaded.has(imageKey))
        return problem(request, 400, 'INVALID_IMAGE', '사진을 쓸 수 없어요')
      const count = dailyCount.get(lessonCode) ?? 0
      if (count >= WORD_TEST_MOCK.dailyLimit)
        return problem(request, 429, 'DAILY_LIMIT', '오늘은 더 올릴 수 없어요')
      dailyCount.set(lessonCode, count + 1)
      const id = nextId++
      const submission: WordTestSubmission = {
        id,
        lessonCode,
        section,
        attemptNo: count + 1,
        status: 'pending',
        score: null,
        total: mockItemTotal(lessonCode),
        submittedAt: new Date().toISOString(),
        gradedAt: null,
      }
      submissions.set(id, { submission, polls: 0 })
      byClientId.set(clientSubmissionId, id)
      latest.set(`${lessonCode}:${section}`, id)
      return HttpResponse.json({ id, status: submission.status }, { status: 202 })
    }),

    // D-3 제출 조회(본인 것만 — 목의 학생은 하나)
    http.get('*/api/v1/word-tests/submissions/:id', async ({ request, params }) => {
      await delay()
      const denied = studentOnly(request)
      if (denied) return denied
      const stored = submissions.get(Number(params.id))
      if (stored === undefined) return problem(request, 404, 'NOT_FOUND', '제출을 찾을 수 없어요')
      advance(stored)
      return HttpResponse.json(view(stored))
    }),

    // D-4 회차의 내 최근 제출 — 없으면 204
    http.get('*/api/v1/word-tests/lessons/:code/latest', async ({ request, params }) => {
      await delay()
      const denied = studentOnly(request)
      if (denied) return denied
      const code = String(params.code)
      const section = new URL(request.url).searchParams.get('section')
      if (!isSection(section)) return problem(request, 400, 'VALIDATION', '요청 형식이 맞지 않아요')
      if (!isOpen(code)) return locked(request)
      const id = latest.get(`${code}:${section}`)
      if (id === undefined) return new HttpResponse(null, { status: 204 })
      const stored = submissions.get(id)!
      advance(stored)
      return HttpResponse.json(view(stored))
    }),
  ]
}

// ── 교사 조회(#175) — D-5 반 결과 목록, D-6 제출 상세 ──
// 반 학생마다 결과를 섞는다(재원 학생 id 순 i % 5): 0 완료 · 1 완료(사진 지워짐) · 2 채점 중 · 3 실패 · 4 미제출.
// 제출 id = 9000 + 학생 id. 학생 제출 목(위)과는 따로 — 교사 화면 확인용 고정 데이터

export const TEACHER_WORD_TEST_MOCK = {
  idBase: 9000,
  /** 이 회차로 부르면 404 FEATURE_DISABLED(기능 꺼짐 확인용) */
  disabledLessonCode: 'L2-B1-01',
  image: '/mock-image/answer-sheet.svg',
} as const

type TeacherKind = 'graded' | 'gradedNoImage' | 'grading' | 'failed' | 'none'
const TEACHER_KINDS: TeacherKind[] = ['graded', 'gradedNoImage', 'grading', 'failed', 'none']

function teacherSubmission(studentIndex: number, studentId: number, lessonCode: string) {
  const kind = TEACHER_KINDS[studentIndex % TEACHER_KINDS.length]
  if (kind === 'none') return null
  const total = mockItemTotal(lessonCode)
  const items = buildItems(total)
  const graded = kind === 'graded' || kind === 'gradedNoImage'
  const status = graded ? ('graded' as const) : kind
  const minute = String(10 + (studentIndex % 40)).padStart(2, '0')
  return {
    id: TEACHER_WORD_TEST_MOCK.idBase + studentId,
    lessonCode,
    section: 'B' as const,
    attemptNo: 1 + (studentIndex % 2),
    status,
    score: graded ? items.filter((item) => item.result === 'correct').length : null,
    total,
    submittedAt: `2026-12-19T10:${minute}:12Z`,
    gradedAt: graded ? `2026-12-19T10:${minute}:21Z` : null,
    items: graded ? items : undefined,
    imageUrl: kind === 'gradedNoImage' ? null : TEACHER_WORD_TEST_MOCK.image,
  }
}

/** 코드로 그린 답안지 그림(저장소에 실제 답안지 사진을 넣지 않는다) — 번호와 밑줄 48칸 */
function answerSheetSvg(): string {
  const rows = Array.from({ length: 24 }, (_, i) => {
    const y = 60 + i * 30
    return [
      `<text x="40" y="${y}" font-size="14" fill="#555">${i + 1}.</text>`,
      `<line x1="80" y1="${y + 4}" x2="360" y2="${y + 4}" stroke="#999"/>`,
      `<text x="420" y="${y}" font-size="14" fill="#555">${i + 25}.</text>`,
      `<line x1="460" y1="${y + 4}" x2="740" y2="${y + 4}" stroke="#999"/>`,
    ].join('')
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100"><rect width="800" height="1100" fill="#fbfaf6"/><text x="40" y="32" font-size="18" fill="#333">B</text>${rows}</svg>`
}

export function wordTestTeacherHandlers({ problem, currentUser }: Helpers): AnyHandler[] {
  const staffOnly = (request: Request) => {
    const user = currentUser()
    if (!user) return problem(request, 401, 'UNAUTHORIZED', '다시 로그인해 주세요')
    if (user.role !== 'teacher' && user.role !== 'admin')
      return problem(request, 403, 'FORBIDDEN', '권한이 없습니다')
    return undefined
  }

  return [
    // D-5 반 결과 목록 — 학생마다 최근 제출 또는 null
    http.get('*/api/v1/teacher/classes/:classId/word-tests', async ({ request, params }) => {
      await delay()
      const denied = staffOnly(request)
      if (denied) return denied
      const url = new URL(request.url)
      const lessonCode = url.searchParams.get('lessonCode') ?? ''
      if (lessonCode === TEACHER_WORD_TEST_MOCK.disabledLessonCode)
        return problem(request, 404, 'FEATURE_DISABLED', '이 학원은 단어시험을 쓰지 않습니다')
      const students = mockActiveStudents(Number(params.classId))
      return HttpResponse.json({
        lessonCode,
        students: students.map((student, i) => {
          const s = teacherSubmission(i, student.id, lessonCode)
          return {
            studentId: student.id,
            name: student.name,
            submission:
              s === null
                ? null
                : {
                    id: s.id,
                    status: s.status,
                    score: s.score,
                    total: s.total,
                    attemptNo: s.attemptNo,
                    submittedAt: s.submittedAt,
                  },
          }
        }),
      })
    }),

    // D-6 제출 상세 — 학생 제출 조회(D-3) + student, imageUrl
    http.get('*/api/v1/teacher/word-tests/:id', async ({ request, params }) => {
      await delay()
      const denied = staffOnly(request)
      if (denied) return denied
      const studentId = Number(params.id) - TEACHER_WORD_TEST_MOCK.idBase
      const student = mockStudent(studentId)
      if (student === undefined)
        return problem(request, 404, 'NOT_FOUND', '제출을 찾을 수 없습니다')
      const index = mockActiveStudents(student.classId).findIndex((s) => s.id === studentId)
      const s = teacherSubmission(index, studentId, 'L2-B1-05')
      if (s === null) return problem(request, 404, 'NOT_FOUND', '제출을 찾을 수 없습니다')
      const { items, ...rest } = s
      return HttpResponse.json({
        ...rest,
        ...(items === undefined ? {} : { items }),
        student: { id: student.id, name: student.name },
      })
    }),

    // 서명 주소 흉내 — 코드로 그린 답안지 그림
    http.get('*/mock-image/answer-sheet.svg', () =>
      HttpResponse.text(answerSheetSvg(), { headers: { 'Content-Type': 'image/svg+xml' } }),
    ),
  ]
}
