import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { server } from '../mocks/node'
import { createApiClient } from './client'
import { unwrap } from './errors'

// 연결만 확인하는 시험용 경로 타입(실제 API 타입이 아니다 — 실제는 src/api/generated)
type TestPaths = {
  '/api/v1/things': {
    parameters: { query?: never; header?: never; path?: never; cookie?: never }
    get?: never
    put?: never
    post: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never }
      requestBody: { content: { 'application/json': { name: string } } }
      responses: {
        200: { headers: Record<string, unknown>; content: { 'application/json': { id: number } } }
      }
    }
    delete?: never
    options?: never
    head?: never
    patch?: never
    trace?: never
  }
}

const ORIGIN = 'http://localhost:3000'

afterEach(() => {
  document.cookie = 'csrf=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

describe('createApiClient', () => {
  it('openapi-fetch 요청이 authFetch를 거친다(X-CSRF, 401 → refresh → 재시도)', async () => {
    document.cookie = 'csrf=c1; path=/'
    let authorized = false
    const seen: Array<string | null> = []
    server.use(
      http.post(`${ORIGIN}/api/v1/auth/refresh`, () => {
        authorized = true
        return new HttpResponse(null, { status: 200 })
      }),
      http.post(`${ORIGIN}/api/v1/things`, async ({ request }) => {
        seen.push(request.headers.get('X-CSRF'))
        return authorized
          ? HttpResponse.json({ id: 7 })
          : HttpResponse.json(
              { code: 'UNAUTHORIZED', title: '다시 들어와 주세요' },
              { status: 401 },
            )
      }),
    )
    const api = createApiClient<TestPaths>({ baseUrl: ORIGIN })

    const data = await unwrap(api.POST('/api/v1/things', { body: { name: 'a' } }))

    expect(data).toEqual({ id: 7 })
    expect(seen).toEqual(['c1', 'c1'])
  })

  it('refresh도 실패하면 Problem Details가 ApiError로 나온다', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v1/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${ORIGIN}/api/v1/things`, () =>
        HttpResponse.json(
          { code: 'UNAUTHORIZED', title: '다시 들어와 주세요' },
          { status: 401, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    const api = createApiClient<TestPaths>({ baseUrl: ORIGIN })

    await expect(unwrap(api.POST('/api/v1/things', { body: { name: 'a' } }))).rejects.toMatchObject(
      {
        status: 401,
        code: 'UNAUTHORIZED',
        title: '다시 들어와 주세요',
      },
    )
  })
})
