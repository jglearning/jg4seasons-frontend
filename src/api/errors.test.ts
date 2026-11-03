import { describe, expect, it } from 'vitest'
import { ApiError, toApiError, unwrap } from './errors'
import { shouldRetry } from '../app/queryClient'

describe('toApiError', () => {
  it('Problem Details의 code·title·detail·until·errors를 꺼낸다', () => {
    const error = toApiError(new Response(null, { status: 423 }), {
      type: 'https://jg4seasons.example/problems/locked',
      title: '잠시 잠겼어요',
      status: 423,
      detail: '10:42에 다시 시도할 수 있어요',
      code: 'LOCKED',
      until: '2026-11-04T01:42:00Z',
      requestId: 'r1',
      errors: [{ field: 'personalCode', message: '숫자 4자리' }, { field: 1 }],
    })

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 423,
      code: 'LOCKED',
      title: '잠시 잠겼어요',
      detail: '10:42에 다시 시도할 수 있어요',
      until: '2026-11-04T01:42:00Z',
      requestId: 'r1',
      fieldErrors: [{ field: 'personalCode', message: '숫자 4자리' }],
    })
  })

  it('본문이 Problem Details가 아니면(예: 게이트웨이 HTML) 상태만 살리고 기본 문구를 쓴다', () => {
    const error = toApiError(
      new Response(null, { status: 502, headers: { 'X-Request-Id': 'gw-1' } }),
      '<html>Bad Gateway</html>',
    )

    expect(error).toMatchObject({
      status: 502,
      code: undefined,
      title: '잠시 후 다시 시도해 주세요',
    })
    expect(error.requestId).toBe('gw-1')
  })

  it('쿼리 재시도 정책과 이어진다: 4xx ApiError는 재시도하지 않고 5xx는 한 번 한다', () => {
    expect(shouldRetry(0, toApiError(new Response(null, { status: 401 }), {}))).toBe(false)
    expect(shouldRetry(0, toApiError(new Response(null, { status: 503 }), {}))).toBe(true)
  })
})

describe('unwrap', () => {
  it('성공이면 data를 돌려준다', async () => {
    await expect(
      unwrap(Promise.resolve({ data: { id: 1 }, response: new Response(null, { status: 200 }) })),
    ).resolves.toEqual({ id: 1 })
  })

  it('실패면 ApiError를 던진다', async () => {
    await expect(
      unwrap(
        Promise.resolve({
          error: { code: 'INVALID_CREDENTIALS', title: '코드를 확인해 주세요' },
          response: new Response(null, { status: 401 }),
        }),
      ),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' })
  })
})
