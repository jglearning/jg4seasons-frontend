import { describe, expect, it } from 'vitest'
import { ApiError } from '../../api/errors'
import { MAX_WAIT_MS, rateLimitDeadline, secondsLeft } from './rateLimitWait'

const NOW = Date.parse('2026-11-20T05:00:00Z')
const limited = (until?: string) =>
  new ApiError({ status: 429, code: 'RATE_LIMITED', title: '잠시 후 다시 시도해 주세요', until })

describe('rateLimitDeadline — 429의 until까지 기다릴 끝 시각(#133)', () => {
  it('until이 앞이면 그 시각', () => {
    expect(rateLimitDeadline(limited('2026-11-20T05:00:42Z'), NOW)).toBe(NOW + 42_000)
  })

  it('60초보다 멀면 60초로 자른다(기기 시계가 틀린 경우)', () => {
    expect(rateLimitDeadline(limited('2026-11-20T09:00:00Z'), NOW)).toBe(NOW + MAX_WAIT_MS)
  })

  it('until이 없거나, 읽을 수 없거나, 이미 지났으면 기다리지 않는다', () => {
    expect(rateLimitDeadline(limited(), NOW)).toBeUndefined()
    expect(rateLimitDeadline(limited('곧'), NOW)).toBeUndefined()
    expect(rateLimitDeadline(limited('2026-11-20T04:59:59Z'), NOW)).toBeUndefined()
    expect(rateLimitDeadline(limited('2026-11-20T05:00:00Z'), NOW)).toBeUndefined()
  })

  it('429가 아니면 until이 있어도 기다리지 않는다(423 잠금은 따로 보인다)', () => {
    const locked = new ApiError({
      status: 423,
      code: 'LOCKED',
      title: '잠시 후 다시 시도해 주세요',
      until: '2026-11-20T05:10:00Z',
    })

    expect(rateLimitDeadline(locked, NOW)).toBeUndefined()
    expect(rateLimitDeadline(new TypeError('Failed to fetch'), NOW)).toBeUndefined()
  })
})

describe('secondsLeft', () => {
  it('남은 초를 올림한다 — 41.2초 남았으면 42', () => {
    expect(secondsLeft(NOW + 42_000, NOW)).toBe(42)
    expect(secondsLeft(NOW + 42_000, NOW + 800)).toBe(42)
    expect(secondsLeft(NOW + 42_000, NOW + 1_000)).toBe(41)
    expect(secondsLeft(NOW + 42_000, NOW + 41_999)).toBe(1)
  })

  it('끝 시각이거나 지났으면 0', () => {
    expect(secondsLeft(NOW + 42_000, NOW + 42_000)).toBe(0)
    expect(secondsLeft(NOW + 42_000, NOW + 50_000)).toBe(0)
  })
})
