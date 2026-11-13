import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { setSessionExpiredHandler } from '../../api'
import { server } from '../../mocks/node'
import { renewAudioAccess } from './audioAccess'

// 음원 403 뒤 refresh 한 번(BE ADR-28). refresh 자체가 401·403이면 세션이 끝난 것 —
// "다시 불러오기"만 되풀이하지 않고 앱의 세션 만료 처리(입장 화면)로 보낸다
const refreshReturns = (status: number) =>
  server.use(http.post('*/api/v1/auth/refresh', () => new HttpResponse(null, { status })))

let expired: ReturnType<typeof vi.fn<() => void>>
let unregister: () => void
let logged: MockInstance<Console['error']>

beforeEach(() => {
  expired = vi.fn<() => void>()
  unregister = setSessionExpiredHandler(expired)
  logged = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  unregister()
  logged.mockRestore()
})

describe('renewAudioAccess', () => {
  it("refresh가 성공하면 'ok', 세션은 그대로", async () => {
    refreshReturns(200)

    expect(await renewAudioAccess()).toBe('ok')
    expect(expired).not.toHaveBeenCalled()
    expect(logged).not.toHaveBeenCalled()
  })

  it.each([401, 403])("refresh가 %i이면 세션 만료 처리로 보내고 'expired'", async (status) => {
    refreshReturns(status)

    expect(await renewAudioAccess()).toBe('expired')
    expect(expired).toHaveBeenCalledTimes(1)
    expect(logged).toHaveBeenCalledWith('[audio] 음원 접근 갱신 실패', { reason: 'expired' })
  })

  it("5xx면 세션은 두고 'failed', 이유(상태)를 기록한다", async () => {
    refreshReturns(503)

    expect(await renewAudioAccess()).toBe('failed')
    expect(expired).not.toHaveBeenCalled()
    expect(logged).toHaveBeenCalledWith('[audio] 음원 접근 갱신 실패', {
      reason: 'status',
      status: 503,
    })
  })

  it("리다이렉트를 따라가지 않는다 — 그 끝의 200 HTML을 성공으로 보지 않고 'failed'", async () => {
    server.use(
      http.post(
        '*/api/v1/auth/refresh',
        () => new HttpResponse(null, { status: 302, headers: { Location: '/login-page' } }),
      ),
      http.all('*/login-page', () => HttpResponse.html('<html></html>')),
    )

    expect(await renewAudioAccess()).toBe('failed')
    expect(expired).not.toHaveBeenCalled()
    expect(logged).toHaveBeenCalledWith(
      '[audio] 음원 접근 갱신 실패',
      expect.objectContaining({ reason: 'status' }),
    )
  })

  it("네트워크 오류면 세션은 두고 'failed', 이유와 오류 이름을 기록한다", async () => {
    server.use(http.post('*/api/v1/auth/refresh', () => HttpResponse.error()))

    expect(await renewAudioAccess()).toBe('failed')
    expect(expired).not.toHaveBeenCalled()
    expect(logged).toHaveBeenCalledWith('[audio] 음원 접근 갱신 실패', {
      reason: 'network',
      name: 'TypeError',
    })
  })
})
