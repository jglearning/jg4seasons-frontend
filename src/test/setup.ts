import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from '../mocks/node'

// 목 없는 요청은 그 테스트를 실패시킨다.
// 'error' 전략은 fetch만 실패시켜서, 실패를 잡아 처리하는 코드(예: flush 실패 → 버퍼 유지)는 목이 빠져도 통과한다
const unhandledRequests: string[] = []

beforeAll(() =>
  server.listen({
    onUnhandledFrame({ frame, defaults }) {
      const request = (frame.data as { request?: Request } | undefined)?.request
      unhandledRequests.push(request ? `${request.method} ${request.url}` : frame.protocol)
      defaults.error()
      // 콜백에서 던지면 MSW가 실제 네트워크로 내보내지 않는다
      throw new Error('목 없는 요청')
    },
  }),
)

afterEach(() => {
  // 가짜 타이머를 쓴 테스트가 중간에 실패해도 다음 테스트로 새지 않게, 언마운트 전에 되돌린다
  vi.useRealTimers()
  // globals: false라 Testing Library 자동 cleanup이 걸리지 않는다
  cleanup()
  server.resetHandlers()
  if (unhandledRequests.length > 0) {
    throw new Error(`목 없는 요청: ${unhandledRequests.splice(0).join(', ')}`)
  }
})

afterAll(() => {
  server.close()
  if (unhandledRequests.length > 0) {
    throw new Error(`목 없는 요청(테스트 종료 뒤 도착): ${unhandledRequests.splice(0).join(', ')}`)
  }
})
