import { describe, expect, it } from 'vitest'
import { dateRange, longDate, shortDate } from './dates'

describe('날짜 표시(05 §7)', () => {
  it.each([
    ['2026-12-15', '12/15 (화)'],
    ['2026-12-19', '12/19 (토)'],
    ['2027-01-03', '1/3 (일)'],
    ['2028-02-29', '2/29 (화)'],
  ])('shortDate %s → %s', (date, shown) => {
    expect(shortDate(date)).toBe(shown)
  })

  it('longDate는 "12월 19일 (토)"', () => {
    expect(longDate('2026-12-19')).toBe('12월 19일 (토)')
  })

  it('기간은 요일 없이', () => {
    expect(dateRange('2026-12-10', '2027-01-02')).toBe('12/10 ~ 1/2')
  })

  it.each(['2026-02-30', '2026-12-19T00:00:00Z', '12/19', ''])(
    '읽을 수 없는 값(%s)은 받은 글자 그대로',
    (date) => {
      expect(shortDate(date)).toBe(date)
      expect(longDate(date)).toBe(date)
    },
  )
})
