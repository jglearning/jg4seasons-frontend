import { describe, expect, it } from 'vitest'
import { groupByPassage, passageCell, trackName } from './format'

describe('groupByPassage', () => {
  it('서버 순서(지문 → 목소리) 그대로 지문별로 모은다', () => {
    const tracks = [
      { passageNo: 1, v: 'a' },
      { passageNo: 1, v: 'b' },
      { passageNo: 2, v: 'a' },
    ]
    expect(groupByPassage(tracks)).toEqual([
      { passageNo: 1, tracks: [tracks[0], tracks[1]] },
      { passageNo: 2, tracks: [tracks[2]] },
    ])
    expect(groupByPassage([])).toEqual([])
  })
})

describe('passageCell', () => {
  it('완료한 목소리가 있으면 그것(더 많이 들은 미완료보다 먼저)', () => {
    expect(
      passageCell([
        { track: 'us_w', completed: false, coverage: 0.95 },
        { track: 'us_m', completed: true, coverage: 0.9 },
      ])?.track,
    ).toBe('us_m')
  })

  it('완료가 없으면 가장 많이 들은 목소리, 아무것도 안 들었으면 없음', () => {
    expect(
      passageCell([
        { track: 'us_w', completed: false, coverage: 0.2 },
        { track: 'uk_w', completed: false, coverage: 0.6 },
      ])?.track,
    ).toBe('uk_w')
    expect(passageCell([{ track: 'us_w', completed: false, coverage: 0 }])).toBeUndefined()
    expect(passageCell([])).toBeUndefined()
  })
})

describe('trackName', () => {
  it('목소리 이름, 모르는 값은 그대로', () => {
    expect(trackName(3, 'uk_m')).toBe('지문 3 · 영국 남')
    expect(trackName(1, 'xx')).toBe('지문 1 · xx')
  })
})
