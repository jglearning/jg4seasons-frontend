import type { SelectOption } from '../../shared/ui/SelectField'

// 관리자 화면 표시용 글자(교사·관리자 화면은 명사형, 가이드 §7)

const LEVELS = [
  { code: 'L1', name: '민트' },
  { code: 'L2', name: '그린' },
  { code: 'L3', name: '블루' },
  { code: 'L4', name: '네이비' },
  { code: 'K', name: '블랙' },
] as const
const SEASONS = ['겨울', '봄', '여름', '가을'] as const

/**
 * 권 고르기 목록 — 백엔드 기준 데이터(V2__reference_data.sql)와 같은 17권: L1~L4는 시즌 4개, 블랙(K)은 B1 하나.
 * 권 목록 API가 없어 프론트에 둔다(백엔드에 GET /books 요청). 권 제목은 문법 이름이라 보이지 않는다(카피 규칙)
 */
export const BOOK_OPTIONS: SelectOption[] = LEVELS.flatMap((level) =>
  (level.code === 'K' ? SEASONS.slice(0, 1) : SEASONS).map((season, i) => {
    const code = `${level.code}-B${i + 1}`
    return { value: code, label: `${level.name} · ${season} (${code})` }
  }),
)

/** 반 응답의 권 표시 — "그린 · 겨울 (L2-B1)" */
export function bookLabel(bookCode: string, levelCode: string, season: string): string {
  const level = LEVELS.find((l) => l.code === levelCode)?.name ?? levelCode
  return `${level} · ${season} (${bookCode})`
}

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

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 학원 날짜 "2026-11-05" → "11/5 (목)"(A-04). 읽을 수 없으면 받은 글자 그대로.
 * 교사 화면 shortDate와 같은 방식 — 기능 폴더끼리 import하지 않아 따로 둔다
 */
export function shortDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (m === null) return date
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return date
  return `${month}/${day} (${DAY_NAMES[utc.getUTCDay()]})`
}

/** 레벨 칩 글자 — "그린 · 겨울" */
export function levelSeasonLabel(levelCode: string, season: string): string {
  const level = LEVELS.find((l) => l.code === levelCode)?.name ?? levelCode
  return `${level} · ${season}`
}
