import { delay, http, HttpResponse, type AnyHandler } from 'msw'
import type { components } from '../api/generated/schema'
import {
  mockActiveClasses,
  mockActiveStudents,
  mockRegeneratePersonalCode,
  mockStudent,
} from './adminData'

// 교사 화면 목(03 §4.1~§4.8, BE #28 계약). 서버가 하는 계산(열림·밀림·완료 수·휴강 밀기)은
// 목 서버가 대신 한다 — 화면은 이 값을 표시만 한다. 반·명단은 관리자 목(adminData)을 그대로 읽는다.
// 레벨 이름·색도 관리자 목의 반 응답(level, 백엔드 시드 값)을 그대로 쓴다.
// 진도표는 반마다 메모리에 두고(휴강·날짜 바꾸기가 매트릭스·반 목록에도 보이게) resetTeacherMock으로 되돌린다

type Schemas = components['schemas']
type Session = Schemas['MatrixSession']
type Cell = Schemas['MatrixCell']
type Status = Cell['status']

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

export const TEACHER_MOCK = {
  /** 학생이 있는 반(겨울 그린 A반) */
  classId: 12,
  /** 학생이 없고 로그인 실패 경고가 있는 반(겨울 그린 B반) */
  alertClassId: 13,
  alertFailures: 23,
  /** 목 서버의 오늘(학원 날짜) — 이 날까지 수업한 회차가 열림 */
  today: '2026-12-19',
  /** 명단 첫 학생 김민준 */
  studentId: 301,
}

const BOOK_LABEL: Record<string, string> = {
  겨울: 'Book 1',
  봄: 'Book 2',
  여름: 'Book 3',
  가을: 'Book 4',
}
const SESSIONS_PER_BOOK = 24
const GROUP = 8
const PASSAGES = 6
/** 지문 트랙 목소리(BE #40 — 모두 필수, 아무 목소리 하나를 끝까지 들으면 지문 완료) */
const VARIANTS = ['us_w', 'us_m', 'uk_w', 'uk_m'] as const

type MockClass = ReturnType<typeof mockActiveClasses>[number]

// ── 진도표(class_session 흉내) ──

type Row = { seq: number; number: number; date: string; cancelled: boolean; note: string | null }

let schedules = new Map<number, Row[]>()

export function resetTeacherMock() {
  schedules = new Map()
}

function toDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const isoOf = (day: Date) => day.toISOString().slice(0, 10)
const isClassDay = (c: MockClass, day: Date) =>
  c.weekdays.includes(day.getUTCDay() === 0 ? 7 : day.getUTCDay())

/** from(포함)부터 수업 요일인 날짜 count개 */
function classDays(c: MockClass, from: string, count: number): string[] {
  const day = toDate(from)
  const dates: string[] = []
  while (dates.length < count) {
    if (isClassDay(c, day)) dates.push(isoOf(day))
    day.setUTCDate(day.getUTCDate() + 1)
  }
  return dates
}

function nextDay(iso: string) {
  const day = toDate(iso)
  day.setUTCDate(day.getUTCDate() + 1)
  return isoOf(day)
}

/** after 다음 날부터 수업 요일이면서 휴강 날짜가 아닌 가장 이른 날(백엔드 ScheduleEdit.nextClassDay) */
function nextClassDay(c: MockClass, after: string, skipped: Set<string>) {
  let day = nextDay(after)
  while (!isClassDay(c, toDate(day)) || skipped.has(day)) day = nextDay(day)
  return day
}

const cancelledDates = (rows: Row[]) => new Set(rows.filter((r) => r.cancelled).map((r) => r.date))

/** k 뒤 수업 행(휴강 아님)의 위치 */
const heldAfter = (rows: Row[], k: number) =>
  rows.flatMap((r, i) => (i > k && !r.cancelled ? [i] : []))

/** 빈 메모는 null(4.6·4.7 모두 "" = 지움·없음) */
const emptyToNull = (note: string) => (note === '' ? null : note)

/** 날짜 순, 같은 날은 휴강 행 먼저, 그다음 지금 순서 → seq를 1부터 다시 매겨 저장 */
function renumber(c: MockClass, rows: Row[]) {
  const sorted = [...rows].sort(
    (a, b) => a.date.localeCompare(b.date) || Number(!a.cancelled) - Number(!b.cancelled),
  )
  schedules.set(
    c.id,
    sorted.map((r, i) => ({ ...r, seq: i + 1 })),
  )
}

/** 반의 진도표 행(처음에는 개강일부터 수업 요일 24개) */
function rowsOf(c: MockClass): Row[] {
  let rows = schedules.get(c.id)
  if (rows === undefined) {
    rows = classDays(c, c.startDate, SESSIONS_PER_BOOK).map((date, i) => ({
      seq: i + 1,
      number: i + 1,
      date,
      cancelled: false,
      note: null,
    }))
    schedules.set(c.id, rows)
  }
  return rows
}

const lessonCode = (c: MockClass, number: number) =>
  `${c.bookCode}-${String(number).padStart(2, '0')}`

function rowStatus(row: Row): Schemas['SessionItem']['status'] {
  if (row.cancelled) return 'cancelled'
  return row.date < TEACHER_MOCK.today ? 'done' : 'scheduled'
}

/** 매트릭스·반 목록이 쓰는 수업(휴강 행 제외). 열림 = 수업일이 오늘 이하 */
function sessionsOf(c: MockClass): Session[] {
  const live = rowsOf(c).filter((r) => !r.cancelled)
  const opened = live.filter((r) => r.date <= TEACHER_MOCK.today)
  const current = opened.at(-1)
  return live.map((r) => ({
    seq: r.seq,
    lesson: { code: lessonCode(c, r.number), number: r.number, title: `Reading Day ${r.number}` },
    scheduledDate: r.date,
    status: rowStatus(r) as Session['status'],
    isCurrent: r === current,
    opened: r.date <= TEACHER_MOCK.today,
  }))
}

function sessionItems(c: MockClass): Schemas['SessionItem'][] {
  return rowsOf(c).map((r) => ({
    seq: r.seq,
    lesson: { code: lessonCode(c, r.number), title: `Reading Day ${r.number}` },
    scheduledDate: r.date,
    status: rowStatus(r),
    note: r.note,
  }))
}

// ── 학습 기록(겨울 그린 A반만) ──

type Progress = { status: Status; requiredDone: number }
// 회차 번호 → 명단 순서(0부터) → 예외. 적히지 않은 열린 회차는 완료
const EXCEPTIONS: Record<number, Record<number, Progress>> = {
  2: { 1: { status: 'in_progress', requiredDone: 4 } },
  3: { 3: { status: 'not_started', requiredDone: 0 } },
  4: {
    3: { status: 'not_started', requiredDone: 0 },
    6: { status: 'in_progress', requiredDone: 2 },
    9: { status: 'not_started', requiredDone: 0 },
  },
  5: {
    2: { status: 'in_progress', requiredDone: 3 },
    5: { status: 'in_progress', requiredDone: 1 },
    8: { status: 'in_progress', requiredDone: 4 },
    11: { status: 'not_started', requiredDone: 0 },
    13: { status: 'not_started', requiredDone: 0 },
    15: { status: 'in_progress', requiredDone: 2 },
    16: { status: 'not_started', requiredDone: 0 },
  },
}
/** 처음 명단 크기 — 관리자 화면에서 새로 넣은 학생은 기록이 없다(전부 미시작) */
const SEEDED_STUDENTS = 18

const NOT_STARTED: Progress = { status: 'not_started', requiredDone: 0 }

/** 한 학생·한 회차 기록. 열리지 않았으면 undefined, 기록이 없으면(다른 반·새 학생) 미시작 */
function progressOf(classId: number, index: number, session: Session): Progress | undefined {
  if (!session.opened) return undefined
  if (classId !== TEACHER_MOCK.classId || index >= SEEDED_STUDENTS) return NOT_STARTED
  return EXCEPTIONS[session.lesson.number]?.[index] ?? { status: 'completed', requiredDone: 6 }
}

function cellsOf(classId: number, sessions: Session[]) {
  const cells: Schemas['MatrixResponse']['cells'] = {}
  const current = sessions.find((s) => s.isCurrent)
  mockActiveStudents(classId).forEach((student, i) => {
    const row: Record<string, Cell> = {}
    for (const s of sessions) {
      // 계약(BE #28): 열린 회차는 학생마다 칸이 항상 온다(안 들었어도 not_started), 열리지 않은 회차는 칸 없음
      const p = progressOf(classId, i, s)
      if (p === undefined) continue
      // 서버 규칙(ADR-24): 지금 회차보다 앞선 열린 회차를 끝내지 않았으면 밀림
      const overdue =
        current !== undefined && p.status !== 'completed' && s.scheduledDate < current.scheduledDate
      row[s.lesson.code] = {
        status: p.status,
        requiredDone: p.requiredDone,
        requiredTotal: PASSAGES,
        completedAt: p.status === 'completed' ? `${s.scheduledDate}T12:00:00Z` : null,
        overdue,
      }
    }
    if (Object.keys(row).length > 0) cells[String(student.id)] = row
  })
  return cells
}

/**
 * 지문 트랙 하나의 청취 결과. requiredDone개까지는 미국 여로 완료, 그다음 지문은 미국 여 40%.
 * 지문 2는 미국 남으로 완료하고 미국 여는 50%(완료가 더 많이 들은 목소리보다 먼저인지 보려고),
 * 다 들은 회차는 지문 1을 영국 남으로 35% 더 들었다
 */
function trackResult(p: Progress | undefined, passageNo: number, variant: string) {
  const durationMs = 60000 + passageNo * 3000
  let coverage = 0
  let completed = false
  // 미시작은 아무것도 듣지 않은 상태
  if (p !== undefined && p.status !== 'not_started') {
    const done = passageNo <= p.requiredDone
    const finisher = passageNo === 2 ? 'us_m' : 'us_w'
    if (done && variant === finisher) {
      coverage = 0.9 + passageNo / 100
      completed = true
    } else if (done && passageNo === 2 && variant === 'us_w') coverage = 0.5
    else if (passageNo === p.requiredDone + 1 && variant === 'us_w') coverage = 0.4
    else if (passageNo === 1 && variant === 'uk_m' && p.status === 'completed') coverage = 0.35
  }
  return {
    coverage,
    completed,
    durationMs,
    totalPlayMs: Math.round(durationMs * coverage * 1.15),
    sessionCount: coverage === 0 ? 0 : passageNo % 2 === 0 ? 2 : 1,
  }
}

const trackId = (passageNo: number, variant: string) =>
  9000 + passageNo * 10 + VARIANTS.indexOf(variant as (typeof VARIANTS)[number])

function classItem(c: MockClass): Schemas['TeacherClassItem'] {
  const sessions = sessionsOf(c)
  const students = mockActiveStudents(c.id)
  const cells = cellsOf(c.id, sessions)
  const current = sessions.find((s) => s.isCurrent)
  const next = sessions.find((s) => !s.opened)
  const statusOf = (studentId: number, code: string) =>
    cells[String(studentId)]?.[code]?.status ?? 'not_started'
  const count = (status: Status) =>
    current === undefined
      ? 0
      : students.filter((s) => statusOf(s.id, current.lesson.code) === status).length
  return {
    id: c.id,
    name: c.name,
    level: c.level,
    book: { code: c.bookCode, label: BOOK_LABEL[c.season], season: c.season },
    studentCount: students.length,
    current:
      current === undefined
        ? null
        : {
            seq: current.seq,
            lesson: { code: current.lesson.code, title: current.lesson.title },
            scheduledDate: current.scheduledDate,
            completed: count('completed'),
            inProgress: count('in_progress'),
            notStarted: count('not_started'),
          },
    overdueStudents: students.filter((s) =>
      Object.values(cells[String(s.id)] ?? {}).some((cell) => cell.overdue === true),
    ).length,
    loginAlert:
      c.id === TEACHER_MOCK.alertClassId
        ? { failures: TEACHER_MOCK.alertFailures, since: '2026-12-19T10:12:00Z' }
        : null,
    next: next === undefined ? null : { seq: next.seq, scheduledDate: next.scheduledDate },
  }
}

export function teacherHandlers({ problem, readJson, currentUser }: Helpers): AnyHandler[] {
  /** 교사는 담당 반만, 관리자는 학원 전체(03 §4) */
  const visibleClasses = (user: { id: number; role: string }) =>
    mockActiveClasses().filter(
      (c) => user.role !== 'teacher' || c.teachers.some((t) => t.id === user.id),
    )
  /** 교사·관리자면 그 사람, 아니면 오류 응답 */
  const staffOnly = (request: Request) => {
    const user = currentUser()
    if (!user) return problem(request, 401, 'UNAUTHORIZED', '다시 로그인해 주세요')
    if (user.role === 'student') return problem(request, 403, 'FORBIDDEN', '권한이 없습니다')
    return user
  }
  /** 볼 수 있는 반이면 그 반, 아니면 오류 응답(없음 404, 담당 아님 403) */
  const classFor = (request: Request, classId: unknown) => {
    const user = staffOnly(request)
    if (user instanceof Response) return user
    const c = mockActiveClasses().find((x) => x.id === Number(classId))
    if (c === undefined) return problem(request, 404, 'NOT_FOUND', '반을 찾을 수 없습니다')
    if (!visibleClasses(user).includes(c))
      return problem(request, 403, 'FORBIDDEN', '담당 반이 아닙니다')
    return c
  }
  const sessionList = (c: MockClass) =>
    HttpResponse.json<Schemas['SessionListResponse']>({ items: sessionItems(c) })

  return [
    http.get('*/api/v1/teacher/classes', async ({ request }) => {
      await delay()
      const user = staffOnly(request)
      if (user instanceof Response) return user
      return HttpResponse.json<Schemas['TeacherClassListResponse']>({
        items: visibleClasses(user).map(classItem),
      })
    }),

    http.get('*/api/v1/teacher/classes/:classId/matrix', async ({ request, params }) => {
      await delay()
      const c = classFor(request, params.classId)
      if (c instanceof Response) return c

      const sessions = sessionsOf(c)
      const url = new URL(request.url)
      const from = url.searchParams.get('fromSeq')
      const to = url.searchParams.get('toSeq')
      let range: [number, number]
      if (from === null && to === null) {
        // 기본: 지금 회차가 든 8개 묶음(수업 전이면 첫 묶음)
        const seq = sessions.find((s) => s.isCurrent)?.seq ?? 1
        const start = Math.floor((seq - 1) / GROUP) * GROUP + 1
        range = [start, start + GROUP - 1]
      } else {
        range = [Number(from), Number(to)]
        if (!Number.isInteger(range[0]) || !Number.isInteger(range[1]) || range[0] > range[1])
          return problem(request, 400, 'VALIDATION', '입력값을 확인해 주세요')
      }
      const inRange = sessions.filter((s) => s.seq >= range[0] && s.seq <= range[1])
      const codes = new Set(inRange.map((s) => s.lesson.code))
      const cells: Schemas['MatrixResponse']['cells'] = {}
      for (const [studentId, row] of Object.entries(cellsOf(c.id, sessions))) {
        cells[studentId] = Object.fromEntries(
          Object.entries(row).filter(([code]) => codes.has(code)),
        )
      }
      return HttpResponse.json<Schemas['MatrixResponse']>({
        class: { id: c.id, name: c.name, level: c.level },
        sessions: inRange,
        students: mockActiveStudents(c.id),
        cells,
      })
    }),

    // 4.3 학생 상세 — 열린 회차만, 최근 회차 먼저
    http.get(
      '*/api/v1/teacher/classes/:classId/students/:studentId',
      async ({ request, params }) => {
        await delay()
        const c = classFor(request, params.classId)
        if (c instanceof Response) return c
        const roster = mockActiveStudents(c.id)
        const index = roster.findIndex((s) => s.id === Number(params.studentId))
        const student = mockStudent(Number(params.studentId))
        if (index < 0 || student === undefined)
          return problem(request, 404, 'NOT_FOUND', '학생을 찾을 수 없습니다')

        const lessons = sessionsOf(c)
          .filter((s) => s.opened)
          .reverse()
          .map((s): Schemas['StudentDetailLesson'] => {
            const p = progressOf(c.id, index, s)
            const done = p?.status === 'completed'
            return {
              code: s.lesson.code,
              title: s.lesson.title,
              status: p?.status ?? 'not_started',
              requiredDone: p?.requiredDone ?? 0,
              requiredTotal: PASSAGES,
              tracks: Array.from({ length: PASSAGES }, (_, i) => i + 1).flatMap((passageNo) =>
                VARIANTS.map((variant) => {
                  const r = trackResult(p, passageNo, variant)
                  return {
                    kind: 'passage' as const,
                    passageNo,
                    variant,
                    required: true,
                    ...r,
                    lastPlayedAt: r.coverage === 0 ? null : `${s.scheduledDate}T12:10:00Z`,
                  }
                }),
              ),
              words: done
                ? { total: 57, cardsViewed: 57, memKnown: 40, recallBest: 51, spellBest: 33 }
                : p === undefined || p.status === 'not_started'
                  ? { total: 57, cardsViewed: 0, memKnown: 0, recallBest: 0, spellBest: 0 }
                  : { total: 57, cardsViewed: 20, memKnown: 9, recallBest: 0, spellBest: 0 },
            }
          })
        return HttpResponse.json<Schemas['StudentDetailResponse']>({
          student: {
            id: student.id,
            name: student.name,
            school: student.school,
            grade: student.grade,
            lastLoginAt: student.lastLoginAt,
          },
          lessons,
        })
      },
    ),

    // 4.4 회차 상세 — 지문 × 목소리 트랙 모두, byTrack은 들은 트랙만(BE #40)
    http.get('*/api/v1/teacher/classes/:classId/lessons/:code', async ({ request, params }) => {
      await delay()
      const c = classFor(request, params.classId)
      if (c instanceof Response) return c
      const session = sessionsOf(c).find((s) => s.lesson.code === params.code)
      if (session === undefined)
        return problem(request, 404, 'NOT_FOUND', '회차를 찾을 수 없습니다')
      const tracks = Array.from({ length: PASSAGES }, (_, i) => i + 1).flatMap((passageNo) =>
        VARIANTS.map((variant) => ({
          trackId: trackId(passageNo, variant),
          kind: 'passage' as const,
          passageNo,
          variant,
          required: true,
        })),
      )
      const rows = mockActiveStudents(c.id).map((student, i): Schemas['TeacherLessonRow'] => {
        const p = progressOf(c.id, i, session)
        const byTrack: Schemas['TeacherLessonRow']['byTrack'] = {}
        for (const t of tracks) {
          const r = trackResult(p, t.passageNo, t.variant)
          if (r.coverage > 0)
            byTrack[String(t.trackId)] = { coverage: r.coverage, completed: r.completed }
        }
        return {
          student: { id: student.id, name: student.name },
          status: p?.status ?? 'not_started',
          byTrack,
        }
      })
      return HttpResponse.json<Schemas['TeacherLessonDetailResponse']>({
        lesson: {
          code: session.lesson.code,
          title: session.lesson.title,
          scheduledDate: session.scheduledDate,
        },
        tracks,
        rows,
      })
    }),

    // 4.5 진도표
    http.get('*/api/v1/teacher/classes/:classId/sessions', async ({ request, params }) => {
      await delay()
      const c = classFor(request, params.classId)
      if (c instanceof Response) return c
      return sessionList(c)
    }),

    // 4.6 날짜·메모 바꾸기 — 백엔드 ScheduleEdit.reschedule(ADR-30)와 같은 규칙.
    // 날짜가 없거나 지금과 같으면 메모만(지난 행·휴강 행도). 실패하면 아무것도 바꾸지 않는다
    http.patch('*/api/v1/teacher/classes/:classId/sessions/:seq', async ({ request, params }) => {
      await delay()
      const c = classFor(request, params.classId)
      if (c instanceof Response) return c
      const k = Number(params.seq) - 1
      const target = rowsOf(c)[k]
      if (target === undefined)
        return problem(request, 404, 'NOT_FOUND', '진도표 행을 찾을 수 없어요')
      const body = await readJson(request)
      const out = rowsOf(c).map((r) => ({ ...r }))
      if (typeof body.note === 'string') out[k].note = emptyToNull(body.note)
      const date = typeof body.scheduledDate === 'string' ? body.scheduledDate : undefined
      if (date === undefined || date === target.date) {
        renumber(c, out)
        return sessionList(c)
      }
      const invalid = (message: string) =>
        problem(request, 400, 'VALIDATION', '입력값을 확인해 주세요', {
          errors: [{ field: 'scheduledDate', message }],
        })
      if (target.cancelled) return invalid('휴강한 수업은 날짜를 바꿀 수 없어요')
      if (target.date < TEACHER_MOCK.today)
        return problem(request, 409, 'SESSION_PAST', '지난 수업은 바꿀 수 없어요')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < TEACHER_MOCK.today)
        return invalid('오늘이나 그 뒤 날짜로 골라 주세요')
      const previous = out
        .slice(0, k)
        .filter((r) => !r.cancelled)
        .at(-1)
      if (previous !== undefined && date <= previous.date)
        return invalid('앞 수업보다 뒤 날짜로 골라 주세요')
      const followers = heldAfter(out, k)
      if (body.shiftFollowing !== true && followers.length > 0 && date >= out[followers[0]].date)
        return invalid('뒤 수업보다 앞 날짜로 골라 주세요(뒤 수업도 옮기려면 뒤로 밀기)')
      out[k].date = date
      if (body.shiftFollowing === true) {
        // 뒤 수업들을 새 날짜의 다음 수업일부터 차례로(휴강 날짜는 건너뜀)
        const skipped = cancelledDates(out)
        let last = date
        for (const i of followers) {
          last = nextClassDay(c, last, skipped)
          out[i].date = last
        }
      }
      renumber(c, out)
      return sessionList(c)
    }),

    // 4.7 휴강 — 백엔드 ScheduleEdit.cancel과 같은 규칙. 그 행은 날짜 그대로 휴강으로 남고,
    // 밀기면 같은 회차가 새 행으로 들어가 뒤 수업들이 한 칸씩 다음 수업일로(행 +1). 이미 휴강한 행이면 그대로 200
    http.post(
      '*/api/v1/teacher/classes/:classId/sessions/:seq/cancel',
      async ({ request, params }) => {
        await delay()
        const c = classFor(request, params.classId)
        if (c instanceof Response) return c
        const k = Number(params.seq) - 1
        const target = rowsOf(c)[k]
        if (target === undefined)
          return problem(request, 404, 'NOT_FOUND', '진도표 행을 찾을 수 없어요')
        if (target.cancelled) return sessionList(c)
        if (target.date < TEACHER_MOCK.today)
          return problem(request, 409, 'SESSION_PAST', '지난 수업은 바꿀 수 없어요')
        const body = await readJson(request)
        const out = rowsOf(c).map((r) => ({ ...r }))
        out[k] = {
          ...target,
          cancelled: true,
          note: typeof body.note === 'string' ? emptyToNull(body.note) : target.note,
        }
        if (body.shiftFollowing === true) {
          const followers = heldAfter(out, k)
          const dates = followers.map((i) => out[i].date)
          dates.push(nextClassDay(c, dates.at(-1) ?? target.date, cancelledDates(out)))
          followers.forEach((i, j) => (out[i].date = dates[j + 1]))
          out.push({ seq: 0, number: target.number, date: dates[0], cancelled: false, note: null })
        }
        renumber(c, out)
        return sessionList(c)
      },
    ),

    // 4.8 개인 코드 재발급 — 담당 반 학생만. 평문은 이 응답에만
    http.post(
      '*/api/v1/teacher/students/:studentId/personal-code/regenerate',
      async ({ request, params }) => {
        await delay()
        const user = staffOnly(request)
        if (user instanceof Response) return user
        const student = mockStudent(Number(params.studentId))
        if (student === undefined || student.status !== 'active')
          return problem(request, 404, 'NOT_FOUND', '학생을 찾을 수 없습니다')
        if (!visibleClasses(user).some((c) => c.id === student.classId))
          return problem(request, 403, 'FORBIDDEN', '담당 반 학생이 아닙니다')
        const personalCode = mockRegeneratePersonalCode(student.id) ?? ''
        return HttpResponse.json<Schemas['PersonalCodeResponse']>({
          studentId: student.id,
          name: student.name,
          personalCode,
        })
      },
    ),
  ]
}
