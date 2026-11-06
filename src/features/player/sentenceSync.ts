import { mergeRanges } from './listeningTracker'

// 따라 읽기(ADR-26, 03 §2.3): 서버가 준 문장 시각(timings)과 들은 구간으로 화면 표시만 정한다. 완료 판정은 서버 일.

/** "들음" 점을 찍는 비율 — 03 §2.3(표시용, 판정 아님) */
export const HEARD_RATIO = 0.8

/**
 * 재생 위치(ms)의 문장 번호(0부터).
 * 문장 사이 간격에서는 앞 문장을 그대로 두고(강조가 깜빡이지 않게), 첫 문장 전이면 첫 문장, 문장이 없으면 -1
 */
export function findSentence(timings: number[][], ms: number): number {
  if (timings.length === 0) return -1
  let found = 0
  for (let i = 0; i < timings.length; i++) {
    if (timings[i][0] <= ms) found = i
    else break
  }
  return found
}

/** 문장마다 들은 구간이 HEARD_RATIO 이상 덮는지. ranges는 겹쳐도 된다(합쳐서 센다) */
export function heardSentences(timings: number[][], ranges: number[][]): boolean[] {
  const merged = mergeRanges(ranges.map(([a, b]): [number, number] => [a, b]))
  return timings.map(([start, end]) => {
    const length = end - start
    if (length <= 0) return false
    let covered = 0
    for (const [a, b] of merged) {
      covered += Math.max(0, Math.min(b, end) - Math.max(a, start))
    }
    return covered >= length * HEARD_RATIO
  })
}
