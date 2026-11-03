import { describe, expect, it } from 'vitest'
import { createTestQueryClient } from './render'

describe('createTestQueryClient', () => {
  it('재시도 정책은 운영과 같고 대기만 0이다', () => {
    const { queries } = createTestQueryClient().getDefaultOptions()

    expect(queries?.retryDelay).toBe(0)
    expect(typeof queries?.retry).toBe('function')
    expect(queries?.staleTime).toBe(30_000)
  })
})
