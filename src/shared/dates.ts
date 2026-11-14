// 교사·관리자·운영자 화면의 날짜 글자. 서버가 준 학원 날짜를 글자로만 바꾼다(열림·밀림을 판단하지 않음).
// 학생 화면은 v0.2 기준이 달라 features/student/dates.ts를 따로 쓴다

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

/** 학원 날짜 "2026-11-05" → "11/5 (목)". 읽을 수 없거나 없는 날짜면 받은 글자 그대로 */
export function shortDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (m === null) return date
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return date
  return `${month}/${day} (${DAY_NAMES[utc.getUTCDay()]})`
}
