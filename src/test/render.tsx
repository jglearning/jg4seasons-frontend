import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createMemoryRouter, type RouteObject } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { createQueryClient } from '../app/queryClient'

// 화면 테스트용. 테스트마다 새 QueryClient(캐시 공유 없음).
// 재시도 정책(shouldRetry)은 운영과 같게 두고, 재시도 대기만 0으로 줄인다(5xx 화면 테스트가 1초씩 기다리지 않게)
export function createTestQueryClient(): QueryClient {
  const client = createQueryClient()
  const defaults = client.getDefaultOptions()
  client.setDefaultOptions({
    ...defaults,
    queries: { ...defaults.queries, retryDelay: 0 },
    mutations: { ...defaults.mutations, retryDelay: 0 },
  })
  return client
}

export function renderWithClient(ui: ReactElement, client = createTestQueryClient()) {
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) }
}

// 라우트 단위 화면 테스트. 앱의 routes 배열을 그대로 넘긴다(브라우저 라우터를 쓰지 않아 테스트끼리 주소가 이어지지 않는다)
export function renderRoutes(
  routes: RouteObject[],
  { initialEntries = ['/'], client = createTestQueryClient() } = {},
) {
  const router = createMemoryRouter(routes, { initialEntries })
  return {
    client,
    router,
    ...render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  }
}
