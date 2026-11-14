import { describe, expect, it } from 'vitest'
import { shortDate } from './dates'

describe('shortDate — 학원 날짜를 "월/일 (요일)"로', () => {
  it('2026-11-05 → 11/5 (목)', () => {
    expect(shortDate('2026-11-05')).toBe('11/5 (목)')
    expect(shortDate('2026-12-19')).toBe('12/19 (토)')
  })

  it('읽을 수 없거나 없는 날짜면 받은 글자 그대로', () => {
    expect(shortDate('2026-11-5')).toBe('2026-11-5')
    expect(shortDate('2026-02-30')).toBe('2026-02-30')
    expect(shortDate('')).toBe('')
  })
})
