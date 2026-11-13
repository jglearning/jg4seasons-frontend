import { onlineManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { buildHome } from '../../mocks/studentData'
import { createTestQueryClient, renderRoutes } from '../../test/render'

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
  setMockSession('student')
})

afterEach(() => {
  onlineManager.setOnline(true)
})

function renderHome() {
  return renderRoutes(routes, { initialEntries: ['/'] })
}

type Home = ReturnType<typeof buildHome>

function useHome(change: (home: Home) => void) {
  const home = buildHome()
  change(home)
  server.use(http.get('*/api/v1/student/home', () => HttpResponse.json(home)))
}

function problem(status: number, code: string, title: string) {
  return HttpResponse.json(
    { code, title, status },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

/** 표지 헤더의 회차 이름(h1) — 화면이 다 그려졌다 */
const heading = (name = 'Reading Day 5') => screen.findByRole('heading', { level: 1, name })
const coverHeader = () => screen.getByRole('banner')
const overdueLink = () => screen.queryByRole('link', { name: /^밀린 수업/ })

describe('S-03 홈', () => {
  it('표지 헤더: 레벨 이름·오늘 회차 번호와 이름·설정·캐릭터, 아래 반·이름·오늘 수업 줄', async () => {
    const { container } = renderHome()
    await heading()

    const cover = coverHeader()
    expect(cover).toHaveTextContent('Green 그린')
    expect(within(cover).getByText('5')).toBeInTheDocument()
    expect(within(cover).getByRole('link', { name: '설정' })).toHaveAttribute('href', '/settings')
    // 캐릭터는 장식(alt="") — 레벨·계절 그림 자리
    const art = within(cover).getByTestId('cover-art')
    expect(art).toHaveAttribute('src', '/art/green/winter/cover.webp')
    expect(art).toHaveAttribute('alt', '')
    expect(screen.getByText('겨울 그린 A반 · 김민준')).toBeInTheDocument()
    expect(screen.getByText('오늘 수업 · 12월 19일 (토) · 겨울 1 · L2-B1-05')).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('data-level', 'green')
    expect((container.querySelector('main') as HTMLElement).className).toMatch(/withTabBar/)
    // v0.2에서 빠진 것: 서비스 이름 제목·레벨 칩·지문 제목 목록·전체 회차 보기
    expect(screen.queryByRole('heading', { name: '제이G 4 Seasons' })).not.toBeInTheDocument()
    expect(screen.queryByText('그린 · 겨울')).not.toBeInTheDocument()
    expect(screen.queryByText('What Tree Rings Tell Us')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '전체 회차 보기' })).not.toBeInTheDocument()
  })

  it('캐릭터 그림을 못 받으면 그림만 숨긴다(색만 있는 헤더), 그림이 없는 계절도 색만', async () => {
    renderHome()
    await heading()
    const art = within(coverHeader()).getByTestId('cover-art')
    act(() => {
      art.dispatchEvent(new Event('error'))
    })
    expect(within(coverHeader()).queryByTestId('cover-art')).not.toBeInTheDocument()
    expect(coverHeader()).toHaveTextContent('Reading Day 5')
  })

  it('계절 그림 자리는 서버 book.season(새봄은 봄 그림)', async () => {
    useHome((home) => {
      home.class.book.season = '새봄'
    })
    renderHome()
    await heading()
    expect(within(coverHeader()).getByTestId('cover-art')).toHaveAttribute(
      'src',
      '/art/green/spring/cover.webp',
    )
  })

  it('밀린 수업: 한 줄 요약(회차 이름 + 번호만), 누르면 회차 목록 — 회차별 버튼은 없다', async () => {
    renderHome()
    await heading()

    const row = overdueLink()!
    expect(row).toHaveAccessibleName('밀린 수업 2개 Reading Day 3 · 4')
    expect(row).not.toHaveTextContent('다음 수업 전에')
    expect(row).toHaveAttribute('href', '/lessons')
    expect(screen.queryByRole('link', { name: /이어서$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /시작$/ })).not.toBeInTheDocument()
  })

  it('밀린 수업이 4개 이상이면 앞의 3개 + "외 n개"', async () => {
    useHome((h) => {
      const [a] = h.overdue
      h.overdue = [3, 4, 6, 7, 9].map((n, i) => ({
        ...a,
        seq: 100 + i,
        lesson: { ...a.lesson, code: `L2-B1-0${n}`, title: `Reading Day ${n}` },
      }))
    })
    renderHome()
    await heading()

    expect(overdueLink()).toHaveAccessibleName('밀린 수업 5개 Reading Day 3 · 4 · 6 외 2개')
  })

  it('교재 사용 중(active)이면 사용 기간 안내가 없다', async () => {
    renderHome()
    await heading()

    expect(screen.queryByRole('region', { name: '사용 기간이 아니에요' })).not.toBeInTheDocument()
  })

  it.each(['before_start', 'expired'] as const)(
    '교재 사용 상태가 %s면 헤더 바로 아래 사용 기간 안내(회차는 서버 값 그대로)',
    async (licenseStatus) => {
      useHome((home) => {
        home.class.licenseStatus = licenseStatus
      })
      renderHome()
      const notice = await screen.findByRole('region', { name: '사용 기간이 아니에요' })

      expect(notice).toHaveTextContent('지금은 회차를 열 수 없어요. 선생님께 물어봐 주세요')
      // 밀린 수업 줄보다 위
      expect(
        notice.compareDocumentPosition(overdueLink()!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(await heading()).toBeInTheDocument()
    },
  )

  it('밀린 수업이 없으면 그 줄을 그리지 않는다', async () => {
    useHome((h) => {
      h.overdue = []
      h.stats.overdueLessons = 0
    })
    renderHome()
    await heading()

    expect(overdueLink()).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '회차' })).toBeInTheDocument()
  })

  it('블랙 보충 회차: 헤더 번호는 code 끝(K-B1-S1 → S1, number 7이 아니다), 묶음은 서버 그대로', async () => {
    useHome((home) => {
      if (home.today === null) return
      home.today.groupLabel = '새봄 1'
      Object.assign(home.today.lesson, { code: 'K-B1-S1', number: 7, type: 'supplement' })
    })
    renderHome()
    await heading()

    expect(within(coverHeader()).getByText('S1')).toBeInTheDocument()
    expect(screen.getByText(/새봄 1 · K-B1-S1$/)).toBeInTheDocument()
  })

  it('지문 듣기 진행은 서버의 passagesDone / passagesTotal(지문 수로 세지 않음)', async () => {
    useHome((h) => {
      if (h.today?.progress) Object.assign(h.today.progress, { passagesDone: 3, passagesTotal: 5 })
    })
    renderHome()
    await heading()

    expect(screen.getByRole('progressbar', { name: '지문 듣기' })).toHaveAttribute(
      'aria-valuetext',
      '3 / 5',
    )
    expect(screen.getByText('3 / 5')).toBeInTheDocument()
  })

  it.each([
    ['not_started', '듣기 시작'],
    ['in_progress', '이어서 듣기'],
    ['completed', '다시 듣기'],
  ] as const)('오늘 수업 상태 %s → 주 버튼 "%s"', async (status, action) => {
    useHome((h) => {
      if (h.today?.progress) h.today.progress.status = status
    })
    renderHome()
    await heading()

    expect(screen.getByRole('link', { name: action })).toHaveAttribute('href', '/lessons/L2-B1-05')
  })

  it('계약에 없는 진도 상태가 와도 홈은 그대로 — 버튼은 "듣기", 기록한다', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    useHome((h) => {
      if (h.today?.progress) (h.today.progress as { status: string }).status = 'paused_by_teacher'
    })
    renderHome()
    await heading()

    expect(screen.getByRole('link', { name: '듣기' })).toBeInTheDocument()
    expect(log).toHaveBeenCalledWith('[student] unknown progress status', 'paused_by_teacher')
  })

  it('개강 전(today 없음): 헤더는 첫 수업(다음 수업)의 번호·이름, "첫 수업" 한 줄, 진행·버튼 없음', async () => {
    useHome((h) => {
      h.today = null
    })
    renderHome()
    await heading('Reading Day 6')

    expect(within(coverHeader()).getByText('6')).toBeInTheDocument()
    expect(screen.getByText('첫 수업 · 12월 22일 (화)')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /듣기/ })).not.toBeInTheDocument()
  })

  it('수업도 다음 수업도 없으면 레벨 이름과 안내 한 문장만', async () => {
    useHome((h) => {
      h.today = null
      h.next = null
    })
    renderHome()

    expect(await screen.findByText('오늘은 수업이 없어요')).toBeInTheDocument()
    expect(coverHeader()).toHaveTextContent('Green 그린')
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('오늘 단어(턱 카드 링크)·다음 수업(날짜만)', async () => {
    renderHome()
    await heading()

    const words = screen.getByRole('link', { name: /오늘 단어/ })
    expect(words).toHaveTextContent('57개')
    expect(words).toHaveAttribute('href', '/lessons/L2-B1-05/words')
    const next = screen.getByText('다음 수업').parentElement as HTMLElement
    expect(within(next).getByText('12/22 (화)')).toBeInTheDocument()
    expect(within(next).queryByText('Reading Day 6')).not.toBeInTheDocument()
  })

  it('단어·다음 수업이 없으면 그 카드를 숨기고 단어 탭은 누를 수 없다', async () => {
    useHome((h) => {
      h.words = null
      h.next = null
    })
    renderHome()
    await heading()

    expect(screen.queryByText('오늘 단어')).not.toBeInTheDocument()
    expect(screen.queryByText('다음 수업')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '단어, 오늘 단어 없음' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('회차 탭 배지는 서버 stats 그대로(밀린 목록 개수로 세지 않음)', async () => {
    useHome((h) => {
      h.stats = { completedLessons: 7, overdueLessons: 3, totalLessons: 30 }
    })
    renderHome()
    await heading()

    expect(screen.getByRole('link', { name: '회차, 밀린 수업 3개' })).toHaveAttribute(
      'href',
      '/lessons',
    )
  })

  it('하단 탭', async () => {
    renderHome()
    await heading()

    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: '단어' })).toHaveAttribute(
      'href',
      '/lessons/L2-B1-05/words',
    )
  })

  it('받는 중에는 빈 값으로 그리지 않는다("수업 없음"·"밀림 0" 같은 거짓 없음)', async () => {
    server.use(
      http.get('*/api/v1/student/home', async () => {
        await delay('infinite')
        return HttpResponse.json(buildHome())
      }),
    )
    renderHome()
    // 가드(/me)를 지나 홈 화면 차례가 될 때까지
    await screen.findByRole('navigation', { name: '주 메뉴' })

    expect(screen.queryByText('오늘은 수업이 없어요')).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
    expect(screen.queryByText(/밀림/)).not.toBeInTheDocument()
  })

  it('홈을 못 받으면(5xx) 문구·다시 시도·하단 탭 → 다시 받으면 화면', async () => {
    let fail = true
    server.use(
      http.get('*/api/v1/student/home', () =>
        fail
          ? problem(500, 'INTERNAL', '잠시 후 다시 시도해 주세요')
          : HttpResponse.json(buildHome()),
      ),
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderHome()

    expect(await screen.findByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요')
    expect(screen.getByRole('link', { name: '홈' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '단어, 오늘 단어 없음' })).toBeInTheDocument()
    fail = false
    screen.getByRole('button', { name: '다시 시도' }).click()
    expect(await heading()).toBeInTheDocument()
  })

  it('5xx는 requestId를 콘솔에 남긴다(서버 로그와 맞춰 보기)', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(
      http.get('*/api/v1/student/home', () =>
        HttpResponse.json(
          {
            code: 'INTERNAL',
            title: '잠시 후 다시 시도해 주세요',
            status: 500,
            requestId: 'abc123',
          },
          { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderHome()
    await screen.findByRole('alert')

    expect(log).toHaveBeenCalledWith('[api]', {
      status: 500,
      code: 'INTERNAL',
      requestId: 'abc123',
    })
  })

  it('홈이 403이면 다시 시도를 주지 않는다(다시 보내도 같다)', async () => {
    server.use(
      http.get('*/api/v1/student/home', () => problem(403, 'FORBIDDEN', '이 화면을 볼 수 없어요')),
    )
    renderHome()

    expect(await screen.findByRole('alert')).toHaveTextContent('이 화면을 볼 수 없어요')
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('오프라인이면 빈 화면 대신 연결 문구, 연결되면 저절로 받는다', async () => {
    // 가드(/me)는 이미 받은 상태로, 홈만 오프라인에서 멈추게 한다
    const client = createTestQueryClient()
    client.setQueryData(['me'], {
      id: 301,
      name: '김민준',
      role: 'student',
      academy: { id: 1, name: 'JEY 어학원' },
    })
    onlineManager.setOnline(false)
    renderRoutes(routes, { initialEntries: ['/'], client })

    expect(await screen.findByText('인터넷 연결을 확인하고 다시 시도해 주세요')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '홈' })).toBeInTheDocument()

    onlineManager.setOnline(true)
    expect(await heading()).toBeInTheDocument()
  })

  it('이미 받은 뒤 백그라운드 재조회가 실패해도 보던 화면을 그대로 둔다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = renderHome()
    await heading()

    server.use(http.get('*/api/v1/student/home', () => problem(503, 'INTERNAL', '잠시 후')))
    await client.refetchQueries({ queryKey: ['student', 'home'] })

    expect(client.getQueryState(['student', 'home'])?.status).toBe('error')
    expect(screen.getByRole('heading', { level: 1, name: 'Reading Day 5' })).toBeInTheDocument()
    expect(overdueLink()).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('홈이 401이면(refresh 뒤에도) 오류를 그리지 않고 입장 화면으로 간다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // /me는 통과, 홈만 계속 401 → refresh(200) 뒤 다시 보낸 요청도 401 → 세션 만료 처리
    server.use(
      http.get('*/api/v1/student/home', () => problem(401, 'UNAUTHORIZED', '다시 들어와 주세요')),
    )
    const { router } = renderHome()

    await waitFor(() => expect(router.state.location.pathname).toBe('/join'))
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
    expect(screen.queryByText('다시 들어와 주세요')).not.toBeInTheDocument()
  })

  it('쿼리 키에 이름·코드가 없다(숫자 id만)', async () => {
    const { client } = renderHome()
    await heading()

    const keys = client
      .getQueryCache()
      .getAll()
      .map((q) => JSON.stringify(q.queryKey))
    expect(keys).toContain('["student","home"]')
    for (const key of keys) {
      expect(key).not.toMatch(/김민준|L2-B1|G7KM2XP4/)
    }
  })
})

// #38 홈 화면에 추가 안내 — v0.2는 내용 맨 아래, 닫으면 이 기기에서 다시 안 보임
describe('S-03 홈 화면에 추가 안내', () => {
  const hint = () => screen.queryByRole('region', { name: '홈 화면에 추가' })

  it('내용 맨 아래(오늘 단어·다음 수업 뒤)에 보이고, 닫으면 기기에 닫은 표시만 남기고 다시 열어도 안 보인다', async () => {
    const { unmount } = renderHome()
    await heading()

    const card = hint()!
    expect(card).toHaveTextContent('홈 화면에 추가하면 다음부터 바로 열 수 있어요')
    // 헤더 아래 칸들 중 마지막, 다음 수업 상자보다 뒤
    expect(card.parentElement!.lastElementChild).toBe(card)
    expect(
      screen.getByText('다음 수업').compareDocumentPosition(card) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await userEvent.setup().click(within(card).getByRole('button', { name: '닫기' }))
    expect(hint()).not.toBeInTheDocument()
    expect({ ...localStorage }).toEqual({ 'jg4s.homeScreenHintDismissed': '1' })

    unmount()
    renderHome()
    await heading()
    expect(hint()).not.toBeInTheDocument()
  })

  it('이미 홈 화면 앱으로 열었으면(standalone) 보이지 않는다', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query === '(display-mode: standalone)' })),
    )
    renderHome()
    await heading()

    expect(hint()).not.toBeInTheDocument()
  })

  it('기기 저장소를 못 써도 홈은 그대로, 닫기는 이 화면에서만', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const { unmount } = renderHome()
    await heading()

    await userEvent.setup().click(within(hint()!).getByRole('button', { name: '닫기' }))
    expect(hint()).not.toBeInTheDocument()

    // 닫은 표시를 남기지 못했으니 다시 열면 또 보인다
    unmount()
    renderHome()
    await heading()
    expect(hint()).toBeInTheDocument()
  })
})
