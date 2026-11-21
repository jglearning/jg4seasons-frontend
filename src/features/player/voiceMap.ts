// 목소리 사이 시각 옮기기 — 백엔드 ADR 0034(`BE #59`)의 합치는 규칙과 같다. 서버가 목소리를 섞어 들은 구간을
// 합칠 때 쓰는 대응이라, 화면이 같은 규칙으로 옮겨야 목소리를 바꾼 위치·바·문장 점이 판정과 맞는다.
//
// 지문 음원을 조각으로 나눈다: [앞 여백][문장 0][간격 0][문장 1]…[문장 n−1][뒤 여백].
// 경계는 그 목소리의 timings와 durationMs. "k번째 조각의 비율 r 지점" = 다른 목소리의 k번째 조각의 비율 r 지점.
// 어느 한쪽의 timings가 비면(또는 문장 수가 다르면) 음원 전체가 조각 하나 — 길이 비율.

export type Timeline = { timings: readonly (readonly number[])[]; durationMs: number }

/** 조각 경계: [0, 문장0 시작, 문장0 끝, …, 문장n−1 끝, 길이] */
function boundaries(t: Timeline, whole: boolean): number[] {
  if (whole) return [0, t.durationMs]
  return [0, ...t.timings.flatMap(([start, end]) => [start, end]), t.durationMs]
}

/** 옮긴 위치(소수 그대로) */
function mapExact(from: Timeline, to: Timeline, ms: number): number {
  const whole =
    from.timings.length === 0 ||
    to.timings.length === 0 ||
    from.timings.length !== to.timings.length
  const a = boundaries(from, whole)
  const b = boundaries(to, whole)
  const at = Math.min(Math.max(ms, 0), from.durationMs)
  // 길이가 있는 조각 중 at이 들어가는 첫 조각(경계는 뒤 조각의 시작). 끝이면 마지막 조각
  for (let k = 0; k < a.length - 1; k++) {
    const length = a[k + 1] - a[k]
    if (length <= 0) continue
    if (at < a[k + 1] || k === a.length - 2) {
      const ratio = Math.min(Math.max((at - a[k]) / length, 0), 1)
      return b[k] + ratio * (b[k + 1] - b[k])
    }
  }
  return b[b.length - 1]
}

/** 위치 하나를 다른 목소리의 시각으로(ms, 반올림) — 목소리를 바꿔 이어 들을 때 */
export function mapPosition(from: Timeline, to: Timeline, ms: number): number {
  return Math.round(mapExact(from, to, ms))
}

/** 구간들을 다른 목소리의 시각으로. 서버처럼 안쪽으로 반올림(시작 올림, 끝 내림), 길이가 없어지면 버린다 */
export function mapRanges(
  from: Timeline,
  to: Timeline,
  ranges: ReadonlyArray<readonly number[]>,
): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const [start, end] of ranges) {
    const a = Math.ceil(mapExact(from, to, start))
    const b = Math.floor(mapExact(from, to, end))
    if (b > a) out.push([a, b])
  }
  return out
}
