import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { AUTH_MOCK, resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { renderRoutes } from '../../test/render'

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
const homeScreenCard = () => screen.queryByRole('region', { name: '홈 화면에 추가' })
const logoutButton = () => screen.getByRole('button', { name: /로그아웃|나가는 중/ })

function iphone() {
  vi.spyOn(Navigator.prototype, 'userAgent', 'get').mockReturnValue(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  )
}

describe('S-07 설정', () => {
  it('뒤로(홈으로) · 내 정보 · 홈 화면에 추가(안드로이드 안내) · 로그아웃, 탭은 아무것도 선택 안 됨', async () => {
    renderSettings()
    await title()

    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/')
    const me = await screen.findByRole('region', { name: '내 정보' })
    expect(me).toHaveTextContent('김민준')
    expect(me).toHaveTextContent('그린 · 겨울')
    expect(me).toHaveTextContent('겨울 그린 A반')

    const card = homeScreenCard()!
    expect(card).toHaveTextContent('앱처럼 바로 열 수 있어요')
    expect(card).toHaveTextContent('1. 오른쪽 위 ⋮ 를 눌러요')
    expect(card).toHaveTextContent("2. '홈 화면에 추가'를 골라요")
    expect(within(card).queryByRole('button')).not.toBeInTheDocument() // 설치 버튼 없음(안 B)

    const logout = screen.getByRole('region', { name: '로그아웃' })
    expect(logout).toHaveTextContent('로그아웃하면 개인 코드 4자리를 다시 넣어야 들어올 수 있어요')
    // 순서: 내 정보 → 홈 화면에 추가 → 로그아웃
    const order = [me, card, logout]
    expect(
      order[0].compareDocumentPosition(order[1]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      order[1].compareDocumentPosition(order[2]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    const tabs = screen.getByRole('navigation')
    expect(within(tabs).queryByRole('link', { current: 'page' })).not.toBeInTheDocument()
  })

  it('아이폰이면 공유 버튼 안내', async () => {
    iphone()
    renderSettings()
    await title()

    const card = await screen.findByRole('region', { name: '홈 화면에 추가' })
    expect(card).toHaveTextContent('1. 아래 공유 버튼 을 눌러요')
    expect(card).not.toHaveTextContent('⋮')
  })

  it('이미 홈 화면 앱으로 열었으면 카드 대신 한 줄', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query === '(display-mode: standalone)' })),
    )
    renderSettings()
    await title()

    expect(await screen.findByText('홈 화면 앱으로 쓰고 있어요')).toBeInTheDocument()
    expect(homeScreenCard()).not.toBeInTheDocument()
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

    expect(await screen.findByRole('region', { name: '로그아웃' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '내 정보' })).not.toBeInTheDocument()
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
  it('머리 줄 오른쪽: 레벨 칩 다음 설정 아이콘', async () => {
    const user = userEvent.setup()
    const { router } = renderSettings('/')
    await screen.findByRole('heading', { name: '제이G 4 Seasons' })

    const settings = screen.getByRole('link', { name: '설정' })
    const chip = screen.getByText('그린 · 겨울', { exact: false })
    expect(chip.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(settings)
    expect(router.state.location.pathname).toBe('/settings')
  })

  it('홈 안내 카드 "방법 보기" → S-07 홈 화면 추가 카드, 제목에 포커스', async () => {
    const user = userEvent.setup()
    const { router } = renderSettings('/')
    const hint = await screen.findByRole('region', { name: '홈 화면에 추가' })

    await user.click(within(hint).getByRole('link', { name: '방법 보기' }))

    expect(router.state.location.pathname).toBe('/settings')
    expect(router.state.location.hash).toBe('#home-screen')
    expect(await screen.findByRole('heading', { name: '홈 화면에 추가', level: 2 })).toHaveFocus()
  })
})
