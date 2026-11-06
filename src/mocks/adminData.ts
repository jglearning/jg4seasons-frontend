import { delay, http, HttpResponse, type AnyHandler } from 'msw'
import type { components } from '../api/generated/schema'

// 관리자 반·교사 관리 목(03 §5.1·§5.3, BE #12·#14). 서버 규칙 중 화면 확인에 필요한 것만 흉내 낸다:
// 관리자만(403), 칸 검사(400 VALIDATION errors[]), 아이디 겹침(409), 자기 비활성화(409), 가입 코드 재발급

type Schemas = components['schemas']
type Teacher = Schemas['TeacherResponse']
type Class = Schemas['ClassResponse']

type Helpers = {
  problem: (
    request: Request,
    status: number,
    code: string,
    title: string,
    extra?: Record<string, unknown>,
  ) => Response
  readJson: (request: Request) => Promise<Record<string, unknown>>
  /** 지금 로그인한 사람(목 세션) */
  currentUser: () => { id: number; role: string } | null
}

const LEVEL_SEASON: Record<string, { level: string; season: Class['season'] }> = {}
for (const level of ['L1', 'L2', 'L3', 'L4']) {
  ;(['겨울', '봄', '여름', '가을'] as const).forEach((season, i) => {
    LEVEL_SEASON[`${level}-B${i + 1}`] = { level, season }
  })
}
LEVEL_SEASON['K-B1'] = { level: 'K', season: '겨울' }

let teachers: Teacher[] = []
let classes: Class[] = []
let nextId = 100
let codeSeq = 0

export const ADMIN_MOCK = {
  /** 목 세션의 관리자 id(handlers.ts STAFF.admin01과 같게) */
  adminId: 11,
  teacherId: 21,
  classId: 12,
  takenLoginId: 'teacher01',
}

export function resetAdminMock() {
  nextId = 100
  codeSeq = 0
  teachers = [
    {
      id: 11,
      name: '박원장',
      loginId: 'admin',
      role: 'admin',
      status: 'active',
      classIds: [],
      lastLoginAt: '2026-11-06T09:20:00Z',
    },
    {
      id: 21,
      name: '이선생',
      loginId: 'teacher01',
      role: 'teacher',
      status: 'active',
      classIds: [12],
      lastLoginAt: '2026-11-05T23:05:00Z',
    },
    {
      id: 22,
      name: '최선생',
      loginId: 'teacher02',
      role: 'teacher',
      status: 'inactive',
      classIds: [],
      lastLoginAt: null,
    },
  ]
  classes = [
    {
      id: 12,
      name: '겨울 그린 A반',
      bookCode: 'L2-B1',
      levelCode: 'L2',
      season: '겨울',
      startDate: '2026-12-10',
      weekdays: [2, 4, 6],
      accessCode: 'G7KM2XP4',
      codeIssuedAt: '2026-11-01T01:00:00Z',
      allowFutureLessons: false,
      status: 'active',
      teachers: [{ id: 21, name: '이선생' }],
      studentCount: 18,
    },
  ]
}
resetAdminMock()

/** 반의 담당 교사와 교사의 담당 반을 서로 맞춘다 */
function syncTeachersOfClasses() {
  for (const c of classes) {
    c.teachers = teachers
      .filter((t) => t.classIds.includes(c.id))
      .map((t) => ({ id: t.id, name: t.name }))
      .sort((a, b) => a.id - b.id)
  }
}

function newAccessCode(): string {
  codeSeq += 1
  return `N${String(codeSeq).padStart(3, '0')}K7QX`.slice(0, 8)
}

const ids = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is number => typeof v === 'number') : []

export function adminHandlers({ problem, readJson, currentUser }: Helpers): AnyHandler[] {
  const adminOnly = (request: Request) => {
    const user = currentUser()
    if (!user) return problem(request, 401, 'UNAUTHORIZED', '다시 로그인해 주세요')
    if (user.role !== 'admin' && user.role !== 'superadmin')
      return problem(request, 403, 'FORBIDDEN', '권한이 없습니다')
    return undefined
  }
  const validation = (request: Request, errors: Array<{ field: string; message: string }>) =>
    problem(request, 400, 'VALIDATION', '입력값을 확인해 주세요', { errors })

  return [
    http.get('*/api/v1/admin/teachers', async ({ request }) => {
      await delay()
      return (
        adminOnly(request) ??
        HttpResponse.json<Schemas['TeacherListResponse']>({
          items: teachers,
          total: teachers.length,
        })
      )
    }),

    http.post('*/api/v1/admin/teachers', async ({ request }) => {
      const denied = adminOnly(request)
      if (denied) return denied
      const body = await readJson(request)
      const name = String(body.name ?? '').trim()
      const loginId = String(body.loginId ?? '')
        .trim()
        .toLowerCase()
      const password = String(body.password ?? '')
      const errors = []
      if (name === '') errors.push({ field: 'name', message: '이름을 입력해 주세요' })
      if (!/^[a-z0-9._-]{3,30}$/.test(loginId))
        errors.push({ field: 'loginId', message: '아이디는 영문·숫자·. _ - 3~30자' })
      if (password.length < 8) errors.push({ field: 'password', message: '비밀번호는 8자 이상' })
      if (errors.length > 0) return validation(request, errors)
      if (teachers.some((t) => t.loginId === loginId))
        return problem(request, 409, 'LOGIN_ID_TAKEN', '이미 사용 중인 아이디예요')
      const teacher: Teacher = {
        id: nextId++,
        name,
        loginId,
        role: body.role === 'admin' ? 'admin' : 'teacher',
        status: 'active',
        classIds: ids(body.classIds).sort((a, b) => a - b),
        lastLoginAt: null,
      }
      teachers.push(teacher)
      syncTeachersOfClasses()
      return HttpResponse.json(teacher, { status: 201 })
    }),

    http.patch('*/api/v1/admin/teachers/:id', async ({ request, params }) => {
      const denied = adminOnly(request)
      if (denied) return denied
      const teacher = teachers.find((t) => t.id === Number(params.id))
      if (!teacher) return problem(request, 404, 'NOT_FOUND', '교사를 찾을 수 없어요')
      const body = await readJson(request)
      if (body.status === 'inactive' && teacher.id === currentUser()?.id)
        return problem(request, 409, 'SELF_CHANGE_NOT_ALLOWED', '자기 계정은 비활성화할 수 없어요')
      if (typeof body.password === 'string' && body.password.length < 8)
        return validation(request, [{ field: 'password', message: '비밀번호는 8자 이상' }])
      if (typeof body.name === 'string') teacher.name = body.name.trim()
      if (body.status === 'active' || body.status === 'inactive') teacher.status = body.status
      if (Array.isArray(body.classIds)) teacher.classIds = ids(body.classIds).sort((a, b) => a - b)
      syncTeachersOfClasses()
      return HttpResponse.json(teacher)
    }),

    http.get('*/api/v1/admin/classes', async ({ request }) => {
      await delay()
      return (
        adminOnly(request) ??
        HttpResponse.json<Schemas['ClassListResponse']>({ items: classes, total: classes.length })
      )
    }),

    http.get('*/api/v1/admin/classes/:id', async ({ request, params }) => {
      await delay()
      const denied = adminOnly(request)
      if (denied) return denied
      const found = classes.find((c) => c.id === Number(params.id))
      return found
        ? HttpResponse.json(found)
        : problem(request, 404, 'NOT_FOUND', '반을 찾을 수 없어요')
    }),

    http.post('*/api/v1/admin/classes', async ({ request }) => {
      const denied = adminOnly(request)
      if (denied) return denied
      const body = await readJson(request)
      const name = String(body.name ?? '').trim()
      const book = LEVEL_SEASON[String(body.bookCode ?? '')]
      const weekdays = ids(body.weekdays)
      const errors = []
      if (name === '' || name.length > 50)
        errors.push({ field: 'name', message: '반 이름은 1~50자' })
      if (!book) errors.push({ field: 'bookCode', message: '없는 권이에요' })
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.startDate ?? '')))
        errors.push({ field: 'startDate', message: '개강일을 입력해 주세요' })
      if (weekdays.length === 0)
        errors.push({ field: 'weekdays', message: '수업 요일을 하나 이상 골라 주세요' })
      if (errors.length > 0 || !book) return validation(request, errors)
      const created: Class = {
        id: nextId++,
        name,
        bookCode: String(body.bookCode),
        levelCode: book.level,
        season: book.season,
        startDate: String(body.startDate),
        weekdays: [...weekdays].sort((a, b) => a - b),
        accessCode: newAccessCode(),
        codeIssuedAt: '2026-11-06T10:00:00Z',
        allowFutureLessons: false,
        status: 'active',
        teachers: [],
        studentCount: 0,
      }
      classes.push(created)
      for (const id of ids(body.teacherIds)) {
        const teacher = teachers.find((t) => t.id === id)
        if (teacher) teacher.classIds = [...teacher.classIds, created.id].sort((a, b) => a - b)
      }
      syncTeachersOfClasses()
      return HttpResponse.json(created, { status: 201 })
    }),

    http.patch('*/api/v1/admin/classes/:id', async ({ request, params }) => {
      const denied = adminOnly(request)
      if (denied) return denied
      const found = classes.find((c) => c.id === Number(params.id))
      if (!found) return problem(request, 404, 'NOT_FOUND', '반을 찾을 수 없어요')
      const body = await readJson(request)
      if (typeof body.name === 'string') {
        const name = body.name.trim()
        if (name === '')
          return validation(request, [{ field: 'name', message: '반 이름은 1~50자' }])
        found.name = name
      }
      if (body.status === 'active' || body.status === 'finished' || body.status === 'archived')
        found.status = body.status
      if (typeof body.allowFutureLessons === 'boolean')
        found.allowFutureLessons = body.allowFutureLessons
      if (Array.isArray(body.teacherIds)) {
        const next = ids(body.teacherIds)
        for (const teacher of teachers) {
          const has = teacher.classIds.includes(found.id)
          if (next.includes(teacher.id) && !has)
            teacher.classIds = [...teacher.classIds, found.id].sort((a, b) => a - b)
          if (!next.includes(teacher.id) && has)
            teacher.classIds = teacher.classIds.filter((id) => id !== found.id)
        }
      }
      syncTeachersOfClasses()
      return HttpResponse.json(found)
    }),

    http.post('*/api/v1/admin/classes/:id/access-code/regenerate', async ({ request, params }) => {
      const denied = adminOnly(request)
      if (denied) return denied
      const found = classes.find((c) => c.id === Number(params.id))
      if (!found) return problem(request, 404, 'NOT_FOUND', '반을 찾을 수 없어요')
      found.accessCode = newAccessCode()
      found.codeIssuedAt = '2026-11-06T11:30:00Z'
      return HttpResponse.json<Schemas['AccessCodeResponse']>({
        accessCode: found.accessCode,
        codeIssuedAt: found.codeIssuedAt,
      })
    }),
  ]
}
