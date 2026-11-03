import { describe, expect, it, vi } from 'vitest'
import { createQueryClient, shouldRetry } from './queryClient'

describe('shouldRetry', () => {
  it('4xx는 재시도하지 않는다', () => {
    expect(shouldRetry(0, { status: 401 })).toBe(false)
    expect(shouldRetry(0, { status: 423 })).toBe(false)
  })

  it('5xx·네트워크 오류는 한 번만 재시도한다', () => {
    expect(shouldRetry(0, { status: 503 })).toBe(true)
    expect(shouldRetry(0, new TypeError('Failed to fetch'))).toBe(true)
    expect(shouldRetry(1, { status: 503 })).toBe(false)
  })
})

// createQueryClient가 실제로 이 정책을 쓰는지(기본값 3회 재시도로 돌아가지 않는지)
describe('createQueryClient 재시도', () => {
  it('4xx면 queryFn을 한 번만 부른다', async () => {
    const queryFn = vi.fn(async (): Promise<string> => {
      throw { status: 404 }
    })

    await expect(createQueryClient().fetchQuery({ queryKey: ['4xx'], queryFn })).rejects.toEqual({
      status: 404,
    })
    expect(queryFn).toHaveBeenCalledTimes(1)
  })

  it('5xx면 한 번 더 시도하고 멈춘다', async () => {
    vi.useFakeTimers()
    const queryFn = vi.fn(async (): Promise<string> => {
      throw { status: 503 }
    })

    const result = createQueryClient().fetchQuery({ queryKey: ['5xx'], queryFn })
    result.catch(() => {})
    await vi.advanceTimersByTimeAsync(10_000)

    await expect(result).rejects.toEqual({ status: 503 })
    expect(queryFn).toHaveBeenCalledTimes(2)
  })
})
