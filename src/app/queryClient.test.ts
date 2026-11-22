import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/errors'
import { createQueryClient, shouldRetry } from './queryClient'

const problem = (status: number) => new ApiError({ status, code: 'X', title: 't', isProblem: true })

describe('shouldRetry', () => {
  it('Problem Details 4xx·401은 재시도하지 않는다', () => {
    expect(shouldRetry(0, new ApiError({ status: 401, title: 't' }))).toBe(false)
    expect(shouldRetry(0, problem(404))).toBe(false)
    expect(shouldRetry(0, problem(423))).toBe(false)
  })

  it('5xx·네트워크 오류는 한 번만 재시도한다', () => {
    expect(shouldRetry(0, problem(503))).toBe(true)
    expect(shouldRetry(0, new TypeError('Failed to fetch'))).toBe(true)
    expect(shouldRetry(1, problem(503))).toBe(false)
  })

  it('408·429·code 없는 4xx(WAF HTML)는 다시 하면 풀릴 수 있어 한 번 재시도한다(#159)', () => {
    expect(shouldRetry(0, problem(408))).toBe(true)
    expect(shouldRetry(0, problem(429))).toBe(true)
    expect(shouldRetry(0, new ApiError({ status: 403, title: 't' }))).toBe(true)
    expect(shouldRetry(1, problem(429))).toBe(false)
  })

  it('시간 초과는 재시도하지 않는다 — 이미 10초를 기다렸다(#159)', () => {
    expect(shouldRetry(0, new DOMException('늦음', 'TimeoutError'))).toBe(false)
  })
})

// createQueryClient가 실제로 이 정책을 쓰는지(기본값 3회 재시도로 돌아가지 않는지)
describe('createQueryClient 재시도', () => {
  it('Problem Details 4xx면 queryFn을 한 번만 부른다', async () => {
    const error = problem(404)
    const queryFn = vi.fn(async (): Promise<string> => {
      throw error
    })

    await expect(createQueryClient().fetchQuery({ queryKey: ['4xx'], queryFn })).rejects.toBe(error)
    expect(queryFn).toHaveBeenCalledTimes(1)
  })

  it('code 없는 4xx(앞단 HTML)면 한 번 더 시도한다(#159)', async () => {
    vi.useFakeTimers()
    const error = new ApiError({ status: 403, title: 't' })
    const queryFn = vi.fn(async (): Promise<string> => {
      throw error
    })

    const result = createQueryClient().fetchQuery({ queryKey: ['waf'], queryFn })
    result.catch(() => {})
    await vi.advanceTimersByTimeAsync(10_000)

    await expect(result).rejects.toBe(error)
    expect(queryFn).toHaveBeenCalledTimes(2)
  })

  it('5xx면 한 번 더 시도하고 멈춘다', async () => {
    vi.useFakeTimers()
    const error = problem(503)
    const queryFn = vi.fn(async (): Promise<string> => {
      throw error
    })

    const result = createQueryClient().fetchQuery({ queryKey: ['5xx'], queryFn })
    result.catch(() => {})
    await vi.advanceTimersByTimeAsync(10_000)

    await expect(result).rejects.toBe(error)
    expect(queryFn).toHaveBeenCalledTimes(2)
  })
})
