import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAuthMock, setMockSession } from '../mocks/handlers'
import { server } from '../mocks/node'
import { renderRoutes } from '../test/render'
import { routes } from './routes'

// 교사·관리자 로그아웃(공통 틀 S4): 이름 아래 "로그아웃" → 확인 없이 바로 → T-01

let sent: Array<{ method: string; path: string }>

beforeEach(() => {
  resetAuthMock()
  setMockSession('teacher')
  sent = []
  server.events.on('request:start', ({ request }) => {
    if (request.method !== 'GET') {
      sent.push({ method: request.method, path: new URL(request.url).pathname })
    }
  })
})

afterEach(() => {
  server.events.removeAllListeners()
})

describe('교사·관리자 로그아웃', () => {
  it('이름 아래 로그아웃 → POST /auth/logout → T-01, 캐시를 비운다', async () => {
    const user = userEvent.setup()
    const { router, client } = renderRoutes(routes, { initialEntries: ['/teacher'] })
    await screen.findByRole('heading', { name: '반 목록', level: 1 })
    const name = await screen.findByText('이선생 · 교사')
    const button = screen.getByRole('button', { name: '로그아웃' })
    expect(name.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(button)

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/teacher/login'))
    expect(sent).toEqual([{ method: 'POST', path: '/api/v1/auth/logout' }])
    expect(client.getQueryData(['me'])).toBeUndefined()
    expect(client.getQueryData(['teacher', 'classes'])).toBeUndefined()
  })

  it('실패하면 화면 그대로 두고 안내, 다시 누를 수 있다', async () => {
    server.use(http.post('*/api/v1/auth/logout', () => HttpResponse.error()))
    const user = userEvent.setup()
    const { router } = renderRoutes(routes, { initialEntries: ['/teacher'] })
    await screen.findByText('이선생 · 교사')

    await user.click(screen.getByRole('button', { name: '로그아웃' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('로그아웃하지 못함. 다시 시도')
    expect(router.state.location.pathname).toBe('/teacher')
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeEnabled()
  })
})
