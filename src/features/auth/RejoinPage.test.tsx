import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../../app/routes'
import { AUTH_MOCK, resetAuthMock } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { renderRoutes } from '../../test/render'
import { readJoinCode, saveJoinCode } from './joinCode'
import { expectSecretNowhere, watchConsole } from './testUtils'

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
  watchConsole()
})

function renderRejoin() {
  return renderRoutes(routes, { initialEntries: ['/rejoin'] })
}

async function pressDigits(user: ReturnType<typeof userEvent.setup>, digits: string) {
  for (const digit of digits) await user.click(screen.getByRole('button', { name: digit }))
}

describe('S-02 다시 들어오기', () => {
  it('저장된 가입 코드가 없으면 S-01로 간다', async () => {
    const { router } = renderRejoin()

    expect(await screen.findByRole('heading', { name: /코드 두 개로/ })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/join')
  })

  it('저장된 반을 보여 주고, 키패드로 4자리를 누르면 바로 들어간다', async () => {
    saveJoinCode(AUTH_MOCK.joinCode)
    const { router, client } = renderRejoin()
    const user = userEvent.setup()

    expect(
      await screen.findByText(`${AUTH_MOCK.className} · ${AUTH_MOCK.academyName}`),
    ).toBeInTheDocument()
    await pressDigits(user, AUTH_MOCK.personalCode)

    expect(
      await screen.findByRole('heading', { name: '홈 화면은 준비 중이에요' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expectSecretNowhere(AUTH_MOCK.personalCode, { client, router })
  })

  it('틀리면 칸을 비우고 문구를 보이며 이 화면에 남는다', async () => {
    saveJoinCode(AUTH_MOCK.joinCode)
    const { router } = renderRejoin()
    const user = userEvent.setup()

    await pressDigits(user, '12')
    await user.click(screen.getByRole('button', { name: '한 글자 지우기' }))
    expect(screen.getByLabelText('개인 코드')).toHaveValue('1')
    await pressDigits(user, '999')

    expect(await screen.findByText('가입 코드 또는 개인 코드가 맞지 않아요')).toBeInTheDocument()
    expect(screen.getByLabelText('개인 코드')).toHaveValue('')
    expect(router.state.location.pathname).toBe('/rejoin')
    expect(readJoinCode()).toBe(AUTH_MOCK.joinCode)
  })

  it('저장된 가입 코드를 서버가 모르면(404) 지우고 S-01에서 안내한다', async () => {
    saveJoinCode('AAAABBBB')
    const { router } = renderRejoin()

    expect(await screen.findByText(/저장된 가입 코드를 쓸 수 없어요/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/join')
    expect(readJoinCode()).toBeUndefined()
  })

  it('S-01로 넘어온 안내는 새 코드를 치기 시작하면 사라진다', async () => {
    saveJoinCode('AAAABBBB')
    renderRejoin()
    const user = userEvent.setup()

    await screen.findByText(/저장된 가입 코드를 쓸 수 없어요/)
    await user.type(screen.getByLabelText(/가입 코드/), 'G7')

    expect(screen.queryByText(/저장된 가입 코드를 쓸 수 없어요/)).not.toBeInTheDocument()
  })

  it('저장값이 형식에 맞지 않으면(소문자 등) 저장된 반이 없는 것으로 보고 S-01로 간다', async () => {
    localStorage.setItem('jg4s.joinCode', 'g7km2xp4')
    const { router } = renderRejoin()

    expect(await screen.findByRole('heading', { name: /코드 두 개로/ })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/join')
    // 서버에 물어보지 않고(verify 없음 → "쓸 수 없어요" 안내도 없음) 바로 S-01이다
    expect(screen.queryByText(/저장된 가입 코드를 쓸 수 없어요/)).not.toBeInTheDocument()
  })

  it('응답을 기다리는 동안 키패드는 막히고 칸에 친 숫자는 무시된다(요청 한 번)', async () => {
    saveJoinCode(AUTH_MOCK.joinCode)
    let requests = 0
    let release: () => void = () => {}
    server.use(
      http.post('*/api/v1/auth/student/login', async () => {
        requests++
        await new Promise<void>((resolve) => (release = resolve))
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    renderRejoin()
    const user = userEvent.setup()

    await pressDigits(user, '1234')
    expect(screen.getByRole('button', { name: '5' })).toBeDisabled()
    await user.type(screen.getByLabelText('개인 코드'), '5678')

    expect(screen.getByLabelText('개인 코드')).toHaveValue('')
    expect(requests).toBe(1)
    release()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5' })).toBeEnabled()
  })

  it('반 확인이 다른 이유로 실패해도 저장값을 지우지 않고 로그인할 수 있다', async () => {
    saveJoinCode(AUTH_MOCK.joinCode)
    server.use(http.post('*/api/v1/auth/code/verify', () => HttpResponse.json({}, { status: 503 })))
    renderRejoin()
    const user = userEvent.setup()

    expect(await screen.findByText('반 정보를 불러오지 못했어요')).toBeInTheDocument()
    await pressDigits(user, AUTH_MOCK.personalCode)

    expect(
      await screen.findByRole('heading', { name: '홈 화면은 준비 중이에요' }),
    ).toBeInTheDocument()
    expect(readJoinCode()).toBe(AUTH_MOCK.joinCode)
  })

  it('다른 반 링크는 S-01로 간다', async () => {
    saveJoinCode(AUTH_MOCK.joinCode)
    const { router } = renderRejoin()
    const user = userEvent.setup()

    await user.click(screen.getByRole('link', { name: '다른 반' }))

    expect(router.state.location.pathname).toBe('/join')
    expect(readJoinCode()).toBe(AUTH_MOCK.joinCode)
  })
})
