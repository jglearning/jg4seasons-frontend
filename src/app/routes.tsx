import type { RouteObject } from 'react-router'
import { NotFound } from './NotFound'

// 화면 라우트는 각 화면 이슈에서 추가한다. '/'는 S-01 전까지 임시
export const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <main style={{ padding: 'var(--space-8) var(--gutter-student)' }}>
        <h1>제이G 4 Seasons</h1>
      </main>
    ),
  },
  { path: '*', element: <NotFound /> },
]
