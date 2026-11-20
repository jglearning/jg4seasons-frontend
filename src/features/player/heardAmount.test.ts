import { describe, expect, it } from 'vitest'
import { formatHeardAmount, heardAmountMs } from './heardAmount'

const voice = (durationMs: number, completed: boolean) => ({ durationMs, completed })

describe('heardAmountMs — 완료한 목소리의 음원 길이 합(#130)', () => {
  it('완료한 목소리만 더한다', () => {
    const passages = [
      { voices: [voice(60_000, true), voice(61_000, false)] },
      { voices: [voice(30_000, false), voice(31_000, false)] },
      { voices: [voice(45_500, true)] },
    ]

    expect(heardAmountMs(passages)).toBe(105_500)
  })

  it('한 지문에 완료한 목소리가 둘이면 둘 다 더한다', () => {
    expect(heardAmountMs([{ voices: [voice(60_000, true), voice(62_000, true)] }])).toBe(122_000)
  })

  it('완료한 목소리가 없거나 지문이 없으면 0', () => {
    expect(heardAmountMs([{ voices: [voice(60_000, false)] }, { voices: [] }])).toBe(0)
    expect(heardAmountMs([])).toBe(0)
  })
})

describe('formatHeardAmount', () => {
  it('분과 초', () => {
    expect(formatHeardAmount(372_000)).toBe('6분 12초')
  })

  it('1분 미만은 초만', () => {
    expect(formatHeardAmount(45_000)).toBe('45초')
  })

  it('초가 0이면 분만', () => {
    expect(formatHeardAmount(360_000)).toBe('6분')
  })

  it('초 단위로 반올림한다 — 59.6초는 1분', () => {
    expect(formatHeardAmount(372_400)).toBe('6분 12초')
    expect(formatHeardAmount(59_600)).toBe('1분')
  })
})
