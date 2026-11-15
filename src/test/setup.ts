import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, expect, vi } from 'vitest'
import { server } from '../mocks/node'
import { releaseHeld } from './hold'

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
  // 붙잡아 둔 응답(hold.ts)은 화면을 내린 뒤에 풀어 준다 — 끝나지 않는 요청을 남기지 않게
  releaseHeld()
  server.resetHandlers()
  if (unhandledRequests.length > 0) {
    throw new Error(`목 없는 요청: ${unhandledRequests.splice(0).join(', ')}`)
  }
})

// server.close()를 부르지 않는다(#116). 닫으면 가로채기가 풀려, 마지막 테스트가 남긴 요청(화면이 내려가며
// 다시 받는 쿼리, 끝난 뒤 시작된 요청)이 실제 localhost로 나간다 — 테스트는 통과해서 아무도 모른다.
// 파일마다 새 작업자라 닫지 않아도 다음 파일에 남지 않는다. 지키는 것: realNetworkGuard.ts + lateRequest.test.ts
//
// 닫지 않으면 jsdom이 내려간 뒤에도 남은 요청의 목 응답이 처리된다. 그때 @mswjs/interceptors의 XHR 쪽이
// `initiator instanceof XMLHttpRequest`를 보는데, 그 전역은 jsdom과 함께 지워져 ReferenceError로 실행이 실패했다
// (PR #121 CI 5회 중 1회). 전역 객체의 프로토타입에 같은 이름을 두면 jsdom 것이 지워진 뒤에도 이름이 풀린다
// (jsdom이 있는 동안에는 jsdom 것이 가린다). 아래 "기다림" 뒤에도 취소된 요청의 응답은 늦게 올 수 있어 남겨 둔다.
// 지키는 것: lateResponse.test.ts
const globalFallback = Object.getPrototypeOf(globalThis) as object
if (!Object.hasOwn(globalFallback, 'XMLHttpRequest')) {
  Object.defineProperty(globalFallback, 'XMLHttpRequest', {
    value: class XMLHttpRequestAfterTeardown {},
    configurable: true,
    writable: true,
  })
}

// 파일은 자기가 보낸 요청이 모두 끝난 뒤에 끝난다(#116).
// 목을 닫지 않으니 남은 요청의 응답은 언젠가 도착한다. 그때가 jsdom이 내려간 뒤면 응답을 받은 앱 코드가 이어서 돌다
// 사라진 전역을 찾는다 — `window is not defined`(useSubmit의 finally → setState, PR #121 CI 10회 중 1회).
// 그래서 fetch를 감싸 이 파일의 요청을 세고, afterAll에서 다 끝날 때까지 기다린다. 기다리는 동안은 jsdom이 살아 있다.
// 끝나지 않는 요청이 있으면 어느 테스트의 어떤 요청인지 적어 파일을 실패시킨다(응답을 붙잡는 목은 hold.ts로).
// 가짜 타이머 테스트는 기본 목의 지연(setTimeout 5ms)에 걸린 요청을 남기기 쉽다 — 그 요청도 hold()로 붙잡는다.
const DRAIN_LIMIT_MS = 2000
const DRAIN_STEP_MS = 10
const inFlight = new Map<Promise<void>, string>()

beforeAll(() => {
  const mockedFetch = globalThis.fetch
  globalThis.fetch = (input, init) => {
    const call = mockedFetch(input, init)
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
    const url = input instanceof Request ? input.url : String(input)
    const test = expect.getState().currentTestName ?? '테스트 밖'
    const settled = call.then(
      () => undefined,
      () => undefined,
    )
    inFlight.set(settled, `${method} ${url} (${test})`)
    void settled.then(() => inFlight.delete(settled))
    return call
  }
})

afterAll(async () => {
  // 응답을 받은 코드가 다음 요청을 보낼 수 있어(다시 받기), 0건이 두 번 이어질 때까지 본다
  const deadline = Date.now() + DRAIN_LIMIT_MS
  for (let quiet = 0; quiet < 2;) {
    quiet = inFlight.size === 0 ? quiet + 1 : 0
    if (Date.now() > deadline) {
      throw new Error(`테스트가 끝났는데 끝나지 않은 요청: ${[...inFlight.values()].join(', ')}`)
    }
    await new Promise((resolve) => setTimeout(resolve, DRAIN_STEP_MS))
  }
  // 이 뒤에 시작되는 요청(늦은 타이머)은 응답이 jsdom이 내려간 뒤에 온다 — 보내지 않고 끝나지 않게 둔다
  globalThis.fetch = () => new Promise<Response>(() => {})
  if (unhandledRequests.length > 0) {
    throw new Error(`목 없는 요청(테스트 종료 뒤 도착): ${unhandledRequests.splice(0).join(', ')}`)
  }
})
