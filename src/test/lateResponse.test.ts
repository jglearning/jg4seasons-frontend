import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../mocks/node'

// setup.ts는 afterAll에서 목을 닫지 않는다(#116). 그래서 jsdom이 내려간 뒤에도 남은 요청의 목 응답이 처리된다.
// 그 순서를 여기서 만든다: jsdom 환경이 끝날 때 하는 일(전역 XMLHttpRequest 삭제)을 응답이 오기 전에 한다.
// setup.ts의 대체 이름이 없으면 @mswjs/interceptors가 `instanceof XMLHttpRequest`에서 ReferenceError를 던져
// 실행이 실패한다(PR #121 CI 5회 중 1회 — 테스트는 전부 통과, "Unhandled Rejection" 1건)
describe('jsdom이 내려간 뒤의 목 응답', () => {
  it('전역 XMLHttpRequest가 지워진 뒤에 목 응답이 처리되어도 오류가 없다', async () => {
    const url = 'http://localhost:3000/api/v1/late-response'
    server.use(
      http.get(url, async () => {
        await new Promise((resolve) => setTimeout(resolve, 30))
        return HttpResponse.json({ ok: true })
      }),
    )
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'XMLHttpRequest')
    try {
      const pending = fetch(url)
      delete (globalThis as Record<string, unknown>).XMLHttpRequest
      const response = await pending
      // 응답 뒤처리(라이브러리의 응답 리스너)가 돌 시간
      await new Promise((resolve) => setTimeout(resolve, 30))

      expect(response.status).toBe(200)
      // jsdom 것이 지워져도 이름은 풀린다(전역 프로토타입의 대체 이름)
      expect(typeof XMLHttpRequest).toBe('function')
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'XMLHttpRequest', descriptor)
    }
  })
})
