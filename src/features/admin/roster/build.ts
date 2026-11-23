import type { components } from '../../../api/generated/schema'
import type { ColumnRole, ParsedRow } from './parse'

// A-05 명단 가져오기 ②→③→④: 학생 줄 → 반 이름별 묶음 → 반 정하기 → 요청 본문(RosterImportRequest, BE #67).
// 서버 검사 결과의 field(classes[i].students[j].name)는 이 요청 차례 그대로라 placeOf로 묶음·줄을 되찾는다

type Schemas = components['schemas']
export type RosterRequest = Schemas['RosterImportRequest']

export type Student = {
  /** 붙여넣은 표의 줄 번호 */
  line: number
  className: string
  name: string
  school: string
  grade: string
}

export type Group = {
  /** 묶음 열쇠(공백 정리 + 소문자) — 반 정하기 선택을 이 열쇠로 기억한다 */
  key: string
  /** 처음 나온 반 이름 그대로. 반 칸이 없거나(모두 한 반) 비어 있으면 '' */
  label: string
  students: Student[]
}

export type NewClassDraft = {
  name: string
  bookCode: string
  startDate: string
  weekdays: number[]
  teacherIds: number[]
}

/** 기존 반과 새 반 값을 둘 다 들고 있다 — 라디오를 오가도 고른 값이 남게 */
export type ClassChoice = {
  mode: 'existing' | 'new'
  existingId: number | null
  draft: NewClassDraft
}

export const LIMITS = { classes: 30, perClass: 50, total: 500 } as const

/** 열 뜻대로 학생 줄로. 쓰는 열(이름·반·학교·학년)이 모두 빈 줄은 뺀다 — 이름만 빈 줄은 서버 검사가 오류로 짚게 남긴다 */
export function toStudents(rows: ParsedRow[], roles: ColumnRole[], oneClass: boolean): Student[] {
  const pick = (cells: string[], role: ColumnRole) => {
    const at = roles.indexOf(role)
    return at < 0 ? '' : (cells[at] ?? '')
  }
  return rows
    .map((r) => ({
      line: r.line,
      className: oneClass ? '' : pick(r.cells, 'class'),
      name: pick(r.cells, 'name'),
      school: pick(r.cells, 'school'),
      grade: pick(r.cells, 'grade'),
    }))
    .filter((s) => s.className || s.name || s.school || s.grade)
}

function groupKey(name: string): string {
  return name.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function groupStudents(students: Student[]): Group[] {
  const groups = new Map<string, Group>()
  for (const s of students) {
    const key = groupKey(s.className)
    const found = groups.get(key)
    if (found) found.students.push(s)
    else groups.set(key, { key, label: s.className.trim(), students: [s] })
  }
  return [...groups.values()]
}

/** 기존 반 이름과 맞춰 볼 열쇠 — 띄어쓰기·대소문자·끝의 "반"을 무시("겨울 그린 A" = "겨울 그린 A반") */
function matchKey(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase().replace(/반$/, '')
}

export function defaultClassName(label: string): string {
  const name = label.trim()
  if (name === '' || name.endsWith('반')) return name
  return `${name}반`
}

/** 반 정하기 기본값: 이름이 같은 진행 중 반이 있으면 그 반, 없으면 새 반 */
export function initialChoice(
  group: Group,
  activeClasses: ReadonlyArray<{ id: number; name: string }>,
): ClassChoice {
  const key = matchKey(group.label)
  const same = key === '' ? undefined : activeClasses.find((c) => matchKey(c.name) === key)
  return {
    mode: same ? 'existing' : 'new',
    existingId: same?.id ?? null,
    draft: {
      name: defaultClassName(group.label),
      bookCode: '',
      startDate: '',
      weekdays: [],
      teacherIds: [],
    },
  }
}

/** 화면에서 먼저 막는 빈 칸(나머지 규칙은 서버 검사). 교사는 선택(A-01과 같음) */
export function missingFields(choice: ClassChoice): string[] {
  if (choice.mode === 'existing') return choice.existingId === null ? ['반'] : []
  const d = choice.draft
  const missing: string[] = []
  if (d.name.trim() === '') missing.push('반 이름')
  if (d.bookCode === '') missing.push('권')
  if (d.startDate === '') missing.push('개강일')
  if (d.weekdays.length === 0) missing.push('요일')
  return missing
}

export function groupTitle(group: Group): string {
  return group.label === '' ? '반 이름 없음' : group.label
}

/**
 * 개수 한도 — 넘으면 서버가 400 VALIDATION으로 통째로 거절하고 어느 반인지 짚지 않아서 화면이 먼저 막는다
 */
export function limitProblems(groups: Group[]): string[] {
  const problems: string[] = []
  if (groups.length > LIMITS.classes) {
    problems.push(
      `반이 ${groups.length}개입니다. 한 번에 ${LIMITS.classes}개까지 가져올 수 있으니 나눠서 가져와 주세요`,
    )
  }
  for (const g of groups) {
    if (g.students.length > LIMITS.perClass) {
      problems.push(
        `${groupTitle(g)}: 학생이 ${g.students.length}명입니다. 한 반에 ${LIMITS.perClass}명까지 넣을 수 있습니다`,
      )
    }
  }
  const total = groups.reduce((sum, g) => sum + g.students.length, 0)
  if (total > LIMITS.total) {
    problems.push(
      `학생이 ${total}명입니다. 한 번에 ${LIMITS.total}명까지 가져올 수 있으니 나눠서 가져와 주세요`,
    )
  }
  return problems
}

const byNumber = (a: number, b: number) => a - b

export function buildRequest(
  groups: Group[],
  choices: ReadonlyMap<string, ClassChoice>,
): RosterRequest {
  return {
    classes: groups.map((g) => {
      const students = g.students.map((s) => ({
        name: s.name,
        ...(s.school && { school: s.school }),
        ...(s.grade && { grade: s.grade }),
      }))
      const choice = choices.get(g.key)
      if (choice?.mode === 'existing' && choice.existingId !== null) {
        return { existingClassId: choice.existingId, students }
      }
      const d = choice?.draft
      return {
        newClass: {
          name: d?.name.trim() ?? '',
          bookCode: d?.bookCode ?? '',
          startDate: d?.startDate ?? '',
          weekdays: [...(d?.weekdays ?? [])].sort(byNumber),
          teacherIds: [...(d?.teacherIds ?? [])].sort(byNumber),
        },
        students,
      }
    }),
  }
}

export type IssuePlace =
  | { kind: 'all' }
  | { kind: 'class'; group: number }
  | { kind: 'student'; group: number; student: number }

/** 서버 field → 화면 위치. 학생 칸이면 그 줄, 반 항목 칸이면 그 반, 그 밖은 전체 */
export function placeOf(field: string): IssuePlace {
  const student = /^classes\[(\d+)\]\.students\[(\d+)\]/.exec(field)
  if (student) return { kind: 'student', group: Number(student[1]), student: Number(student[2]) }
  const klass = /^classes\[(\d+)\]/.exec(field)
  if (klass) return { kind: 'class', group: Number(klass[1]) }
  return { kind: 'all' }
}
