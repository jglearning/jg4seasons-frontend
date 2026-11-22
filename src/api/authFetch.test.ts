import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../mocks/node'
import { createAuthFetch, GET_TIMEOUT_MS } from './authFetch'

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

  it('keepalive 요청은 refresh 뒤 다시 보낼 때도 keepalive(화면을 떠나며 보낸 flush가 끝까지 가게)', async () => {
    // MSW는 요청을 다시 만들며 keepalive를 잃으므로 fetch 호출에서 본다
    const seen: Array<{ path: string; keepalive: boolean }> = []
    let authorized = false
    const authFetch = createAuthFetch({
      fetch: (request) => {
        const path = new URL(request.url).pathname
        seen.push({ path, keepalive: request.keepalive })
        if (path === '/api/v1/auth/refresh') {
          authorized = true
          return Promise.resolve(new Response(null, { status: 200 }))
        }
        return Promise.resolve(new Response(null, { status: authorized ? 200 : 401 }))
      },
    })

    const response = await authFetch(
      new Request(url('/api/v1/listening/flush'), { method: 'POST', body: '{}', keepalive: true }),
    )

    expect(response.status).toBe(200)
    expect(seen.filter((s) => s.path === '/api/v1/listening/flush')).toEqual([
      { path: '/api/v1/listening/flush', keepalive: true },
      { path: '/api/v1/listening/flush', keepalive: true },
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

// 서버가 연결만 받고 답하지 않으면 화면이 불러오는 중에 갇힌다 — GET만 끊는다(#159).
// MSW 대신 fetch를 직접 넘긴다: 응답을 언제 줄지(또는 영영 안 줄지) 테스트가 정하고, 끊긴 요청은 signal로 본다
describe('authFetch — GET 시간 제한', () => {
  type Pending = { request: Request; resolve: (response: Response) => void }

  /** 부르면 응답하지 않고 기다리는 fetch. 끊기면(signal) 그 이유로 실패한다 */
  function hangingFetch() {
    const pending: Pending[] = []
    const fetch = (request: Request) =>
      new Promise<Response>((resolve, reject) => {
        pending.push({ request, resolve })
        request.signal.addEventListener('abort', () => reject(request.signal.reason), {
          once: true,
        })
      })
    return { fetch, pending }
  }

  function settled<T>(promise: Promise<T>) {
    const state = { done: false, error: undefined as unknown }
    promise.then(
      () => (state.done = true),
      (error: unknown) => {
        state.done = true
        state.error = error
      },
    )
    return state
  }

  it('GET이 10초 안에 답하지 않으면 요청을 끊고 TimeoutError로 끝난다', async () => {
    vi.useFakeTimers()
    const { fetch, pending } = hangingFetch()
    const result = settled(createAuthFetch({ fetch })(new Request(url('/api/v1/me'))))

    await vi.advanceTimersByTimeAsync(GET_TIMEOUT_MS - 1)
    expect(result.done).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(result.error).toMatchObject({ name: 'TimeoutError' })
    expect(pending[0]?.request.signal.aborted).toBe(true)
  })

  it('10초 안에 오면 그대로 돌려주고 타이머를 남기지 않는다', async () => {
    vi.useFakeTimers()
    const { fetch, pending } = hangingFetch()
    const response = createAuthFetch({ fetch })(new Request(url('/api/v1/me')))

    await vi.advanceTimersByTimeAsync(GET_TIMEOUT_MS - 1)
    pending[0]?.resolve(new Response('{}', { status: 200 }))

    expect((await response).status).toBe(200)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('상태 변경 요청(POST)은 끊지 않는다 — 서버가 처리했는데 화면만 실패로 보이면 다시 눌러 중복된다', async () => {
    vi.useFakeTimers()
    const { fetch, pending } = hangingFetch()
    const result = settled(
      createAuthFetch({ fetch })(new Request(url('/api/v1/x'), { method: 'POST', body: '{}' })),
    )

    await vi.advanceTimersByTimeAsync(GET_TIMEOUT_MS * 3)
    expect(result.done).toBe(false)
    expect(pending[0]?.request.signal.aborted).toBe(false)

    pending[0]?.resolve(new Response('{}', { status: 200 }))
    await vi.advanceTimersByTimeAsync(0)
    expect(result).toEqual({ done: true, error: undefined })
  })

  it('401 뒤 refresh가 답하지 않아도 GET은 10초에 끝난다(refresh는 다른 요청과 함께 쓰므로 끊지 않는다)', async () => {
    vi.useFakeTimers()
    const { fetch, pending } = hangingFetch()
    const authFetch = createAuthFetch({
      fetch: (request) =>
        new URL(request.url).pathname === '/api/v1/me'
          ? Promise.resolve(new Response(null, { status: 401 }))
          : fetch(request),
    })
    const result = settled(authFetch(new Request(url('/api/v1/me'))))

    await vi.advanceTimersByTimeAsync(GET_TIMEOUT_MS)
    expect(result.error).toMatchObject({ name: 'TimeoutError' })
    const refresh = pending.find((p) => new URL(p.request.url).pathname === '/api/v1/auth/refresh')
    expect(refresh?.request.signal.aborted).toBe(false)

    refresh?.resolve(new Response(null, { status: 503 }))
    await vi.advanceTimersByTimeAsync(0)
  })

  it('refresh 뒤 다시 보낸 요청까지 합쳐 10초', async () => {
    vi.useFakeTimers()
    const { fetch, pending } = hangingFetch()
    let first = true
    const authFetch = createAuthFetch({
      fetch: (request) => {
        const path = new URL(request.url).pathname
        if (path === '/api/v1/auth/refresh') {
          return new Promise((r) => setTimeout(() => r(new Response(null, { status: 200 })), 6_000))
        }
        if (first) {
          first = false
          return Promise.resolve(new Response(null, { status: 401 }))
        }
        return fetch(request)
      },
    })
    const result = settled(authFetch(new Request(url('/api/v1/me'))))

    await vi.advanceTimersByTimeAsync(GET_TIMEOUT_MS - 1)
    expect(pending).toHaveLength(1)
    expect(result.done).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(result.error).toMatchObject({ name: 'TimeoutError' })
    expect(pending[0]?.request.signal.aborted).toBe(true)
  })

  it('부르는 쪽이 취소하면(쿼리 signal) 그 이유로 끝나고 타이머를 남기지 않는다', async () => {
    vi.useFakeTimers()
    const { fetch, pending } = hangingFetch()
    const controller = new AbortController()
    const result = settled(
      createAuthFetch({ fetch })(new Request(url('/api/v1/me'), { signal: controller.signal })),
    )

    controller.abort()
    await vi.advanceTimersByTimeAsync(0)

    expect(result.error).toMatchObject({ name: 'AbortError' })
    expect(pending[0]?.request.signal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('이미 취소된 signal로 부르면 보내지 않는다', async () => {
    const { fetch, pending } = hangingFetch()
    const controller = new AbortController()
    controller.abort()

    await expect(
      createAuthFetch({ fetch })(new Request(url('/api/v1/me'), { signal: controller.signal })),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(pending).toHaveLength(0)
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
