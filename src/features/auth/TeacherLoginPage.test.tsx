import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../../app/routes'
import { AUTH_MOCK, resetAuthMock } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { renderRoutes } from '../../test/render'
import { expectSecretNowhere, watchConsole } from './testUtils'

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
  watchConsole()
})

function renderLogin() {
  return renderRoutes(routes, { initialEntries: ['/teacher/login'] })
}

describe('T-01 교사 로그인', () => {
  it('성공하면 교사 첫 화면으로 가고, 비밀번호는 어디에도 남지 않는다', async () => {
    const { router, client } = renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('아이디'), ' Teacher01 ')
    await user.type(screen.getByLabelText('비밀번호'), AUTH_MOCK.staffPassword)
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByRole('heading', { name: '반 목록', level: 1 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/teacher')
    expect(Object.keys(localStorage)).toHaveLength(0)
    expectSecretNowhere(AUTH_MOCK.staffPassword, { client, router })
  })

  it('운영자(superadmin)는 운영자 화면(O-01)으로 간다 — 학원 화면 API는 운영자에게 403', async () => {
    const { router } = renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('아이디'), 'super01')
    await user.type(screen.getByLabelText('비밀번호'), `${AUTH_MOCK.staffPassword}{Enter}`)

    expect(await screen.findByRole('heading', { name: '학원 관리', level: 1 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/system/academies')
  })

  it('로그인하면 이전 사용자의 캐시를 비운다(같은 PC를 다른 교사가 쓸 때)', async () => {
    const { client } = renderLogin()
    client.setQueryData(['teacher', 'classes'], { previous: true })
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('아이디'), 'teacher01')
    await user.type(screen.getByLabelText('비밀번호'), `${AUTH_MOCK.staffPassword}{Enter}`)

    expect(await screen.findByRole('heading', { name: '반 목록', level: 1 })).toBeInTheDocument()
    expect(client.getQueryData(['teacher', 'classes'])).toBeUndefined()
  })

  it('틀리면 문구를 보이고 비밀번호만 비운다', async () => {
    const { router } = renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('아이디'), 'teacher01')
    await user.type(screen.getByLabelText('비밀번호'), 'wrong')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByText('아이디 또는 비밀번호가 맞지 않습니다')).toBeInTheDocument()
    expect(screen.getByLabelText('아이디')).toHaveValue('teacher01')
    expect(screen.getByLabelText('비밀번호')).toHaveValue('')
    expect(screen.getByRole('button', { name: '로그인' })).toBeDisabled()
    expect(router.state.location.pathname).toBe('/teacher/login')
    // 버튼을 눌러 실패해도 바로 비밀번호를 다시 칠 수 있다
    expect(screen.getByLabelText('비밀번호')).toHaveFocus()
  })

  it('잠기면(423) 서버의 title과 해제 시각을 보인다', async () => {
    renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('아이디'), AUTH_MOCK.lockedLoginId)
    await user.type(screen.getByLabelText('비밀번호'), AUTH_MOCK.staffPassword)
    await user.keyboard('{Enter}')

    // until 2026-11-11T06:42:00Z = 한국 오후 3시 42분. 고정 문구인 detail 대신 시각
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(AUTH_MOCK.lockedTitle)
    expect(alert).toHaveTextContent('오후 3시 42분 이후 다시 로그인 가능')
    expect(alert).not.toHaveTextContent(AUTH_MOCK.lockedDetail)
    expect(screen.getByLabelText('비밀번호')).toHaveValue('')
    expect(screen.getByLabelText('비밀번호')).toHaveFocus()
  })

  it('Enter를 여러 번 눌러도 요청은 한 번만 나간다', async () => {
    let requests = 0
    let release: () => void = () => {}
    server.use(
      http.post('*/api/v1/auth/staff/login', async () => {
        requests++
        await new Promise<void>((resolve) => (release = resolve))
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('아이디'), 'teacher01')
    await user.type(screen.getByLabelText('비밀번호'), 'pw{Enter}{Enter}{Enter}')

    expect(await screen.findByRole('button', { name: '로그인 중' })).toBeDisabled()
    expect(requests).toBe(1)
    release()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
