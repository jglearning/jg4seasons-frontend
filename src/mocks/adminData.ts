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

// 레벨 이름·색(백엔드 시드 V2__reference_data와 같은 값)
const LEVELS: Record<string, Class['level']> = {
  L1: { code: 'L1', nameKo: '민트', colorHex: '#0F8A74' },
  L2: { code: 'L2', nameKo: '그린', colorHex: '#1F7A4F' },
  L3: { code: 'L3', nameKo: '블루', colorHex: '#2563EB' },
  L4: { code: 'L4', nameKo: '네이비', colorHex: '#1E3A8A' },
  K: { code: 'K', nameKo: '블랙', colorHex: '#111827' },
}

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

// 교재 사용권(7.5, BE #48) — 기본은 연계 학원(화면을 보기 쉽게: 사용 중·한도 넘음·시작 전·끝남 한 줄씩).
// 직영·지정 전은 테스트에서 setMockLicenses로
type LicenseList = Schemas['LicenseListResponse']
const LINKED_LICENSES: LicenseList = {
  licenseEnforced: true,
  today: '2026-12-19',
  items: [
    {
      book: { code: 'L1-B1', label: 'Book 1', season: '겨울' },
      startDate: '2026-09-01',
      endDate: '2026-11-30',
      status: 'expired',
      daysLeft: null,
      seats: 20,
      usedSeats: 3,
    },
    {
      book: { code: 'L2-B1', label: 'Book 1', season: '겨울' },
      startDate: '2026-12-01',
      endDate: '2027-02-28',
      status: 'active',
      daysLeft: 72,
      seats: 20,
      usedSeats: 18,
    },
    {
      book: { code: 'L2-B2', label: 'Book 2', season: '봄' },
      startDate: '2027-03-01',
      endDate: '2027-05-31',
      status: 'before_start',
      daysLeft: null,
      seats: 20,
      usedSeats: 0,
    },
    {
      book: { code: 'L3-B1', label: 'Book 1', season: '겨울' },
      startDate: '2026-12-01',
      endDate: '2027-02-28',
      status: 'active',
      daysLeft: 72,
      seats: 20,
      usedSeats: 22,
    },
  ],
}
let licenses: LicenseList = LINKED_LICENSES

export const MOCK_LICENSES = {
  linked: LINKED_LICENSES,
  direct: { licenseEnforced: false, today: '2026-12-19', items: [] } as LicenseList,
  linkedEmpty: { licenseEnforced: true, today: '2026-12-19', items: [] } as LicenseList,
}

/** 테스트에서 사용권 응답을 바꿀 때(resetAdminMock이 연계로 되돌린다) */
export function setMockLicenses(next: LicenseList) {
  licenses = next
}

export function resetAdminMock() {
  nextId = 100
  codeSeq = 0
  licenses = LINKED_LICENSES
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
      level: LEVELS.L2,
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
    {
      id: 13,
      name: '겨울 그린 B반',
      bookCode: 'L2-B1',
      levelCode: 'L2',
      level: LEVELS.L2,
      season: '겨울',
      startDate: '2026-12-11',
      weekdays: [1, 3, 5],
      accessCode: 'H4PN8RT2',
      codeIssuedAt: '2026-11-01T01:00:00Z',
      allowFutureLessons: false,
      status: 'active',
      teachers: [],
      studentCount: 0,
    },
  ]
  resetStudentMock()
}

// ── 학생 명단(03 §5.2, BE #27) ──
// 개인 코드는 서버처럼 평문을 보관하지 않는다(겹침 검사용 집합만). 평문은 만들기·재발급 응답에만

type Student = Schemas['StudentResponse']
type StudentRow = Student & { classId: number }

let students: StudentRow[] = []
let usedCodes = new Set<string>()
let codeCursor = 0

const ROSTER_12 = [
  ['김민준', 'A중', '중1'],
  ['이서연', 'A중', '중1'],
  ['박지호', 'B중', '중1'],
  ['최하은', 'A중', '중2'],
  ['정도윤', 'B중', '중1'],
  ['강수아', null, null],
  ['조예준', 'A중', '중1'],
  ['윤지우', 'C중', '중1'],
  ['장시우', 'A중', '중2'],
  ['임하린', 'B중', '중1'],
  ['한주원', 'A중', '중1'],
  ['오서윤', 'C중', '중2'],
  ['서지안', 'A중', '중1'],
  ['신유준', 'B중', '중1'],
  ['권채원', 'A중', '중1'],
  ['황은우', 'C중', '중1'],
  ['안다은', 'A중', '중2'],
  ['송건우', 'B중', '중1'],
] as const

export const STUDENT_MOCK = {
  /** 명단 첫 학생(학생 목 세션 김민준과 같은 id) */
  firstId: 301,
  /** 이미 퇴원한 학생 */
  inactiveName: '문하준',
  /** 이 이름으로 만들면 서버가 400 VALIDATION(칸 오류)을 낸다 */
  invalidName: '오류',
}

export function resetStudentMock() {
  codeCursor = 0
  usedCodes = new Set(['3817'])
  students = ROSTER_12.map(([name, school, grade], i) => ({
    id: STUDENT_MOCK.firstId + i,
    classId: 12,
    name,
    school,
    grade,
    status: 'active' as const,
    // 강수아(5번)는 개인 코드가 없는 학생(BE #27 codeIssuedAt null)
    codeIssuedAt: i === 5 ? null : '2026-11-02T01:00:00Z',
    lastLoginAt: i % 3 === 2 ? null : '2026-11-06T09:00:00Z',
  }))
  students.push({
    id: 330,
    classId: 12,
    name: STUDENT_MOCK.inactiveName,
    school: 'A중',
    grade: '중1',
    status: 'inactive',
    codeIssuedAt: '2026-11-02T01:00:00Z',
    lastLoginAt: null,
  })
  syncStudentCounts()
}

/** 반의 학생 수 = 그 반의 활성 학생 */
function syncStudentCounts() {
  for (const c of classes) {
    c.studentCount = students.filter((s) => s.classId === c.id && s.status === 'active').length
  }
}

/** 학원 안에서 겹치지 않는 4자리 */
function newPersonalCode(): string {
  let code: string
  do {
    codeCursor += 1
    code = String((5092 + codeCursor * 37) % 10000).padStart(4, '0')
  } while (usedCodes.has(code))
  usedCodes.add(code)
  return code
}

/** 응답에는 반 id가 없다 */
function studentView(row: StudentRow): Student {
  const student: Partial<StudentRow> = { ...row }
  delete student.classId
  return student as Student
}

/** 교사 목(teacherData)이 읽는 운영 중인 반 — 관리자 화면에서 바꾼 것이 교사 화면에도 보이게 */
export function mockActiveClasses(): readonly Class[] {
  return classes.filter((c) => c.status === 'active')
}

/** 교사 목이 읽는 반의 재원 학생(id 순) */
export function mockActiveStudents(classId: number) {
  return students
    .filter((s) => s.classId === classId && s.status === 'active')
    .sort((a, b) => a.id - b.id)
    .map(({ id, name, school, grade }) => ({ id, name, school, grade }))
}

/** 교사 목이 읽는 학생 한 명(반 id·마지막 로그인 포함). 없으면 undefined */
export function mockStudent(studentId: number) {
  const row = students.find((s) => s.id === studentId)
  return row === undefined ? undefined : { ...row }
}

/** 교사 목의 개인 코드 재발급(4.8) — 관리자 재발급과 같은 코드 규칙(학원 안에서 겹치지 않음) */
export function mockRegeneratePersonalCode(studentId: number): string | undefined {
  const row = students.find((s) => s.id === studentId)
  if (row === undefined) return undefined
  row.codeIssuedAt = '2026-12-19T11:00:00Z'
  return newPersonalCode()
}

// 학생 선언 뒤에 불러야 한다(resetStudentMock이 위 let을 쓴다)
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
    // 운영자(superadmin)도 403 — 학원이 없어 학원 화면 API를 쓰지 않는다(BE #48)
    if (user.role !== 'admin') return problem(request, 403, 'FORBIDDEN', '권한이 없습니다')
    return undefined
  }
  const validation = (request: Request, errors: Array<{ field: string; message: string }>) =>
    problem(request, 400, 'VALIDATION', '입력값을 확인해 주세요', { errors })

  return [
    // 7.5 교재 사용권(관리자만, 보기만)
    http.get('*/api/v1/admin/licenses', async ({ request }) => {
      await delay()
      return adminOnly(request) ?? HttpResponse.json(licenses)
    }),

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
        level: LEVELS[book.level],
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

    // ── 학생(§5.2) ──

    http.get('*/api/v1/admin/classes/:id/students', async ({ request, params }) => {
      await delay()
      const denied = adminOnly(request)
      if (denied) return denied
      const classId = Number(params.id)
      if (!classes.some((c) => c.id === classId))
        return problem(request, 404, 'NOT_FOUND', '반을 찾을 수 없어요')
      // 서버(BE #30)와 같게: 지금 이 반 학생만(퇴원생 빠짐), 이름 순 → 같으면 id 순
      const items = students
        .filter((s) => s.classId === classId && s.status === 'active')
        .sort((a, b) => (a.name === b.name ? a.id - b.id : a.name < b.name ? -1 : 1))
        .map(studentView)
      return HttpResponse.json<Schemas['StudentListResponse']>({
        items,
        total: items.length,
      })
    }),

    http.post('*/api/v1/admin/classes/:id/students', async ({ request, params }) => {
      await delay()
      const denied = adminOnly(request)
      if (denied) return denied
      const classId = Number(params.id)
      if (!classes.some((c) => c.id === classId))
        return problem(request, 404, 'NOT_FOUND', '반을 찾을 수 없어요')
      const body = await readJson(request)
      const list = Array.isArray(body.students) ? (body.students as Record<string, unknown>[]) : []
      if (list.length === 0 || list.length > 50)
        return validation(request, [{ field: 'students', message: '학생은 1~50명' }])
      const errors: Array<{ field: string; message: string }> = []
      list.forEach((item, i) => {
        const name = String(item.name ?? '').trim()
        if (name === '' || name.length > 30 || name === STUDENT_MOCK.invalidName)
          errors.push({ field: `students[${i}].name`, message: '이름은 1~30자' })
      })
      if (errors.length > 0) return validation(request, errors)
      const created = list.map((item) => {
        const student: StudentRow = {
          id: nextId++,
          classId,
          name: String(item.name).trim(),
          school: typeof item.school === 'string' && item.school.trim() ? item.school.trim() : null,
          grade: typeof item.grade === 'string' && item.grade.trim() ? item.grade.trim() : null,
          status: 'active',
          codeIssuedAt: '2026-11-07T02:00:00Z',
          lastLoginAt: null,
        }
        students.push(student)
        return { id: student.id, name: student.name, personalCode: newPersonalCode() }
      })
      syncStudentCounts()
      return HttpResponse.json<Schemas['StudentCreatedResponse']>({ created }, { status: 201 })
    }),

    http.post(
      '*/api/v1/admin/classes/:id/students/personal-codes/regenerate',
      async ({ request, params }) => {
        await delay()
        const denied = adminOnly(request)
        if (denied) return denied
        const classId = Number(params.id)
        const body = await readJson(request)
        const wanted = ids(body.studentIds)
        const targets = students.filter((s) => s.classId === classId && wanted.includes(s.id))
        if (wanted.length === 0 || targets.length !== wanted.length)
          return validation(request, [{ field: 'studentIds', message: '이 반 학생을 골라 주세요' }])
        const items = targets.map((s) => {
          s.codeIssuedAt = '2026-11-07T03:00:00Z'
          return { id: s.id, name: s.name, personalCode: newPersonalCode() }
        })
        return HttpResponse.json<Schemas['PersonalCodesResponse']>({ items })
      },
    ),

    http.patch('*/api/v1/admin/students/:id', async ({ request, params }) => {
      await delay()
      const denied = adminOnly(request)
      if (denied) return denied
      const student = students.find((s) => s.id === Number(params.id))
      if (!student) return problem(request, 404, 'NOT_FOUND', '학생을 찾을 수 없어요')
      const body = await readJson(request)
      if (body.status === 'active' || body.status === 'inactive') student.status = body.status
      syncStudentCounts()
      return HttpResponse.json(studentView(student))
    }),

    http.post('*/api/v1/admin/students/:id/move', async ({ request, params }) => {
      await delay()
      const denied = adminOnly(request)
      if (denied) return denied
      const student = students.find((s) => s.id === Number(params.id))
      if (!student) return problem(request, 404, 'NOT_FOUND', '학생을 찾을 수 없어요')
      const body = await readJson(request)
      const target = classes.find((c) => c.id === body.toClassId)
      if (!target || target.status !== 'active' || target.id === student.classId)
        return validation(request, [{ field: 'toClassId', message: '옮길 반을 골라 주세요' }])
      student.classId = target.id
      syncStudentCounts()
      return HttpResponse.json(studentView(student))
    }),

    // ── 학원 현황(§5.4) ──

    http.get('*/api/v1/admin/dashboard', async ({ request }) => {
      await delay()
      const denied = adminOnly(request)
      if (denied) return denied
      return HttpResponse.json<Schemas['DashboardResponse']>({
        classes: classes
          .filter((c) => c.status === 'active')
          .map((c) => ({
            id: c.id,
            name: c.name,
            current:
              c.id === 12
                ? {
                    seq: 5,
                    lesson: { code: 'L2-B1-05', title: 'Reading Day 5' },
                    scheduledDate: '2026-12-19',
                  }
                : null,
            completedRate: c.id === 12 ? 0.64 : 0,
          })),
        activeStudentsToday: 12,
      })
    }),
  ]
}
