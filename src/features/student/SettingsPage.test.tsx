import { onlineManager } from '@tanstack/react-query'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { AUTH_MOCK, resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { buildHome } from '../../mocks/studentData'
import { createTestQueryClient, renderRoutes } from '../../test/render'

// S-07 설정(와이어프레임 S07 v2, 11/9): 내 정보 · 홈 화면에 추가 방법 · 로그아웃(확인 없이 → S-02)

let sent: Array<{ method: string; path: string }>

// S-02가 쓰는 기기 저장값(기능 폴더끼리 import하지 않아 키를 직접 쓴다 — features/auth/joinCode.ts)
const JOIN_CODE_KEY = 'jg4s.joinCode'

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
  setMockSession('student')
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

function renderSettings(path = '/settings') {
  return renderRoutes(routes, { initialEntries: [path] })
}

const title = () => screen.findByRole('heading', { name: '설정', level: 1 })
const homeScreenRow = () => screen.queryByRole('button', { name: /홈 화면에 추가/ })
const steps = () => document.getElementById('home-screen-steps')!
const logoutButton = () => screen.getByRole('button', { name: /로그아웃|나가는 중/ })

function iphone() {
  vi.spyOn(Navigator.prototype, 'userAgent', 'get').mockReturnValue(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  )
}

describe('S-07 설정', () => {
  it('뒤로(홈으로) · 내 정보(레벨 번호·반·레벨 이름) · 앱 묶음 · 맨 아래 로그아웃, 탭 바 없음', async () => {
    renderSettings()
    await title()

    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/')
    const me = await screen.findByRole('region', { name: '내 정보' })
    expect(me).toHaveTextContent('김민준')
    expect(me).toHaveTextContent('겨울 그린 A반 · Green 그린')
    expect(me.querySelector('[data-state="level"]')).toHaveTextContent('2')

    const app = screen.getByRole('region', { name: '앱' })
    expect(within(app).getByRole('button', { name: /홈 화면에 추가/ })).toHaveTextContent(
      '앱처럼 바로 열 수 있어요 · 방법 보기',
    )
    // 순서: 내 정보 → 앱 → 로그아웃
    expect(me.compareDocumentPosition(app) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(
      app.compareDocumentPosition(logoutButton()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    // 로그아웃 설명 글·탭 바는 없다(v0.2)
    expect(screen.queryByText(/개인 코드 4자리를 다시/)).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('홈 화면에 추가: 처음엔 접혀 있고, 누르면 아래에 안드로이드 안내가 펼쳐지고 다시 누르면 접힌다', async () => {
    const user = userEvent.setup()
    renderSettings()
    const row = await screen.findByRole('button', { name: /홈 화면에 추가/ })
    expect(row).toHaveAttribute('aria-expanded', 'false')
    expect(row).toHaveAttribute('aria-controls', 'home-screen-steps')
    expect(steps()).not.toBeVisible()

    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(steps()).toBeVisible()
    expect(steps()).toHaveTextContent('1. 오른쪽 위 ⋮ 를 눌러요')
    expect(steps()).toHaveTextContent("2. '홈 화면에 추가'를 골라요")
    expect(within(steps()).queryByRole('button')).not.toBeInTheDocument() // 설치 버튼 없음(안 B)

    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'false')
    expect(steps()).not.toBeVisible()
  })

  it('Black(K) 레벨은 번호 대신 코드 그대로, 레벨 이름은 "Black 블랙"', async () => {
    const home = buildHome()
    home.class.level = { ...home.class.level, code: 'K', nameKo: '블랙' }
    server.use(http.get('*/api/v1/student/home', () => HttpResponse.json(home)))
    renderSettings()

    const me = await screen.findByRole('region', { name: '내 정보' })
    expect(me.querySelector('[data-state="level"]')).toHaveTextContent(/^K$/)
    expect(me).toHaveTextContent('겨울 그린 A반 · Black 블랙')
    expect(document.documentElement).toHaveAttribute('data-level', 'black')
  })

  it('아이폰이면 공유 버튼 안내', async () => {
    iphone()
    const user = userEvent.setup()
    renderSettings()
    await user.click(await screen.findByRole('button', { name: /홈 화면에 추가/ }))
    expect(steps()).toHaveTextContent('1. 아래 공유 버튼 을 눌러요')
    expect(steps()).not.toHaveTextContent('⋮')
  })

  it('이미 홈 화면 앱으로 열었으면 줄 대신 한 줄 안내', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query === '(display-mode: standalone)' })),
    )
    renderSettings()
    await title()

    expect(await screen.findByText('홈 화면 앱으로 쓰고 있어요')).toBeInTheDocument()
    expect(homeScreenRow()).not.toBeInTheDocument()
  })

  it('홈 응답을 못 받으면 내 정보만 빼고 로그아웃은 보인다', async () => {
    server.use(
      http.get('*/api/v1/student/home', () =>
        HttpResponse.json(
          { code: 'INTERNAL', title: '문제가 생겼어요', status: 500 },
          { status: 500 },
        ),
      ),
    )
    renderSettings()
    await title()

    expect(await screen.findByRole('button', { name: '로그아웃' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '내 정보' })).not.toBeInTheDocument()
  })

  it('오프라인이라 홈 응답을 기다리는 중이어도(요청 멈춤) 앱 묶음과 로그아웃은 보인다', async () => {
    // 가드(/me)는 이미 받은 상태로, 홈만 오프라인에서 멈추게 한다
    const client = createTestQueryClient()
    client.setQueryData(['me'], {
      id: 301,
      name: '김민준',
      role: 'student',
      academy: { id: 1, name: 'JEY 어학원' },
    })
    onlineManager.setOnline(false)
    try {
      renderRoutes(routes, { initialEntries: ['/settings'], client })
      await title()

      expect(await screen.findByRole('button', { name: '로그아웃' })).toBeInTheDocument()
      expect(homeScreenRow()).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: '내 정보' })).not.toBeInTheDocument()
    } finally {
      onlineManager.setOnline(true)
    }
  })

  it('홈 응답을 기다리는 중(온라인)에는 아무것도 그리지 않는다 — 내 정보가 뒤늦게 끼어들지 않게', async () => {
    let answer: () => void = () => {}
    server.use(
      http.get(
        '*/api/v1/student/home',
        () =>
          new Promise<Response>((resolve) => {
            answer = () => resolve(HttpResponse.json(buildHome()))
          }),
      ),
    )
    renderSettings()
    await title()

    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument()
    answer()
    expect(await screen.findByRole('region', { name: '내 정보' })).toBeInTheDocument()
  })

  it('로그아웃: 확인 없이 바로 POST → S-02로, 캐시를 비우고 가입 코드는 기기에 남긴다', async () => {
    localStorage.setItem(JOIN_CODE_KEY, AUTH_MOCK.joinCode)
    const user = userEvent.setup()
    const { router, client } = renderSettings()
    await screen.findByRole('region', { name: '내 정보' })

    await user.click(logoutButton())

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/rejoin'))
    expect(sent).toEqual([{ method: 'POST', path: '/api/v1/auth/logout' }])
    expect(client.getQueryData(['me'])).toBeUndefined()
    expect(client.getQueryData(['student', 'home'])).toBeUndefined()
    expect(localStorage.getItem(JOIN_CODE_KEY)).toBe(AUTH_MOCK.joinCode)
  })

  it('로그아웃 실패: 화면 그대로, 버튼 아래 안내, 다시 누를 수 있다', async () => {
    server.use(http.post('*/api/v1/auth/logout', () => HttpResponse.error()))
    const user = userEvent.setup()
    const { router } = renderSettings()
    await screen.findByRole('region', { name: '내 정보' })

    await user.click(logoutButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '로그아웃하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요',
    )
    expect(router.state.location.pathname).toBe('/settings')
    expect(logoutButton()).toHaveTextContent('로그아웃')
    expect(logoutButton()).toBeEnabled()
  })

  it('로그아웃이 서버 오류(5xx)로 실패하면 연결 문구가 아니라 잠시 후 다시 누르라는 안내', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(
      http.post('*/api/v1/auth/logout', () =>
        HttpResponse.json(
          { code: 'INTERNAL', title: '문제가 생겼어요', status: 503 },
          { status: 503 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderSettings()
    await screen.findByRole('region', { name: '내 정보' })

    await user.click(logoutButton())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('로그아웃하지 못했어요. 잠시 후 다시 눌러 주세요')
    expect(alert).not.toHaveTextContent('인터넷')
    expect(logoutButton()).toBeEnabled()
  })

  it('세션이 이미 끝났으면(로그아웃 401) 로그아웃된 것으로 보고 S-02로', async () => {
    localStorage.setItem(JOIN_CODE_KEY, AUTH_MOCK.joinCode)
    server.use(
      http.post('*/api/v1/auth/logout', () =>
        HttpResponse.json(
          { code: 'UNAUTHORIZED', title: '로그인이 필요해요', status: 401 },
          { status: 401 },
        ),
      ),
    )
    const user = userEvent.setup()
    const { router } = renderSettings()
    await screen.findByRole('region', { name: '내 정보' })

    await user.click(logoutButton())
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/rejoin'))
  })
})

describe('S-03 홈 → S-07', () => {
  it('표지 헤더 오른쪽 위 설정 아이콘 → S-07', async () => {
    const user = userEvent.setup()
    const { router } = renderSettings('/')
    await screen.findByRole('heading', { level: 1, name: 'Reading Day 5' })

    const settings = within(screen.getByRole('banner')).getByRole('link', { name: '설정' })
    await user.click(settings)
    expect(router.state.location.pathname).toBe('/settings')
  })

  it('홈 안내 카드 "방법 보기" → S-07 홈 화면 추가 줄, 펼친 채로 그 줄에 포커스', async () => {
    const user = userEvent.setup()
    const { router } = renderSettings('/')
    const hint = await screen.findByRole('region', { name: '홈 화면에 추가' })

    await user.click(within(hint).getByRole('link', { name: '방법 보기' }))

    expect(router.state.location.pathname).toBe('/settings')
    expect(router.state.location.hash).toBe('#home-screen')
    const row = await screen.findByRole('button', { name: /홈 화면에 추가/ })
    await vi.waitFor(() => expect(row).toHaveFocus())
    expect(row).toHaveAttribute('aria-expanded', 'true')
    expect(steps()).toBeVisible()
  })
})
