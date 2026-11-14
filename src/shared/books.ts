import type { SelectOption } from './ui/SelectField'

// 권·교재 사용권 표시 글자(교사·관리자·운영자 화면 — 명사형, 가이드 §7)

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

/** 레벨 칩 글자 — "그린 · 겨울" */
export function levelSeasonLabel(levelCode: string, season: string): string {
  const level = LEVELS.find((l) => l.code === levelCode)?.name ?? levelCode
  return `${level} · ${season}`
}

const LICENSE_STATUS = { before_start: '시작 전', active: '사용 중', expired: '끝남' } as const

/** 교재 사용권 상태(A-05·O-03) — 서버 status 그대로 이름만 */
export function licenseStatusLabel(status: keyof typeof LICENSE_STATUS): string {
  return LICENSE_STATUS[status]
}

/** 사용권의 권 표시 — 권 코드 "L2-B1"의 레벨로 "그린 · 겨울 (L2-B1)"(반 관리와 같은 꼴) */
export function licenseBookLabel(bookCode: string, season: string): string {
  return bookLabel(bookCode, bookCode.split('-')[0] ?? bookCode, season)
}
