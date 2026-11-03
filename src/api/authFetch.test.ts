import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../mocks/node'
import { createAuthFetch } from './authFetch'

const ORIGIN = 'http://localhost:3000'
const url = (path: string) => `${ORIGIN}${path}`

function setCsrfCookie(value: string) {
  document.cookie = `csrf=${value}; path=/`
}

function clearCsrfCookie() {
  document.cookie = 'csrf=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

afterEach(clearCsrfCookie)

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

describe('authFetch — 401 → refresh → 재시도', () => {
  it('refresh 한 번 뒤 원 요청을 같은 본문·Content-Type·새 csrf로 다시 보낸다', async () => {
    setCsrfCookie('old')
    const seen: Array<{ body: string; csrf: string | null; type: string | null }> = []
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
        seen.push({
          body: await request.text(),
          csrf: request.headers.get('X-CSRF'),
          type: request.headers.get('Content-Type'),
        })
        return authorized
          ? HttpResponse.json({ ok: true })
          : new HttpResponse(null, { status: 401 })
      }),
    )
    const authFetch = createAuthFetch()

    const response = await authFetch(
      new Request(url('/api/v1/listening/flush'), {
        method: 'POST',
        body: '{"a":1}',
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    expect(response.status).toBe(200)
    expect(refreshCalls).toBe(1)
    expect(seen).toEqual([
      { body: '{"a":1}', csrf: 'old', type: 'application/json' },
      { body: '{"a":1}', csrf: 'new', type: 'application/json' },
    ])
  })

  it('refresh 뒤 csrf 쿠키가 없으면 예전 X-CSRF를 싣고 가지 않는다', async () => {
    setCsrfCookie('old')
    const seen: Array<string | null> = []
    let authorized = false
    server.use(
      http.post(url('/api/v1/auth/refresh'), () => {
        authorized = true
        clearCsrfCookie()
        return new HttpResponse(null, { status: 200 })
      }),
      http.post(url('/api/v1/x'), ({ request }) => {
        seen.push(request.headers.get('X-CSRF'))
        return authorized ? HttpResponse.json({}) : new HttpResponse(null, { status: 401 })
      }),
    )

    await createAuthFetch()(new Request(url('/api/v1/x'), { method: 'POST', body: '{}' }))

    expect(seen).toEqual(['old', null])
  })

  it('refresh를 기다리는 동안 원 요청이 취소되면 다시 보내지 않고 AbortError로 끝난다', async () => {
    const controller = new AbortController()
    let calls = 0
    server.use(
      http.post(url('/api/v1/auth/refresh'), () => {
        controller.abort()
        return new HttpResponse(null, { status: 200 })
      }),
      http.get(url('/api/v1/me'), () => {
        calls++
        return new HttpResponse(null, { status: 401 })
      }),
    )

    await expect(
      createAuthFetch()(new Request(url('/api/v1/me'), { signal: controller.signal })),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(calls).toBe(1)
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

    const response = await createAuthFetch()(
      new Request(url('/api/v1/auth/student/login'), { method: 'POST', body: '{}' }),
    )

    expect(response.status).toBe(401)
    expect(refreshCalls).toBe(0)
  })
})

describe('authFetch — refresh가 실패할 때', () => {
  it('refresh 401(만료)이면 세션 만료를 한 번 알리고 원래 401을 돌려준다', async () => {
    const onSessionExpired = vi.fn()
    server.use(
      http.post(url('/api/v1/auth/refresh'), () => new HttpResponse(null, { status: 401 })),
      http.get(url('/api/v1/me'), () => new HttpResponse(null, { status: 401 })),
    )

    const response = await createAuthFetch({ onSessionExpired })(new Request(url('/api/v1/me')))

    expect(response.status).toBe(401)
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('동시 요청 셋이 같은 refresh 실패를 받아도 세션 만료 알림은 한 번이다', async () => {
    const onSessionExpired = vi.fn()
    server.use(
      http.post(url('/api/v1/auth/refresh'), async () => {
        await new Promise((r) => setTimeout(r, 20))
        return new HttpResponse(null, { status: 401 })
      }),
      http.get(url('/api/v1/student/home'), () => new HttpResponse(null, { status: 401 })),
    )
    const authFetch = createAuthFetch({ onSessionExpired })

    await Promise.all([1, 2, 3].map(() => authFetch(new Request(url('/api/v1/student/home')))))

    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('refresh가 네트워크 오류면 세션을 끝내지 않고 오류를 그대로 던지며, 다음 401에서 refresh를 다시 한다', async () => {
    const onSessionExpired = vi.fn()
    let refreshFails = true
    let authorized = false
    server.use(
      http.post(url('/api/v1/auth/refresh'), () => {
        if (refreshFails) return HttpResponse.error()
        authorized = true
        return new HttpResponse(null, { status: 200 })
      }),
      http.get(url('/api/v1/me'), () =>
        authorized ? HttpResponse.json({}) : new HttpResponse(null, { status: 401 }),
      ),
    )
    const authFetch = createAuthFetch({ onSessionExpired })

    await expect(authFetch(new Request(url('/api/v1/me')))).rejects.toBeInstanceOf(TypeError)
    expect(onSessionExpired).not.toHaveBeenCalled()

    refreshFails = false
    const response = await authFetch(new Request(url('/api/v1/me')))
    expect(response.status).toBe(200)
  })

  it('refresh가 5xx면 세션을 끝내지 않고, 기다린 요청마다 그 5xx를 돌려준다', async () => {
    const onSessionExpired = vi.fn()
    server.use(
      http.post(url('/api/v1/auth/refresh'), async () => {
        await new Promise((r) => setTimeout(r, 20))
        return HttpResponse.json({ code: 'UNAVAILABLE' }, { status: 503 })
      }),
      http.get(url('/api/v1/student/home'), () => new HttpResponse(null, { status: 401 })),
    )
    const authFetch = createAuthFetch({ onSessionExpired })

    const responses = await Promise.all(
      [1, 2].map(() => authFetch(new Request(url('/api/v1/student/home')))),
    )

    expect(responses.map((r) => r.status)).toEqual([503, 503])
    expect(await Promise.all(responses.map((r) => r.json()))).toEqual([
      { code: 'UNAVAILABLE' },
      { code: 'UNAVAILABLE' },
    ])
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('refresh는 성공했는데 다시 보낸 요청도 401이면 더 반복하지 않고 세션 만료를 알린다', async () => {
    const onSessionExpired = vi.fn()
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

    const response = await createAuthFetch({ onSessionExpired })(new Request(url('/api/v1/me')))

    expect(response.status).toBe(401)
    expect(calls).toBe(2)
    expect(refreshCalls).toBe(1)
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })
})
