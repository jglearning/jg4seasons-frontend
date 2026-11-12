import { onlineManager } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveJoinCode } from '../features/auth/joinCode'
import { AUTH_MOCK, resetAuthMock, setMockSession } from '../mocks/handlers'
import { server } from '../mocks/node'
import { renderRoutes } from '../test/render'
import { routes } from './routes'

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
})

describe('들어온 뒤의 세션', () => {
  it('학생이 로그인해 홈으로 간 뒤 세션이 끝나면 S-02로 보낸다(지금 주소 기준)', async () => {
    const { router, client } = renderRoutes(routes, { initialEntries: ['/join'] })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/가입 코드/), AUTH_MOCK.joinCode)
    await user.type(screen.getByLabelText(/개인 코드/), AUTH_MOCK.personalCode)
    await user.click(screen.getByRole('button', { name: '들어가기' }))
    await screen.findByRole('heading', { level: 1, name: 'Reading Day 5' })

    resetAuthMock() // 서버에서 세션이 끝남
    await client.invalidateQueries({ queryKey: ['me'] })

    expect(await screen.findByRole('heading', { name: /개인 코드만/ })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/rejoin')
    expect(screen.getByRole('status')).toHaveTextContent('로그인이 끝났어요')

    // 다시 치기 시작하면 안내는 내려간다
    await user.click(screen.getByRole('button', { name: '1' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('교사가 로그인한 뒤 세션이 끝나면 저장된 반과 상관없이 T-01로 보내고 안내한다', async () => {
    saveJoinCode(AUTH_MOCK.joinCode)
    const { router, client } = renderRoutes(routes, { initialEntries: ['/teacher/login'] })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('아이디'), 'teacher01')
    await user.type(screen.getByLabelText('비밀번호'), `${AUTH_MOCK.staffPassword}{Enter}`)
    await screen.findByRole('heading', { name: '반 목록', level: 1 })

    resetAuthMock()
    await client.invalidateQueries({ queryKey: ['me'] })

    expect(await screen.findByRole('heading', { name: '교사 로그인' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/teacher/login')
    expect(screen.getByRole('status')).toHaveTextContent('로그인 시간이 지났습니다')
  })

  it('처음 열 때 세션이 없는 것은 "로그인이 끝났어요" 안내 없이 입장 화면만 보인다', async () => {
    saveJoinCode(AUTH_MOCK.joinCode)
    renderRoutes(routes, { initialEntries: ['/'] })

    expect(await screen.findByRole('heading', { name: /개인 코드만/ })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('학생이 홈에서 세션이 끝나 S-01로 가면(저장된 반 없음) 안내를 보이고, 코드를 치면 내려간다', async () => {
    setMockSession('student')
    const { router, client } = renderRoutes(routes, { initialEntries: ['/'] })
    const user = userEvent.setup()
    await screen.findByRole('heading', { level: 1, name: 'Reading Day 5' })

    resetAuthMock()
    await client.invalidateQueries({ queryKey: ['me'] })

    expect(await screen.findByRole('status')).toHaveTextContent('로그인이 끝났어요')
    expect(router.state.location.pathname).toBe('/join')
    await user.type(screen.getByLabelText(/가입 코드/), 'G')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('이미 들어온 뒤 백그라운드 재조회가 5xx로 실패해도 보던 화면을 그대로 둔다', async () => {
    setMockSession('student')
    const { client } = renderRoutes(routes, { initialEntries: ['/'] })
    await screen.findByRole('heading', { level: 1, name: 'Reading Day 5' })

    server.use(http.get('*/api/v1/me', () => HttpResponse.json({}, { status: 503 })))
    await client.refetchQueries({ queryKey: ['me'] })

    expect(client.getQueryState(['me'])?.status).toBe('error')
    expect(screen.getByRole('heading', { level: 1, name: 'Reading Day 5' })).toBeInTheDocument()
    // 가드의 오류 화면("다시 시도")으로 바뀌지 않는다(홈의 밀린 수업 칸도 role="alert"라 버튼으로 본다)
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('/me가 401이 아닌 4xx(403)면 다시 시도 대신 입장 화면으로 가는 길을 준다', async () => {
    server.use(
      http.get('*/api/v1/me', () =>
        HttpResponse.json(
          { code: 'FORBIDDEN', title: '이 화면을 볼 수 없어요', status: 403 },
          { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderRoutes(routes, { initialEntries: ['/teacher'] })

    expect(await screen.findByRole('alert')).toHaveTextContent('이 화면을 볼 수 없어요')
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '다시 들어가기' })).toHaveAttribute(
      'href',
      '/teacher/login',
    )
  })

  it('네트워크가 끊겨 /me를 못 받으면 연결 확인 문구와 다시 시도를 보인다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(http.get('*/api/v1/me', () => HttpResponse.error()))
    const { router } = renderRoutes(routes, { initialEntries: ['/'] })

    expect(await screen.findByRole('alert')).toHaveTextContent('인터넷 연결을 확인')
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('기기가 오프라인이면(요청이 멈춤) 빈 화면 대신 연결 문구, 연결되면 저절로 들어간다', async () => {
    setMockSession('student')
    onlineManager.setOnline(false)
    try {
      renderRoutes(routes, { initialEntries: ['/'] })

      expect(await screen.findByRole('alert')).toHaveTextContent('인터넷 연결을 확인')
      onlineManager.setOnline(true)
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Reading Day 5' }),
      ).toBeInTheDocument()
    } finally {
      onlineManager.setOnline(true)
    }
  })

  it('superadmin도 교사·관리자 쪽으로 보낸다', async () => {
    setMockSession('superadmin')
    const { router } = renderRoutes(routes, { initialEntries: ['/'] })

    expect(await screen.findByRole('heading', { name: '반 목록', level: 1 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/teacher')
  })
})

describe('로그인한 사람만 들어오는 경로(GET /me)', () => {
  it('세션이 없고 저장된 반도 없으면 S-01로 보낸다', async () => {
    const { router } = renderRoutes(routes, { initialEntries: ['/'] })

    expect(await screen.findByRole('heading', { name: /코드 두 개로/ })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/join')
  })

  it('세션이 없고 저장된 반이 있으면 S-02로 보낸다', async () => {
    saveJoinCode(AUTH_MOCK.joinCode)
    const { router } = renderRoutes(routes, { initialEntries: ['/'] })

    expect(await screen.findByRole('heading', { name: /개인 코드만/ })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/rejoin')
  })

  it('교사 주소에서 세션이 없으면 저장된 반과 상관없이 T-01로 보낸다', async () => {
    saveJoinCode(AUTH_MOCK.joinCode)
    const { router } = renderRoutes(routes, { initialEntries: ['/teacher'] })

    expect(await screen.findByRole('heading', { name: '교사 로그인' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/teacher/login')
  })

  it('학생 세션은 학생 홈을, 교사 주소로 오면 학생 홈으로 보낸다', async () => {
    setMockSession('student')
    const { router } = renderRoutes(routes, { initialEntries: ['/teacher'] })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Reading Day 5' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('관리자 세션이 학생 홈으로 오면 교사 첫 화면으로 보낸다', async () => {
    setMockSession('admin')
    const { router } = renderRoutes(routes, { initialEntries: ['/'] })

    expect(await screen.findByRole('heading', { name: '반 목록', level: 1 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/teacher')
  })

  it('서버 오류(5xx)면 입장 화면으로 보내지 않고 다시 시도할 수 있다', async () => {
    setMockSession('student')
    let failures = 2 // 쿼리 기본 재시도 1회까지 실패
    server.use(
      http.get('*/api/v1/me', () =>
        failures-- > 0 ? HttpResponse.json({}, { status: 503 }) : undefined,
      ),
    )
    const { router } = renderRoutes(routes, { initialEntries: ['/'] })
    const user = userEvent.setup()

    expect(await screen.findByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요')
    expect(router.state.location.pathname).toBe('/')
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Reading Day 5' }),
    ).toBeInTheDocument()
  })
})
