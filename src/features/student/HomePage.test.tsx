import { onlineManager } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { buildHome, STUDENT_MOCK } from '../../mocks/studentData'
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

const heading = () => screen.findByRole('heading', { name: '제이G 4 Seasons' })
const todayCard = () => screen.findByRole('region', { name: 'Reading Day 5' })

describe('S-03 홈', () => {
  it('반·이름·레벨 칩을 보이고 반 레벨(level.code)을 <html data-level>로 넣는다', async () => {
    const { container } = renderHome()
    await heading()

    expect(screen.getByText('그린 · 겨울')).toBeInTheDocument()
    expect(screen.getByText('겨울 그린 A반 · 김민준')).toBeInTheDocument()
    expect(STUDENT_MOCK.level.code).toBe('L2')
    expect(document.documentElement).toHaveAttribute('data-level', 'green')
    // 떠 있는 탭 바 화면 — 맨 끝이 탭 바에 가리지 않게 아래 여백
    expect((container.querySelector('main') as HTMLElement).className).toMatch(/withTabBar/)
  })

  it('밀린 수업: 날짜·멈춘 곳/시작 안 함과 이어서·시작 링크', async () => {
    renderHome()
    const alert = await screen.findByRole('alert', { name: '밀린 수업 2개' })

    expect(alert).toHaveTextContent('12/15 (화) 수업 · 지문 듣기 2 / 6에서 멈춤')
    expect(alert).toHaveTextContent('12/17 (목) 수업 · 아직 시작 안 함')
    expect(within(alert).getByRole('link', { name: 'Reading Day 3 이어서' })).toHaveAttribute(
      'href',
      '/lessons/L2-B1-03',
    )
    expect(within(alert).getByRole('link', { name: 'Reading Day 4 시작' })).toHaveAttribute(
      'href',
      '/lessons/L2-B1-04',
    )
  })

  it('교재 사용 중(active)이면 사용 기간 안내가 없다', async () => {
    renderHome()
    await todayCard()

    expect(screen.queryByRole('region', { name: '사용 기간이 아니에요' })).not.toBeInTheDocument()
  })

  it.each(['before_start', 'expired'] as const)(
    '교재 사용 상태가 %s면 맨 위에 사용 기간 안내(회차는 서버 값 그대로)',
    async (licenseStatus) => {
      useHome((home) => {
        home.class.licenseStatus = licenseStatus
      })
      renderHome()
      const notice = await screen.findByRole('region', { name: '사용 기간이 아니에요' })

      expect(notice).toHaveTextContent('지금은 회차를 열 수 없어요. 선생님께 물어봐 주세요')
      // 밀린 수업 경고보다 위
      const alert = screen.getByRole('alert', { name: '밀린 수업 2개' })
      expect(notice.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(await todayCard()).toBeInTheDocument()
    },
  )

  it('밀린 수업이 없으면 경고 칸을 숨긴다', async () => {
    useHome((h) => {
      h.overdue = []
      h.stats.overdueLessons = 0
    })
    renderHome()
    await heading()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '회차' })).toBeInTheDocument()
  })

  it('블랙 오늘 회차: 번호는 code 끝(보충 K-B1-S1 → 보충 1, number 7이 아니다), 묶음은 서버 그대로', async () => {
    useHome((home) => {
      if (home.today === null) return
      home.today.groupLabel = '새봄 1'
      Object.assign(home.today.lesson, { code: 'K-B1-S1', number: 7, type: 'supplement' })
    })
    renderHome()
    const card = await todayCard()

    expect(card).toHaveTextContent('새봄 1 · 보충 1 · K-B1-S1')
  })

  it('오늘 수업: 날짜·묶음·회차·상태·지문 6개·이어서 듣기', async () => {
    renderHome()
    const card = await todayCard()

    expect(card).toHaveTextContent('오늘 수업 · 12월 19일 (토)')
    expect(card).toHaveTextContent('겨울 1 · 5회 · L2-B1-05')
    expect(within(card).getByText('진행 중')).toBeInTheDocument()
    expect(within(card).getAllByRole('listitem')).toHaveLength(6)
    expect(within(card).getByText('What Tree Rings Tell Us')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: '이어서 듣기' })).toHaveAttribute(
      'href',
      '/lessons/L2-B1-05',
    )
  })

  it('지문 듣기 진행은 서버의 passagesDone / passagesTotal(지문 수로 세지 않음)', async () => {
    useHome((h) => {
      if (h.today?.progress) Object.assign(h.today.progress, { passagesDone: 3, passagesTotal: 5 })
    })
    renderHome()
    const card = await todayCard()

    expect(within(card).getByRole('progressbar', { name: '지문 듣기' })).toHaveAttribute(
      'aria-valuetext',
      '3 / 5',
    )
    expect(within(card).getByText('3 / 5')).toBeInTheDocument()
  })

  it.each([
    ['not_started', '시작 전', '듣기 시작'],
    ['completed', '완료', '다시 듣기'],
  ] as const)('오늘 수업 상태 %s → "%s"·"%s"', async (status, label, action) => {
    useHome((h) => {
      if (h.today?.progress) h.today.progress.status = status
    })
    renderHome()
    const card = await todayCard()

    expect(within(card).getByText(label)).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: action })).toBeInTheDocument()
  })

  it('오늘 수업 기록이 없으면 서버 값(not_started · 0 / 지문 수) 그대로', async () => {
    useHome((h) => {
      if (h.today) h.today.progress = { status: 'not_started', passagesDone: 0, passagesTotal: 6 }
    })
    renderHome()
    const card = await todayCard()

    expect(within(card).getByText('시작 전')).toBeInTheDocument()
    expect(within(card).getByText('0 / 6')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: '듣기 시작' })).toBeInTheDocument()
  })

  it('계약에 없는 진도 상태가 와도 홈은 그대로 — 상태 표시만 빼고 기록한다', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    useHome((h) => {
      if (h.today?.progress) (h.today.progress as { status: string }).status = 'paused_by_teacher'
    })
    renderHome()
    const card = await todayCard()

    expect(within(card).queryByText('진행 중')).not.toBeInTheDocument()
    expect(within(card).getByRole('link', { name: '듣기' })).toBeInTheDocument()
    expect(log).toHaveBeenCalledWith('[student] unknown progress status', 'paused_by_teacher')
  })

  it('오늘 수업이 없으면 안내 한 문장', async () => {
    useHome((h) => {
      h.today = null
    })
    renderHome()

    const card = await screen.findByRole('region', { name: '오늘 수업' })
    expect(card).toHaveTextContent('오늘은 수업이 없어요')
    expect(screen.queryByRole('link', { name: /듣기/ })).not.toBeInTheDocument()
  })

  it('오늘 단어·다음 수업 카드', async () => {
    renderHome()
    await heading()

    const words = screen.getByRole('link', { name: /오늘 단어/ })
    expect(words).toHaveTextContent('57개')
    expect(words).not.toHaveTextContent('암기')
    expect(words).not.toHaveTextContent('지문')
    expect(words).toHaveAttribute('href', '/lessons/L2-B1-05/words')
    const next = screen.getByText('다음 수업').parentElement as HTMLElement
    expect(within(next).getByText('12/22 (화)')).toBeInTheDocument()
    expect(within(next).getByText('Reading Day 6')).toBeInTheDocument()
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

  it('통계·배지는 서버 stats 그대로(밀린 목록 개수로 세지 않음)', async () => {
    useHome((h) => {
      h.stats = { completedLessons: 7, overdueLessons: 3, totalLessons: 30 }
    })
    renderHome()
    await heading()

    expect(screen.getByText('완료 7 · 밀림 3 · 전체 30')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '회차, 밀린 수업 3개' })).toHaveAttribute(
      'href',
      '/lessons',
    )
  })

  it('전체 회차 보기·하단 탭', async () => {
    renderHome()
    await heading()

    expect(screen.getByRole('link', { name: '전체 회차 보기' })).toHaveAttribute('href', '/lessons')
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
    await todayCard()

    server.use(http.get('*/api/v1/student/home', () => problem(503, 'INTERNAL', '잠시 후')))
    await client.refetchQueries({ queryKey: ['student', 'home'] })

    expect(client.getQueryState(['student', 'home'])?.status).toBe('error')
    expect(screen.getByRole('region', { name: 'Reading Day 5' })).toBeInTheDocument()
    expect(screen.getByRole('alert', { name: '밀린 수업 2개' })).toBeInTheDocument()
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

// #38 홈 화면에 추가 안내(안 B) — 홈 맨 위, 닫으면 이 기기에서 다시 안 보임
describe('S-03 홈 화면에 추가 안내', () => {
  const hint = () => screen.queryByRole('region', { name: '홈 화면에 추가' })

  it('홈 맨 위에 보이고, 닫으면 기기에 닫은 표시만 남기고 다시 열어도 안 보인다', async () => {
    const { container, unmount } = renderHome()
    await heading()

    const card = hint()!
    expect(card).toHaveTextContent('홈 화면에 추가하면 다음부터 바로 열 수 있어요')
    // 홈 칸들 중 첫째
    expect(card.parentElement!.firstElementChild).toBe(card)
    expect(container.contains(card)).toBe(true)

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
    renderHome()
    await heading()

    await userEvent.setup().click(within(hint()!).getByRole('button', { name: '닫기' }))
    expect(hint()).not.toBeInTheDocument()
  })
})
