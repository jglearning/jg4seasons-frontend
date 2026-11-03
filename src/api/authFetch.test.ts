import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../mocks/node'
import { createAuthFetch } from './authFetch'

const ORIGIN = 'http://localhost:3000'
const url = (path: string) => `${ORIGIN}${path}`

function setCsrfCookie(value: string) {
  document.cookie = `csrf=${value}; path=/`
}

afterEach(() => {
  document.cookie = 'csrf=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

describe('authFetch — CSRF', () => {
  it('상태 변경 요청에만 csrf 쿠키 값을 X-CSRF로 붙인다', async () => {
    setCsrfCookie('t1')
    const seen: Record<string, string | null> = {}
    server.use(
      http.all(url('/api/v1/echo'), ({ request }) => {
        seen[request.method] = request.headers.get('X-CSRF')
        return HttpResponse.json({})
      }),
    )
    const authFetch = createAuthFetch()

    await authFetch(new Request(url('/api/v1/echo')))
    await authFetch(new Request(url('/api/v1/echo'), { method: 'POST', body: '{}' }))

    expect(seen.GET).toBeNull()
    expect(seen.POST).toBe('t1')
  })
})

describe('authFetch — 401 → refresh', () => {
  it('refresh 한 번 뒤 원 요청을 같은 본문·새 csrf로 다시 보낸다', async () => {
    setCsrfCookie('old')
    const bodies: Array<{ body: string; csrf: string | null }> = []
    let refreshCalls = 0
    let authorized = false
    server.use(
      http.post(url('/api/v1/auth/refresh'), () => {
        refreshCalls++
        authorized = true
        setCsrfCookie('new')
        return new HttpResponse(null, { status: 200 })
      }),
      http.post(url('/api/v1/listening/flush'), async ({ request }) => {
        bodies.push({ body: await request.text(), csrf: request.headers.get('X-CSRF') })
        return authorized
          ? HttpResponse.json({ ok: true })
          : new HttpResponse(null, { status: 401 })
      }),
    )
    const authFetch = createAuthFetch()

    const response = await authFetch(
      new Request(url('/api/v1/listening/flush'), { method: 'POST', body: '{"a":1}' }),
    )

    expect(response.status).toBe(200)
    expect(refreshCalls).toBe(1)
    expect(bodies).toEqual([
      { body: '{"a":1}', csrf: 'old' },
      { body: '{"a":1}', csrf: 'new' },
    ])
  })

  it('동시에 여러 요청이 401을 받아도 refresh는 한 번이다', async () => {
    let refreshCalls = 0
    let authorized = false
    server.use(
      http.post(url('/api/v1/auth/refresh'), async () => {
        refreshCalls++
        await new Promise((r) => setTimeout(r, 20))
        authorized = true
        return new HttpResponse(null, { status: 200 })
      }),
      http.get(url('/api/v1/student/home'), () =>
        authorized ? HttpResponse.json({}) : new HttpResponse(null, { status: 401 }),
      ),
    )
    const authFetch = createAuthFetch()

    const responses = await Promise.all(
      [1, 2, 3].map(() => authFetch(new Request(url('/api/v1/student/home')))),
    )

    expect(responses.map((r) => r.status)).toEqual([200, 200, 200])
    expect(refreshCalls).toBe(1)
  })

  it('refresh가 실패하면 세션 만료를 알리고 원래 401을 돌려준다', async () => {
    const onSessionExpired = vi.fn()
    server.use(
      http.post(url('/api/v1/auth/refresh'), () => new HttpResponse(null, { status: 401 })),
      http.get(url('/api/v1/me'), () => new HttpResponse(null, { status: 401 })),
    )
    const authFetch = createAuthFetch({ onSessionExpired })

    const response = await authFetch(new Request(url('/api/v1/me')))

    expect(response.status).toBe(401)
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('인증 경로(/api/v1/auth/*)의 401은 refresh하지 않는다(로그인 실패를 그대로 돌려준다)', async () => {
    let refreshCalls = 0
    server.use(
      http.post(url('/api/v1/auth/refresh'), () => {
        refreshCalls++
        return new HttpResponse(null, { status: 200 })
      }),
      http.post(url('/api/v1/auth/student/login'), () =>
        HttpResponse.json({ code: 'INVALID_CREDENTIALS' }, { status: 401 }),
      ),
    )
    const authFetch = createAuthFetch()

    const response = await authFetch(
      new Request(url('/api/v1/auth/student/login'), { method: 'POST', body: '{}' }),
    )

    expect(response.status).toBe(401)
    expect(refreshCalls).toBe(0)
  })

  it('다시 보낸 요청도 401이면 더 반복하지 않는다', async () => {
    let refreshCalls = 0
    let calls = 0
    server.use(
      http.post(url('/api/v1/auth/refresh'), () => {
        refreshCalls++
        return new HttpResponse(null, { status: 200 })
      }),
      http.get(url('/api/v1/me'), () => {
        calls++
        return new HttpResponse(null, { status: 401 })
      }),
    )
    const authFetch = createAuthFetch()

    const response = await authFetch(new Request(url('/api/v1/me')))

    expect(response.status).toBe(401)
    expect(calls).toBe(2)
    expect(refreshCalls).toBe(1)
  })
})
