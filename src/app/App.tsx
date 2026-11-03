import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { createQueryClient } from './queryClient'
import { routes } from './routes'

const router = createBrowserRouter(routes)

// HMR로 이 모듈이 다시 실행되면 새 router가 생긴다. 이전 router의 history 구독을 끊는다(운영 빌드에서는 제거됨)
import.meta.hot?.dispose(() => router.dispose())

export function App() {
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
