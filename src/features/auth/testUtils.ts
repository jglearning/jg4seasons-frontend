import type { QueryClient } from '@tanstack/react-query'
import type { createMemoryRouter } from 'react-router'
import { expect, vi } from 'vitest'

type Router = ReturnType<typeof createMemoryRouter>

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const

/** 테스트 시작 때 부른다 — 콘솔 출력은 그대로 두고 인자만 기록한다(restoreMocks가 테스트 뒤 되돌림) */
export function watchConsole() {
  for (const method of CONSOLE_METHODS) vi.spyOn(console, method)
}

// 개인 코드·비밀번호가 storage·쿠키·라우터 주소(state 포함)·쿼리/뮤테이션 캐시·콘솔 어디에도 남지 않았는지 본다.
// 비밀값이 목 데이터의 다른 값(예: requestId의 0)과 겹치면 거짓 실패가 나니 겹치지 않는 값을 쓴다
export function expectSecretNowhere(
  secret: string,
  { client, router }: { client: QueryClient; router: Router },
) {
  const stores = [localStorage, sessionStorage].flatMap((storage) =>
    Object.keys(storage).map((key) => `${key}=${storage.getItem(key)}`),
  )
  const queries = client
    .getQueryCache()
    .getAll()
    .map((query) => JSON.stringify([query.queryKey, query.state.data]))
  const mutations = client
    .getMutationCache()
    .getAll()
    .map((mutation) => JSON.stringify([mutation.state.variables, mutation.state.data]))
  const logs = CONSOLE_METHODS.flatMap((method) => {
    const fn = console[method]
    return vi.isMockFunction(fn) ? fn.mock.calls.map((args) => args.map(String).join(' ')) : []
  })

  const entries = [
    ...stores,
    ...queries,
    ...mutations,
    ...logs,
    document.cookie,
    JSON.stringify(router.state.location),
  ]
  for (const entry of entries) expect(entry).not.toContain(secret)
}
