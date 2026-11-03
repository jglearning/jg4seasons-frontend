import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../mocks/node'
import { createApiClient } from './client'
import { unwrap } from './errors'

// 연결만 확인하는 시험용 경로 타입(실제 API 타입이 아니다 — 실제는 src/api/generated)
type Operation<Body, Data> = {
  parameters: { query?: never; header?: never; path?: never; cookie?: never }
  requestBody: { content: { 'application/json': Body } }
  responses: {
    200: { headers: Record<string, unknown>; content: { 'application/json': Data } }
  }
}
type Path<Post> = {
  parameters: { query?: never; header?: never; path?: never; cookie?: never }
  get?: never
  put?: never
  post: Post
  delete?: never
  options?: never
  head?: never
  patch?: never
  trace?: never
}
type TestPaths = { '/api/v1/things': Path<Operation<{ name: string }, { id: number }>> }

afterEach(() => {
  document.cookie = 'csrf=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

describe('createApiClient', () => {
  it('기본 baseUrl(현재 origin)로 상대 경로 요청이 테스트 환경에서도 나간다', async () => {
    server.use(http.post('*/api/v1/things', () => HttpResponse.json({ id: 1 })))
    const api = createApiClient<TestPaths>({ onSessionExpired: vi.fn() })

    await expect(unwrap(api.POST('/api/v1/things', { body: { name: 'a' } }))).resolves.toEqual({
      id: 1,
    })
  })

  it('openapi-fetch 요청이 authFetch를 거친다(X-CSRF, 401 → refresh → 재시도)', async () => {
    document.cookie = 'csrf=c1; path=/'
    let authorized = false
    const seen: Array<string | null> = []
    server.use(
      http.post('*/api/v1/auth/refresh', () => {
        authorized = true
        return new HttpResponse(null, { status: 200 })
      }),
      http.post('*/api/v1/things', ({ request }) => {
        seen.push(request.headers.get('X-CSRF'))
        return authorized
          ? HttpResponse.json({ id: 7 })
          : HttpResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 })
      }),
    )
    const api = createApiClient<TestPaths>({ onSessionExpired: vi.fn() })

    const data = await unwrap(api.POST('/api/v1/things', { body: { name: 'a' } }))

    expect(data).toEqual({ id: 7 })
    expect(seen).toEqual(['c1', 'c1'])
  })

  it('refresh도 만료면 세션 만료를 알리고 Problem Details가 ApiError로 나온다', async () => {
    const onSessionExpired = vi.fn()
    server.use(
      http.post('*/api/v1/auth/refresh', () => new HttpResponse(null, { status: 401 })),
      http.post('*/api/v1/things', () =>
        HttpResponse.json(
          { code: 'UNAUTHORIZED', title: '다시 들어와 주세요' },
          { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    const api = createApiClient<TestPaths>({ onSessionExpired })

    await expect(unwrap(api.POST('/api/v1/things', { body: { name: 'a' } }))).rejects.toMatchObject(
      { status: 401, code: 'UNAUTHORIZED', title: '다시 들어와 주세요' },
    )
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('성공인데 본문이 HTML이면(배포 설정 실수) 상태를 담은 BAD_RESPONSE로 나온다', async () => {
    server.use(
      http.post('*/api/v1/things', () =>
        HttpResponse.html('<!doctype html><title>앱</title>', {
          headers: { 'X-Request-Id': 'r9' },
        }),
      ),
    )
    const api = createApiClient<TestPaths>({ onSessionExpired: vi.fn() })

    await expect(unwrap(api.POST('/api/v1/things', { body: { name: 'a' } }))).rejects.toMatchObject(
      { status: 200, code: 'BAD_RESPONSE', requestId: 'r9' },
    )
  })
})
