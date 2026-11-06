import { describe, expect, it } from 'vitest'
import { findSentence, heardSentences } from './sentenceSync'

// 문장 1: 0~1000, (간격 500) 문장 2: 1500~3000, 문장 3: 3500~4000
const timings = [
  [0, 1000],
  [1500, 3000],
  [3500, 4000],
]

describe('findSentence — 재생 위치의 문장(timings는 서버 값)', () => {
  it('문장 안이면 그 문장', () => {
    expect(findSentence(timings, 0)).toBe(0)
    expect(findSentence(timings, 999)).toBe(0)
    expect(findSentence(timings, 1500)).toBe(1)
    expect(findSentence(timings, 3999)).toBe(2)
  })

  it('문장 사이 간격에서는 앞 문장을 그대로(강조가 깜빡이지 않게)', () => {
    expect(findSentence(timings, 1200)).toBe(0)
    expect(findSentence(timings, 3200)).toBe(1)
  })

  it('끝을 지나면 마지막 문장, 첫 문장 시작 전이면 첫 문장', () => {
    expect(findSentence(timings, 9000)).toBe(2)
    expect(findSentence([[300, 900]], 100)).toBe(0)
  })

  it('문장이 없으면 -1', () => {
    expect(findSentence([], 500)).toBe(-1)
  })
})

describe('heardSentences — 문장 구간의 80% 이상을 들었으면 "들음"(표시용)', () => {
  it('들은 구간이 문장을 80% 이상 덮으면 true, 못 미치면 false', () => {
    // 문장 2(1500~3000, 1500ms): 1500~2700 = 1200ms = 80% → 들음
    expect(heardSentences(timings, [[1500, 2700]])).toEqual([false, true, false])
    // 1500~2690 = 1190ms < 80%
    expect(heardSentences(timings, [[1500, 2690]])).toEqual([false, false, false])
  })

  it('여러 조각을 합쳐서 센다(겹친 곳은 한 번만)', () => {
    // 문장 2: 1500~2000 + 1800~2400 + 2500~3000 = 500+400+500 → 1400ms
    expect(
      heardSentences(timings, [
        [1500, 2000],
        [1800, 2400],
        [2500, 3000],
      ]),
    ).toEqual([false, true, false])
  })

  it('같은 곳을 두 번 들어도 한 번만 센다(겹쳐 세면 80%를 넘어 버린다)', () => {
    // 문장 2(1500~3000): 1500~2400 = 900ms(60%). 겹친 1600~2400을 또 세면 1700ms가 되어 버린다
    expect(
      heardSentences(timings, [
        [1500, 2400],
        [1600, 2400],
      ]),
    ).toEqual([false, false, false])
  })

  it('문장 밖(간격)을 들은 것은 세지 않는다', () => {
    // 문장 3(3500~4000): 3000~3800 중 문장 안은 300ms = 60%
    expect(heardSentences(timings, [[3000, 3800]])).toEqual([false, false, false])
  })

  it('한 구간이 여러 문장을 덮으면 각각', () => {
    expect(heardSentences(timings, [[0, 4000]])).toEqual([true, true, true])
  })

  it('들은 것이 없거나 길이 0인 문장은 false', () => {
    expect(heardSentences(timings, [])).toEqual([false, false, false])
    expect(heardSentences([[500, 500]], [[0, 1000]])).toEqual([false])
  })
})
