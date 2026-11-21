import { describe, expect, it } from 'vitest'
import { formatHeardAmount, heardAmountMs } from './heardAmount'

const us = (durationMs: number) => ({ variant: 'us_w' as const, durationMs })
const uk = (durationMs: number) => ({ variant: 'uk_m' as const, durationMs })

describe('heardAmountMs — 지문 coverage × 고른 목소리의 음원 길이, 합(#130 → BE #59)', () => {
  it('지문마다 서버 coverage에 고른 목소리 길이를 곱해 더한다', () => {
    const passages = [
      { coverage: 1, voices: [us(60_000), uk(70_000)] },
      { coverage: 0.5, voices: [us(30_000), uk(40_000)] },
    ]

    expect(heardAmountMs(passages, 'uk_m')).toBe(70_000 + 20_000)
    expect(heardAmountMs(passages, 'us_w')).toBe(60_000 + 15_000)
  })

  it('목소리를 섞어 완료해 완료한 목소리가 없어도 지문 coverage만큼 센다', () => {
    expect(heardAmountMs([{ coverage: 0.92, voices: [us(100_000)] }], 'us_w')).toBe(92_000)
  })

  it('고른 목소리가 그 지문에 없으면 첫 목소리(화면이 듣는 목소리와 같게)', () => {
    expect(heardAmountMs([{ coverage: 1, voices: [us(60_000)] }], 'uk_m')).toBe(60_000)
  })

  it('목소리나 지문이 없으면 0', () => {
    expect(heardAmountMs([{ coverage: 1, voices: [] }], 'us_w')).toBe(0)
    expect(heardAmountMs([], 'us_w')).toBe(0)
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
