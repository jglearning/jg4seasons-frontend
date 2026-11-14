import type { SelectOption } from '../../shared/ui/SelectField'

// 관리자 화면 표시용 글자(교사·관리자 화면은 명사형, 가이드 §7).
// 권·사용권 글자는 shared/books.ts, 학원 날짜는 shared/dates.ts(운영자 화면과 같이 씀)

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

/** 1=월 … 7=일 */
export const WEEKDAY_OPTIONS = WEEKDAYS.map((label, i) => ({ value: i + 1, label }))

export function weekdaysText(days: number[]): string {
  return days.map((d) => WEEKDAYS[d - 1] ?? String(d)).join('·')
}

const CLASS_STATUS = { active: '운영 중', finished: '종강', archived: '보관' } as const
export function classStatusLabel(status: keyof typeof CLASS_STATUS): string {
  return CLASS_STATUS[status]
}
export const CLASS_STATUS_OPTIONS: SelectOption[] = Object.entries(CLASS_STATUS).map(
  ([value, label]) => ({ value, label }),
)

const ROLE = { teacher: '교사', admin: '관리자', superadmin: '운영자', student: '학생' } as const
export function roleLabel(role: keyof typeof ROLE): string {
  return ROLE[role]
}

const TEACHER_STATUS = { active: '활성', inactive: '비활성' } as const
export function teacherStatusLabel(status: keyof typeof TEACHER_STATUS): string {
  return TEACHER_STATUS[status]
}

const STUDENT_STATUS = { active: '재원', inactive: '퇴원' } as const
export function studentStatusLabel(status: keyof typeof STUDENT_STATUS): string {
  return STUDENT_STATUS[status]
}

const KOREA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function koreaParts(iso: string): Record<string, string> {
  return Object.fromEntries(KOREA.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
}

/** 서버 UTC 시각 → 한국 시간 "2026-11-06 18:20" */
export function koreaDateTime(iso: string): string {
  const parts = koreaParts(iso)
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

/** 서버 UTC 시각 → 한국 시간 "11/6 18:20"(연도 없이 — 교사 화면 시각과 같은 꼴, A-02 명단) */
export function koreaShortDateTime(iso: string): string {
  const parts = koreaParts(iso)
  return `${Number(parts.month)}/${Number(parts.day)} ${parts.hour}:${parts.minute}`
}
