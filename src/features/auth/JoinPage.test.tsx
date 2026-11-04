import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { AUTH_MOCK, resetAuthMock } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { renderRoutes } from '../../test/render'
import { readJoinCode } from './joinCode'
import { expectSecretNowhere, watchConsole } from './testUtils'

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
  watchConsole()
})

function renderJoin() {
  return renderRoutes(routes, { initialEntries: ['/join'] })
}

const joinInput = () => screen.getByLabelText(/가입 코드/)
const personalInput = () => screen.getByLabelText(/개인 코드/)
const submitButton = () => screen.getByRole('button', { name: '들어가기' })

describe('S-01 코드로 들어가기', () => {
  it('가입 코드는 대문자·영숫자 8자로 바꾸고, 8자가 차면 반 이름을 보여 준다', async () => {
    renderJoin()
    const user = userEvent.setup()

    await user.type(joinInput(), 'g7km-2xp4 extra')

    expect(joinInput()).toHaveValue(AUTH_MOCK.joinCode)
    expect(
      await screen.findByText(`${AUTH_MOCK.className} · ${AUTH_MOCK.academyName}`),
    ).toBeInTheDocument()
  })

  it('없는 가입 코드면 안내하고 들어가기를 막는다', async () => {
    renderJoin()
    const user = userEvent.setup()

    await user.type(joinInput(), 'AAAABBBB')
    await user.type(personalInput(), AUTH_MOCK.personalCode)

    expect(await screen.findByText(/없는 가입 코드예요/)).toBeInTheDocument()
    expect(submitButton()).toBeDisabled()
  })

  it('늦게 도착한 이전 코드의 반 확인 결과가 지금 코드의 결과를 덮지 않는다', async () => {
    let releaseFirst: () => void = () => {}
    server.use(
      http.post(
        '*/api/v1/auth/code/verify',
        async () => {
          await new Promise<void>((resolve) => (releaseFirst = resolve))
          return undefined // 기본 목(반 정보 200)으로 넘긴다
        },
        { once: true },
      ),
    )
    renderJoin()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode) // 이 응답은 붙잡아 둔다
    await user.clear(joinInput())
    await user.type(joinInput(), 'AAAABBBB')
    expect(await screen.findByText(/없는 가입 코드예요/)).toBeInTheDocument()

    releaseFirst()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.getByText(/없는 가입 코드예요/)).toBeInTheDocument()
    expect(screen.queryByText(AUTH_MOCK.className, { exact: false })).not.toBeInTheDocument()
  })

  it('반 이름이 보인 뒤 한 글자를 지우면 기본 안내로 돌아간다', async () => {
    renderJoin()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await screen.findByText(AUTH_MOCK.className, { exact: false })
    await user.type(joinInput(), '{Backspace}')

    expect(screen.queryByText(AUTH_MOCK.className, { exact: false })).not.toBeInTheDocument()
    expect(screen.getByText(/대소문자 구분 없음/)).toBeInTheDocument()
  })

  it('기기 저장소를 쓸 수 없어도 로그인은 된다', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const { router } = renderJoin()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await user.type(personalInput(), AUTH_MOCK.personalCode)
    await user.click(submitButton())

    expect(
      await screen.findByRole('heading', { name: '홈 화면은 준비 중이에요' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('들어가기를 두 번 눌러도 요청은 한 번만 나간다', async () => {
    let requests = 0
    let release: () => void = () => {}
    server.use(
      http.post('*/api/v1/auth/student/login', async () => {
        requests++
        await new Promise<void>((resolve) => (release = resolve))
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    renderJoin()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await user.type(personalInput(), AUTH_MOCK.personalCode)
    await user.dblClick(submitButton())
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('button', { name: '들어가는 중' })).toBeDisabled()
    expect(requests).toBe(1)
    release()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('응답을 기다리는 동안 다른 화면으로 가면, 로그인이 성공해도 학생 홈으로 끌고 오지 않는다', async () => {
    let release: () => void = () => {}
    server.use(
      http.post(
        '*/api/v1/auth/student/login',
        async () => {
          await new Promise<void>((resolve) => (release = resolve))
          return undefined // 기본 목(성공)으로 넘긴다
        },
        { once: true },
      ),
    )
    const { router } = renderJoin()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await user.type(personalInput(), AUTH_MOCK.personalCode)
    await user.click(submitButton())
    // 세션이 생겨도 /me를 묻지 않는 화면(404)으로 가 둔다 — 남은 이동이 있으면 '/'로 끌려간다
    await act(() => router.navigate('/elsewhere'))
    release()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(router.state.location.pathname).toBe('/elsewhere')
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없어요' })).toBeInTheDocument()
  })

  it('교사 로그인 링크가 있다', () => {
    renderJoin()
    expect(screen.getByRole('link', { name: '교사 로그인' })).toHaveAttribute(
      'href',
      '/teacher/login',
    )
  })

  it('반 확인이 실패해도(429) 들어갈 수 있다', async () => {
    renderJoin()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.rateLimitedJoinCode)
    await user.type(personalInput(), '1234')

    expect(await screen.findByText(/지금은 반을 확인하지 못했어요/)).toBeInTheDocument()
    expect(submitButton()).toBeEnabled()
  })

  it('성공하면 홈으로 가고, 가입 코드만 기기에 남고 개인 코드는 어디에도 없다', async () => {
    const { router, client } = renderJoin()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await user.type(personalInput(), AUTH_MOCK.personalCode)
    await user.click(submitButton())

    expect(
      await screen.findByRole('heading', { name: '홈 화면은 준비 중이에요' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(readJoinCode()).toBe(AUTH_MOCK.joinCode)
    expect(Object.keys(localStorage)).toHaveLength(1)
    expectSecretNowhere(AUTH_MOCK.personalCode, { client, router })
  })

  it('로그인하면 이전 사용자의 캐시를 비운다(같은 기기를 다른 학생이 쓸 때)', async () => {
    const { client } = renderJoin()
    client.setQueryData(['student', 'home'], { previous: true })
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await user.type(personalInput(), AUTH_MOCK.personalCode)
    await user.click(submitButton())

    expect(
      await screen.findByRole('heading', { name: '홈 화면은 준비 중이에요' }),
    ).toBeInTheDocument()
    expect(client.getQueryData(['student', 'home'])).toBeUndefined()
  })

  it('요청을 보내자마자 개인 코드 칸을 비운다(응답을 기다리는 동안에도)', async () => {
    let release: () => void = () => {}
    server.use(
      http.post('*/api/v1/auth/student/login', async () => {
        await new Promise<void>((resolve) => (release = resolve))
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    renderJoin()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await user.type(personalInput(), AUTH_MOCK.personalCode)
    await user.click(screen.getByRole('button', { name: '들어가기' }))

    expect(await screen.findByRole('button', { name: '들어가는 중' })).toBeDisabled()
    expect(personalInput()).toHaveValue('')
    release()
    expect(await screen.findByText('잠시 후 다시 시도해 주세요')).toBeInTheDocument()
  })

  it('코드가 맞지 않으면 학생 문구를 보이고, 가입 코드를 저장하지 않는다', async () => {
    const { router, client } = renderJoin()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await user.type(personalInput(), '1111')
    await user.click(submitButton())

    expect(await screen.findByText('가입 코드 또는 개인 코드가 맞지 않아요')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/join')
    expect(personalInput()).toHaveValue('')
    expect(readJoinCode()).toBeUndefined()
    expectSecretNowhere('1111', { client, router })
  })

  it('잠기면(423) 서버 문구와 해제 시각(until, 한국 시간)을 보인다', async () => {
    renderJoin()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await user.type(personalInput(), AUTH_MOCK.lockedPersonalCode)
    await user.click(submitButton())

    // until 2026-11-11T06:42:00Z = 한국 오후 3시 42분. 고정 문구인 detail 대신 시각을 보인다
    const alert = await screen.findByText(/오후 3시 42분부터 다시 할 수 있어요/)
    expect(alert).toHaveTextContent(AUTH_MOCK.lockedTitle)
    expect(alert).not.toHaveTextContent(AUTH_MOCK.lockedDetail)
    expect(readJoinCode()).toBeUndefined()
  })

  it('네트워크가 끊기면 연결 확인 문구를 보인다', async () => {
    server.use(http.post('*/api/v1/auth/student/login', () => HttpResponse.error()))
    renderJoin()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await user.type(personalInput(), AUTH_MOCK.personalCode)
    await user.click(submitButton())

    expect(await screen.findByText('인터넷 연결을 확인하고 다시 시도해 주세요')).toBeInTheDocument()
    await waitFor(() => expect(submitButton()).toBeDisabled())
  })
})
