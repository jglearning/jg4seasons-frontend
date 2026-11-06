// 서버가 준 날짜("2026-12-19")를 화면 글자로만 바꾼다(05 §7 날짜 `12/19 (금)`).
// 열림·밀림 판단에는 쓰지 않는다 — 그건 서버 값(state·overdue)만 본다.
// 시간대에 따라 하루 밀리지 않게 Date 문자열 파싱 대신 숫자로 읽고 요일은 UTC로 계산한다

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function parse(date: string): { month: number; day: number; weekday: string } | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (m === null) return undefined
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return undefined
  return { month, day, weekday: WEEKDAYS[utc.getUTCDay()] }
}

/** "12/19 (토)" — 읽을 수 없으면 받은 글자 그대로 */
export function shortDate(date: string): string {
  const d = parse(date)
  return d === undefined ? date : `${d.month}/${d.day} (${d.weekday})`
}

/** "12월 19일 (토)" */
export function longDate(date: string): string {
  const d = parse(date)
  return d === undefined ? date : `${d.month}월 ${d.day}일 (${d.weekday})`
}

/** "12/10 ~ 1/2" */
export function dateRange(from: string, to: string): string {
  const a = parse(from)
  const b = parse(to)
  const show = (d: ReturnType<typeof parse>, raw: string) =>
    d === undefined ? raw : `${d.month}/${d.day}`
  return `${show(a, from)} ~ ${show(b, to)}`
}
