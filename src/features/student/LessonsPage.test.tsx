import { act, fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { buildHome, buildLessons, STUDENT_MOCK } from '../../mocks/studentData'
import { renderRoutes } from '../../test/render'
import { shortDate } from './dates'

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
  setMockSession('student')
})

afterEach(() => {
  server.events.removeAllListeners()
})

function renderLessons() {
  return renderRoutes(routes, { initialEntries: ['/lessons'] })
}

function problem(status: number, code: string, title: string) {
  return HttpResponse.json(
    { code, title, status },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

function useLessons(change: (lessons: ReturnType<typeof buildLessons>) => void) {
  const lessons = buildLessons()
  change(lessons)
  server.use(http.get('*/api/v1/student/classes/:id/lessons', () => HttpResponse.json(lessons)))
}

function askedPaths() {
  const asked: string[] = []
  server.events.on('request:start', ({ request }) => asked.push(new URL(request.url).pathname))
  return asked
}

const group = async (label: string) => screen.findByRole('region', { name: label })

describe('S-04 회차 목록', () => {
  it('머리 줄: 시즌 · 책 이름 / Reading Day 1~24 · 완료 · 밀림, 범례 없음', async () => {
    renderLessons()
    await group('겨울 1')

    expect(screen.getByRole('heading', { level: 1, name: '겨울 · Book 1' })).toBeInTheDocument()
    expect(screen.getByText('Reading Day 1~24 · 완료 2 · 밀림 2')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: '회차 상태' })).not.toBeInTheDocument()
  })

  it('완료·밀림 수는 홈 응답의 stats 그대로(회차 수로 세지 않음)', async () => {
    const home = buildHome()
    home.stats = { completedLessons: 7, overdueLessons: 1, totalLessons: 30 }
    server.use(http.get('*/api/v1/student/home', () => HttpResponse.json(home)))
    renderLessons()
    await group('겨울 1')

    expect(screen.getByText('Reading Day 1~24 · 완료 7 · 밀림 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '회차, 밀린 수업 1개' })).toBeInTheDocument()
  })

  it('보충 회차가 있으면 머리 줄에 "보충 n"(범위는 정규 회차 번호)', async () => {
    useLessons((l) => {
      const last = l.groups[2].lessons
      Object.assign(last[6], { code: 'L2-B1-S1', type: 'supplement', title: '보충 1' })
      Object.assign(last[7], { code: 'L2-B1-S2', type: 'supplement', title: '보충 2' })
    })
    renderLessons()
    await group('겨울 1')

    expect(screen.getByText('Reading Day 1~22 · 보충 2 · 완료 2 · 밀림 2')).toBeInTheDocument()
  })

  it('홈 응답의 반 id로 회차 목록을 부른다', async () => {
    const asked = askedPaths()
    renderLessons()
    await group('겨울 1')

    expect(asked).toContain(`/api/v1/student/classes/${STUDENT_MOCK.classId}/lessons`)
  })

  it('묶음 상자: 겨울 1·2·3에 8개씩, 기간과 진행("8개 중 2개 완료" · 2 / 8)', async () => {
    renderLessons()
    const first = await group('겨울 1')
    const second = screen.getByRole('region', { name: '겨울 2' })

    expect(first).toHaveTextContent('12/10 ~ 12/26')
    expect(within(first).getAllByRole('listitem')).toHaveLength(8)
    expect(within(first).getByRole('img', { name: '8개 중 2개 완료' })).toBeInTheDocument()
    expect(first).toHaveTextContent('2 / 8')
    expect(within(second).getByRole('img', { name: '8개 중 0개 완료' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '겨울 3' })).toBeInTheDocument()
  })

  it('동그라미 읽는 이름에 상태 — 열린 회차는 S-05 링크, 화면에는 상태 글·날짜 없음', async () => {
    renderLessons()
    const first = await group('겨울 1')

    expect(within(first).getByRole('link', { name: 'Reading Day 1, 완료' })).toHaveAttribute(
      'href',
      '/lessons/L2-B1-01',
    )
    expect(within(first).getByRole('link', { name: 'Reading Day 3, 밀림' })).toHaveAttribute(
      'href',
      '/lessons/L2-B1-03',
    )
    expect(within(first).getByRole('link', { name: 'Reading Day 5, 오늘' })).toHaveAttribute(
      'aria-current',
      'date',
    )
    expect(
      within(first).getByRole('button', { name: 'Reading Day 6, 아직 열리지 않음' }),
    ).toBeInTheDocument()
    expect(
      within(first).getByRole('button', { name: 'Reading Day 8 정리, 아직 열리지 않음' }),
    ).toBeInTheDocument()
    expect(within(first).queryByRole('link', { name: /Reading Day 6/ })).not.toBeInTheDocument()
    expect(within(first).queryByText(/열려요|밀림|완료/)).not.toBeInTheDocument()
  })

  it('번호 동그라미: 지름 48, 완료는 체크, 그 밖은 code 끝 번호, 잠김은 옅은 면(lockedSoft)', async () => {
    renderLessons()
    const first = await group('겨울 1')
    const circle = (name: string) =>
      within(first)
        .getByRole(name.includes('아직') ? 'button' : 'link', { name })
        .querySelector('[data-state]')

    expect(circle('Reading Day 1, 완료')).toHaveAttribute('data-state', 'done')
    expect(circle('Reading Day 1, 완료')).not.toHaveTextContent('1')
    expect(circle('Reading Day 1, 완료')).toHaveStyle({ '--nc-size': '48px' })
    expect(circle('Reading Day 3, 밀림')).toHaveAttribute('data-state', 'overdue')
    expect(circle('Reading Day 3, 밀림')).toHaveTextContent('3')
    expect(circle('Reading Day 5, 오늘')).toHaveAttribute('data-state', 'current')
    expect(circle('Reading Day 6, 아직 열리지 않음')).toHaveAttribute('data-state', 'lockedSoft')
  })

  it('잠긴 회차를 누르면 이동하지 않고 탭 바 위에 "날짜에 열려요"를 2초 띄운다(다시 누르면 2초를 새로)', async () => {
    const date = shortDate(buildLessons().groups[0].lessons[5].scheduledDate)
    const { router } = renderLessons()
    const first = await group('겨울 1')
    const status = screen.getByRole('status')
    expect(status).toBeEmptyDOMElement()

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fireEvent.click(within(first).getByRole('button', { name: 'Reading Day 6, 아직 열리지 않음' }))
    expect(status).toHaveTextContent(`${date}에 열려요`)
    expect(router.state.location.pathname).toBe('/lessons')

    await act(() => vi.advanceTimersByTimeAsync(1500))
    fireEvent.click(within(first).getByRole('button', { name: 'Reading Day 6, 아직 열리지 않음' }))
    await act(() => vi.advanceTimersByTimeAsync(1999))
    expect(status).toHaveTextContent(`${date}에 열려요`)
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(status).toBeEmptyDOMElement()
  })

  it('오늘 회차 카드: 이름 · "오늘 · 날짜" · "이어서 듣기 · 4 / 6" → S-05', async () => {
    const date = shortDate(buildLessons().groups[0].lessons[4].scheduledDate)
    renderLessons()
    await group('겨울 1')
    const card = screen.getByRole('region', { name: 'Reading Day 5' })

    expect(card).toHaveTextContent(`오늘 · ${date}`)
    expect(
      within(card).getByRole('link', { name: 'Reading Day 5 이어서 듣기 · 4 / 6' }),
    ).toHaveAttribute('href', '/lessons/L2-B1-05')
    expect(within(card).getByText('이어서 듣기 · 4 / 6')).toBeInTheDocument()
  })

  it('오늘 수업이 없으면 카드는 가장 오래된 밀린 회차', async () => {
    useLessons((l) => {
      l.groups[0].lessons[4].state = 'open'
    })
    renderLessons()
    await group('겨울 1')
    const card = screen.getByRole('region', { name: 'Reading Day 3' })

    expect(card).toHaveTextContent('밀림 · ')
    expect(
      within(card).getByRole('link', { name: 'Reading Day 3 이어서 듣기 · 2 / 6' }),
    ).toHaveAttribute('href', '/lessons/L2-B1-03')
  })

  it('오늘도 밀린 회차도 없으면 가장 최근에 열린 회차 — 시작 전 "듣기 시작", 완료면 "다시 듣기"', async () => {
    const done = { status: 'completed', passagesDone: 6, passagesTotal: 6 } as const
    useLessons((l) => {
      const [, , c, d, e] = l.groups[0].lessons
      Object.assign(c, { state: 'completed', progress: done })
      Object.assign(d, { state: 'completed', progress: done })
      Object.assign(e, {
        state: 'open',
        progress: { status: 'not_started', passagesDone: 0, passagesTotal: 6 },
      })
    })
    const view = renderLessons()
    await group('겨울 1')

    const open = screen.getByRole('region', { name: 'Reading Day 5' })
    expect(open).toHaveTextContent('열림 · ')
    expect(within(open).getByRole('link', { name: 'Reading Day 5 듣기 시작' })).toBeInTheDocument()
    view.unmount()

    useLessons((l) => {
      for (const lesson of l.groups[0].lessons.slice(0, 5))
        Object.assign(lesson, { state: 'completed', progress: done })
    })
    renderLessons()
    await group('겨울 1')
    const last = screen.getByRole('region', { name: 'Reading Day 5' })
    expect(last).toHaveTextContent('완료 · ')
    expect(within(last).getByRole('link', { name: 'Reading Day 5 다시 듣기' })).toBeInTheDocument()
  })

  it('뒤로: 앱 안에서 들어왔으면 들어온 화면으로', async () => {
    const { router } = renderRoutes(routes, { initialEntries: ['/settings', '/lessons'] })
    await group('겨울 1')

    await userEvent.setup().click(screen.getByRole('link', { name: '뒤로' }))
    expect(router.state.location.pathname).toBe('/settings')
  })

  it('뒤로: 주소로 바로 열었으면(돌아갈 곳 없음) 홈으로', async () => {
    const { router } = renderLessons()
    await group('겨울 1')

    const back = screen.getByRole('link', { name: '뒤로' })
    expect(back).toHaveAttribute('href', '/')
    await userEvent.setup().click(back)
    expect(router.state.location.pathname).toBe('/')
  })

  it('열림(open) 회차: 링크, 모양 open', async () => {
    useLessons((l) => {
      l.groups[0].lessons[5].state = 'open'
    })
    renderLessons()
    const first = await group('겨울 1')

    const open = within(first).getByRole('link', { name: 'Reading Day 6, 열림' })
    expect(open).toHaveAttribute('href', '/lessons/L2-B1-06')
    expect(open.querySelector('[data-state]')).toHaveAttribute('data-state', 'open')
  })

  it('날짜가 지나도 서버가 locked라면 잠김으로 보인다(클라이언트가 날짜로 열지 않음)', async () => {
    useLessons((l) => {
      l.groups[0].lessons[0].state = 'locked'
      l.groups[0].lessons[0].scheduledDate = '2020-01-01'
    })
    renderLessons()
    const first = await group('겨울 1')

    expect(
      within(first).getByRole('button', { name: 'Reading Day 1, 아직 열리지 않음' }),
    ).toBeInTheDocument()
    expect(within(first).queryByRole('link', { name: /Reading Day 1,/ })).not.toBeInTheDocument()
  })

  it('계약에 없는 state가 와도 목록은 그대로 — 그 회차만 열 수 없게 두고 기록한다', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    useLessons((l) => {
      ;(l.groups[0].lessons[1] as { state: string }).state = 'archived'
    })
    renderLessons()
    const first = await group('겨울 1')

    expect(
      within(first).getByRole('button', { name: 'Reading Day 2, 아직 열리지 않음' }),
    ).toBeInTheDocument()
    expect(within(first).getByRole('link', { name: 'Reading Day 1, 완료' })).toHaveAttribute('href')
    expect(log).toHaveBeenCalledWith('[student] unknown lesson state', 'L2-B1-02', 'archived')
  })

  it('교재 사용 중(active)이면 사용 기간 안내가 없다', async () => {
    renderLessons()
    await group('겨울 1')

    expect(screen.queryByRole('region', { name: '사용 기간이 아니에요' })).not.toBeInTheDocument()
  })

  it.each(['before_start', 'expired'] as const)(
    '회차 목록 응답의 교재 사용 상태가 %s면 목록 위에 사용 기간 안내',
    async (licenseStatus) => {
      useLessons((lessons) => {
        lessons.class.licenseStatus = licenseStatus
      })
      renderLessons()
      const notice = await screen.findByRole('region', { name: '사용 기간이 아니에요' })

      expect(notice).toHaveTextContent('지금은 회차를 열 수 없어요. 선생님께 물어봐 주세요')
      const first = await group('겨울 1')
      expect(notice.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    },
  )

  it('회차 목록을 못 받으면(5xx) 머리글은 두고 다시 시도', async () => {
    let fail = true
    server.use(
      http.get('*/api/v1/student/classes/:id/lessons', () =>
        fail ? HttpResponse.json({}, { status: 503 }) : HttpResponse.json(buildLessons()),
      ),
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderLessons()

    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '겨울 · Book 1' })).toBeInTheDocument()
    fail = false
    screen.getByRole('button', { name: '다시 시도' }).click()
    expect(await group('겨울 1')).toBeInTheDocument()
  })

  it('회차 목록이 403이면 다시 시도 대신 홈으로', async () => {
    server.use(
      http.get('*/api/v1/student/classes/:id/lessons', () =>
        problem(403, 'FORBIDDEN', '이 반을 볼 수 없어요'),
      ),
    )
    renderLessons()

    expect(await screen.findByRole('alert')).toHaveTextContent('이 반을 볼 수 없어요')
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/')
  })

  it('홈 응답을 못 받으면 회차 목록은 부르지 않고 다시 시도·하단 탭', async () => {
    const asked = askedPaths()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(
      http.get('*/api/v1/student/home', () =>
        problem(500, 'INTERNAL', '잠시 후 다시 시도해 주세요'),
      ),
    )
    renderLessons()

    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '홈' })).toBeInTheDocument()
    expect(asked.some((path) => path.includes('/lessons'))).toBe(false)
  })

  it('이미 받은 뒤 회차 목록 재조회가 실패해도 보던 목록을 그대로 둔다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = renderLessons()
    await group('겨울 1')

    server.use(
      http.get('*/api/v1/student/classes/:id/lessons', () =>
        HttpResponse.json({}, { status: 503 }),
      ),
    )
    await client.refetchQueries({ queryKey: ['student', 'lessons', STUDENT_MOCK.classId] })

    expect(screen.getByRole('region', { name: '겨울 1' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('하단 탭: 회차가 지금 화면', async () => {
    renderLessons()
    await group('겨울 1')

    expect(screen.getByRole('link', { name: '회차, 밀린 수업 2개' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
