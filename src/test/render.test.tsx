import { describe, expect, it } from 'vitest'
import { shouldRetry } from '../app/queryClient'
import { createTestQueryClient } from './render'

describe('createTestQueryClient', () => {
  it('재시도 정책은 운영과 같은 함수이고 대기만 0이다', () => {
    const { queries } = createTestQueryClient().getDefaultOptions()

    expect(queries?.retry).toBe(shouldRetry)
    expect(queries?.retryDelay).toBe(0)
    expect(queries?.staleTime).toBe(30_000)
  })
})
