import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../mocks/node'

// vite.config.ts test.fakeTimers(setImmediate를 가짜로 바꾸지 않음)의 회귀 테스트.
// MSW 3은 가로챈 소켓에 setImmediate 한 번 안에 요청 바이트가 오지 않으면 실제 네트워크로 넘긴다.
// 가짜 setImmediate가 undici의 쓰기보다 먼저 돌면 목이 있는 요청이 localhost로 나간다(느린 CI에서 EntryPage가 흔들린 원인).
// 여기서는 그 경쟁을 일부러 지게 만든다 — 요청 직후 가짜 타이머를 계속 비운다
// 붙잡은 응답은 테스트가 끝날 때 푼다(끝나지 않는 Promise를 남기지 않는다)
let release = () => {}
afterEach(() => {
  vi.useRealTimers()
  release()
})

describe('가짜 타이머와 MSW', () => {
  it('가짜 타이머를 계속 돌려도 응답을 붙잡은 목의 요청은 실제 네트워크로 나가지 않는다', async () => {
    server.use(
      http.get(
        '*/api/v1/fake-timer-probe',
        () =>
          new Promise<Response>((resolve) => {
            release = () => resolve(HttpResponse.json({}, { status: 503 }))
          }),
      ),
    )
    vi.useFakeTimers()
    let settled: unknown
    void fetch('http://localhost:3000/api/v1/fake-timer-probe').then(
      (response) => (settled = response),
      (error: unknown) => (settled = error),
    )
    for (let i = 0; i < 2000; i++) {
      await Promise.resolve()
      vi.runOnlyPendingTimers()
    }
    vi.useRealTimers()
    // 실제 연결 거절은 수십 ms 안에 온다
    await new Promise((resolve) => setTimeout(resolve, 300))

    expect(settled).toBeUndefined()
  })
})
