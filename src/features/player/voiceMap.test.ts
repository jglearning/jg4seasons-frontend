import { describe, expect, it } from 'vitest'
import { mapPosition, mapRanges } from './voiceMap'

// 백엔드 ADR 0034 합치는 규칙: [앞 여백][문장 0][간격 0][문장 1]…[뒤 여백] 조각의 같은 비율 지점끼리 대응

/** 문장 둘: 문장 0 = 0~1000, 간격 1000~1500, 문장 1 = 1500~3500, 뒤 여백 3500~4000 */
const A = {
  timings: [
    [0, 1000],
    [1500, 3500],
  ],
  durationMs: 4000,
}
/** 같은 문장 둘을 두 배 느리게, 앞 여백 200: 문장 0 = 200~2200, 간격 2200~3200, 문장 1 = 3200~7200, 뒤 여백 없음 */
const B = {
  timings: [
    [200, 2200],
    [3200, 7200],
  ],
  durationMs: 7200,
}

describe('mapPosition — 같은 조각의 같은 비율 지점', () => {
  it('문장 안: 문장 0의 절반 → 다른 목소리 문장 0의 절반', () => {
    expect(mapPosition(A, B, 500)).toBe(1200)
  })

  it('문장 사이 간격: 간격 0의 40% → 다른 목소리 간격 0의 40%', () => {
    expect(mapPosition(A, B, 1200)).toBe(2600)
  })

  it('뒤 여백이 없는 목소리로: 뒤 여백 안은 그 목소리의 끝', () => {
    expect(mapPosition(A, B, 3800)).toBe(7200)
  })

  it('앞 여백이 있는 목소리에서: 앞 여백 안은 앞 여백이 없는 목소리의 처음', () => {
    expect(mapPosition(B, A, 100)).toBe(0)
  })

  it('조각 경계는 경계로: 문장 1 시작 → 다른 목소리 문장 1 시작', () => {
    expect(mapPosition(A, B, 1500)).toBe(3200)
    expect(mapPosition(B, A, 3200)).toBe(1500)
  })

  it('문장 시각이 비면 음원 전체가 조각 하나(길이 비율)', () => {
    const empty = { timings: [], durationMs: 8000 }
    expect(mapPosition(A, empty, 1000)).toBe(2000)
    expect(mapPosition(empty, A, 2000)).toBe(1000)
  })

  it('음원 밖 위치는 처음·끝으로 — A의 처음은 문장 0 시작(앞 여백 없음)이라 B의 문장 0 시작', () => {
    expect(mapPosition(A, B, -50)).toBe(200)
    expect(mapPosition(A, B, 9999)).toBe(7200)
  })
})

describe('mapRanges — 구간 옮기기(안쪽으로 반올림)', () => {
  it('조각을 건너는 구간도 양 끝을 각각 옮긴다', () => {
    expect(mapRanges(A, B, [[500, 2500]])).toEqual([[1200, 5200]])
  })

  it('시작은 올림, 끝은 내림(반올림이 아니다)', () => {
    // 문장 1 길이 2000 → 2500(다른 목소리 C): 1ms = 1.25ms
    const C = {
      timings: [
        [0, 1000],
        [1500, 4000],
      ],
      durationMs: 4000,
    }
    // A 1501 → C 1501.25 → 올림 1502(반올림이면 1501) / A 1503 → C 1503.75 → 내림 1503(반올림이면 1504)
    expect(mapRanges(A, C, [[1501, 1503]])).toEqual([[1502, 1503]])
  })

  it('옮기고 나서 길이가 없어진 구간은 버린다', () => {
    const C = {
      timings: [
        [0, 1000],
        [1500, 4500],
      ],
      durationMs: 4500,
    }
    // A 1501 → 1501.5 → 1502, A 1501 끝 → 1501.5 → 1501 → 빈 구간
    expect(mapRanges(A, C, [[1501, 1501]])).toEqual([])
  })
})
