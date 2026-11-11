import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { buildHome, buildLessons, STUDENT_MOCK } from '../../mocks/studentData'
import { renderRoutes } from '../../test/render'

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
  it('머리글(시즌 · 책 이름)·범례', async () => {
    renderLessons()

    expect(await screen.findByRole('heading', { name: '겨울 · Book 1' })).toBeInTheDocument()
    const legend = screen.getByRole('list', { name: '회차 상태' })
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['완료', '오늘', '밀림', '잠김'])
  })

  it('통계는 홈 응답의 stats 그대로(타일 수로 세지 않음)', async () => {
    const home = buildHome()
    home.stats = { completedLessons: 7, overdueLessons: 1, totalLessons: 30 }
    server.use(http.get('*/api/v1/student/home', () => HttpResponse.json(home)))
    renderLessons()
    await group('겨울 1')

    expect(screen.getByText('전체 30회 · 완료 7 · 밀림 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '회차, 밀린 수업 1개' })).toBeInTheDocument()
  })

  it('홈 응답의 반 id로 회차 목록을 부른다', async () => {
    const asked = askedPaths()
    renderLessons()
    await group('겨울 1')

    expect(asked).toContain(`/api/v1/student/classes/${STUDENT_MOCK.classId}/lessons`)
  })

  it('겨울 1·2·3 묶음 8개씩, 기간 표시', async () => {
    renderLessons()
    const first = await group('겨울 1')

    expect(first).toHaveTextContent('12/10 ~ 12/26')
    expect(within(first).getAllByRole('listitem')).toHaveLength(8)
    expect(screen.getByRole('region', { name: '겨울 2' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '겨울 3' })).toBeInTheDocument()
  })

  it('회차 상태는 서버 state 그대로(완료·밀림·오늘·잠김), 잠긴 회차는 링크가 아니다', async () => {
    renderLessons()
    const first = await group('겨울 1')

    expect(within(first).getByRole('link', { name: 'Reading Day 1 · 완료' })).toHaveAttribute(
      'href',
      '/lessons/L2-B1-01',
    )
    const overdue = within(first).getByRole('link', { name: 'Reading Day 3 · 밀림' })
    expect(within(overdue).getByText('03')).toBeInTheDocument()
    expect(within(overdue).getByText('밀림')).toBeInTheDocument()
    expect(within(first).getByRole('link', { name: 'Reading Day 5 · 오늘' })).toBeInTheDocument()
    expect(within(first).queryByRole('link', { name: /Reading Day 6/ })).not.toBeInTheDocument()
    expect(within(first).getByRole('group', { name: 'Reading Day 6 · 잠김' })).toBeInTheDocument()
  })

  it('타일 번호는 code 끝(블랙 K-B1-07 → 07, 보충 K-B1-S1 → S1) — number(진도표 순서)가 아니다', async () => {
    useLessons((l) => {
      const [a, b] = l.groups[0].lessons
      Object.assign(a, { code: 'K-B1-07', number: 8, title: 'Reading Day 7' })
      Object.assign(b, { code: 'K-B1-S1', number: 7, title: '보충 1', type: 'supplement' })
    })
    renderLessons()
    const first = await group('겨울 1')

    const day7 = within(first).getByRole('link', { name: 'Reading Day 7 · 완료' })
    expect(within(day7).getByText('07')).toBeInTheDocument()
    expect(day7).toHaveAttribute('href', '/lessons/K-B1-07')
    const supplement = within(first).getByRole('link', { name: /^보충 1 · / })
    expect(within(supplement).getByText('S1')).toBeInTheDocument()
  })

  it('열림(open) 회차: 범례에 "열림", 타일은 "—"와 링크', async () => {
    useLessons((l) => {
      l.groups[0].lessons[5].state = 'open'
    })
    renderLessons()
    const first = await group('겨울 1')

    expect(screen.getByRole('list', { name: '회차 상태' })).toHaveTextContent('열림')
    const open = within(first).getByRole('link', { name: 'Reading Day 6 · 열림' })
    expect(open).toHaveAttribute('href', '/lessons/L2-B1-06')
    expect(within(open).getByText('—')).toBeInTheDocument()
  })

  it('날짜가 지나도 서버가 locked라면 잠김으로 보인다(클라이언트가 날짜로 열지 않음)', async () => {
    useLessons((l) => {
      l.groups[0].lessons[0].state = 'locked'
      l.groups[0].lessons[0].scheduledDate = '2020-01-01'
    })
    renderLessons()
    const first = await group('겨울 1')

    expect(within(first).getByRole('group', { name: 'Reading Day 1 · 잠김' })).toBeInTheDocument()
  })

  it('계약에 없는 state가 와도 목록은 그대로 — 그 타일만 열 수 없게 두고 기록한다', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    useLessons((l) => {
      ;(l.groups[0].lessons[1] as { state: string }).state = 'archived'
    })
    renderLessons()
    const first = await group('겨울 1')

    expect(within(first).getByRole('group', { name: 'Reading Day 2' })).toBeInTheDocument()
    expect(within(first).queryByRole('link', { name: /Reading Day 2/ })).not.toBeInTheDocument()
    expect(within(first).getByRole('link', { name: 'Reading Day 1 · 완료' })).toBeInTheDocument()
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
