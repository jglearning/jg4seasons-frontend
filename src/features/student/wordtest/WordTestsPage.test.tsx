import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../../../app/routes'
import { resetAuthMock, setMockSession } from '../../../mocks/handlers'
import { server } from '../../../mocks/node'
import { resetWordTestMock, WORD_TEST_MOCK } from '../../../mocks/wordTestData'
import { hold } from '../../../test/hold'
import { renderRoutes } from '../../../test/render'
import type { WordTestSubmission } from './wordTestApi'
import { COPY } from './wordTestCopy'

// 단어시험 목록(#185) — 하단 탭 "시험", S-04와 같은 모양(맨 위 카드 + 묶음 도장판).
// 목: 열린 회차 1~5(오늘 5강, 6~ 잠김), 2강은 시험지 없음(404 NOT_FOUND)
const LATEST = '*/api/v1/word-tests/lessons/:code/latest'
let latestCalls: string[]

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
  resetWordTestMock()
  setMockSession('student')
  latestCalls = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname.endsWith('/latest')) latestCalls.push(url.pathname + url.search)
  })
})

afterEach(() => {
  server.events.removeAllListeners()
})

function renderList() {
  return renderRoutes(routes, { initialEntries: ['/word-tests'] })
}

/** 묶음 상자(겨울 1) — 판이 그려질 때까지 기다린다 */
const group = async (label = '겨울 1') =>
  (await screen.findByRole('heading', { name: label })).closest('section') as HTMLElement
const stamp = (box: HTMLElement, day: number) =>
  within(box).getByRole('link', { name: new RegExp(`^Reading Day ${day},`) })
const featured = () =>
  screen.getByRole('heading', { level: 2, name: /Reading Day/ }).closest('section') as HTMLElement

function problem(status: number, code: string) {
  return HttpResponse.json(
    { title: '오류', status, code, requestId: 'r1' },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

const graded: WordTestSubmission = {
  id: 9,
  lessonCode: 'L2-B1-03',
  section: 'B',
  attemptNo: 1,
  status: 'graded',
  score: 35,
  total: 48,
  submittedAt: '2026-11-26T05:05:12Z',
  gradedAt: '2026-11-26T05:05:21Z',
  items: [],
}

/** 2강 시험지 없음, 3강 채점 결과, 4강 채점 중, 나머지 아직 안 냄 */
function mixedLatest() {
  return http.get(LATEST, ({ params }) =>
    params.code === 'L2-B1-02'
      ? problem(404, 'NOT_FOUND')
      : params.code === 'L2-B1-03'
        ? HttpResponse.json(graded)
        : params.code === 'L2-B1-04'
          ? HttpResponse.json({ ...graded, status: 'grading', score: null, items: undefined })
          : new HttpResponse(null, { status: 204 }),
  )
}

describe('단어시험 목록(#185)', () => {
  it('하단 탭 "시험"으로 들어온다 — 탭 바(홈·회차 목록과 같은 것)에 있고, 이 화면에서는 켜져 있다', async () => {
    const user = userEvent.setup()
    // 회차 목록(S-04)에서 — 홈은 처음에 "홈 화면에 추가" 안내가 덮을 수 있다
    const { router } = renderRoutes(routes, { initialEntries: ['/lessons'] })
    await screen.findByRole('heading', { name: /Book 1/ })
    const tabs = screen.getByRole('navigation', { name: '주 메뉴' })

    await user.click(within(tabs).getByRole('link', { name: COPY.tab }))

    expect(router.state.location.pathname).toBe('/word-tests')
    await group()
    expect(
      within(screen.getByRole('navigation', { name: '주 메뉴' })).getByRole('link', {
        name: COPY.tab,
      }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('도장판: 시험지 있는 회차만 누를 수 있고, 시험지 없는·잠긴 회차는 옅은 동그라미 — 잠긴 회차는 묻지 않는다', async () => {
    renderList()
    const box = await group()

    const links = within(box).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/lessons/L2-B1-01/word-test',
      '/lessons/L2-B1-03/word-test',
      '/lessons/L2-B1-04/word-test',
      '/lessons/L2-B1-05/word-test',
    ])
    expect(within(box).getByRole('img', { name: `Reading Day 2, ${COPY.stampNone}` })).toBeVisible()
    expect(within(box).getByRole('img', { name: `Reading Day 6, ${COPY.stampNone}` })).toBeVisible()
    expect(screen.getByText(`${COPY.scoreLabel} · ${COPY.listCount(4)}`)).toBeInTheDocument()
    // 열린 회차 1~5만, B 영역으로
    expect([...latestCalls].sort()).toEqual(
      [1, 2, 3, 4, 5].map((n) => `/api/v1/word-tests/lessons/L2-B1-0${n}/latest?section=B`),
    )
  })

  it('동그라미 아래는 최근 제출의 서버 상태 — 채점 결과는 채운 동그라미 + 점수, 묶음 머리는 결과 수', async () => {
    server.use(mixedLatest())
    renderList()
    const box = await group()

    expect(stamp(box, 3)).toHaveTextContent('35/48')
    expect(stamp(box, 3)).toHaveAccessibleName(`Reading Day 3, ${COPY.scoreLabel} 35 / 48`)
    expect(stamp(box, 1)).toHaveAccessibleName(`Reading Day 1, ${COPY.entryNew}`)
    expect(stamp(box, 3).querySelector('[data-state]')).toHaveAttribute('data-state', 'done')
    expect(stamp(box, 4)).toHaveTextContent(COPY.stampGrading)
    expect(stamp(box, 4).querySelector('[data-state]')).toHaveAttribute('data-state', 'open')
    expect(stamp(box, 1)).toHaveTextContent(COPY.stampNew)
    expect(within(box).getByRole('img', { name: '시험 4개 중 1개 채점 결과' })).toBeVisible()
  })

  it('맨 위 카드는 오늘 회차 — 아직 안 냈으면 "답안지 찍기", 누르면 그 회차 제출 화면', async () => {
    const user = userEvent.setup()
    const { router } = renderList()
    await group()

    const card = featured()
    expect(within(card).getByRole('heading', { name: 'Reading Day 5' })).toBeVisible()
    expect(card).toHaveTextContent(`${COPY.today} · ${COPY.scoreLabel}`)
    expect(card).toHaveTextContent(COPY.featuredNew)

    await user.click(within(card).getByRole('link', { name: new RegExp(COPY.take) }))

    expect(router.state.location.pathname).toBe('/lessons/L2-B1-05/word-test')
    expect(await screen.findByText(COPY.guide[0])).toBeInTheDocument()
  })

  it('오늘 회차에 시험지가 없으면 맨 위 카드는 아직 안 낸 가장 최근 회차, 낸 회차면 "결과 보기"', async () => {
    WORD_TEST_MOCK.noSheetCodes = ['L2-B1-02', 'L2-B1-05']
    server.use(
      http.get(LATEST, ({ params }) =>
        params.code === 'L2-B1-02' || params.code === 'L2-B1-05'
          ? problem(404, 'NOT_FOUND')
          : params.code === 'L2-B1-04'
            ? HttpResponse.json({ ...graded, lessonCode: 'L2-B1-04' })
            : new HttpResponse(null, { status: 204 }),
      ),
    )
    renderList()
    await group()

    // 4강은 냈고 3강은 아직 → 3강
    expect(within(featured()).getByRole('heading', { name: 'Reading Day 3' })).toBeVisible()
    expect(featured()).not.toHaveTextContent(COPY.today)
  })

  it('오늘 회차를 이미 냈어도 맨 위 카드는 오늘 회차(안 낸 지난 회차보다 먼저) — "결과 보기"', async () => {
    server.use(
      http.get(LATEST, ({ params }) =>
        params.code === 'L2-B1-02'
          ? problem(404, 'NOT_FOUND')
          : params.code === 'L2-B1-05'
            ? HttpResponse.json({ ...graded, lessonCode: 'L2-B1-05' })
            : new HttpResponse(null, { status: 204 }),
      ),
    )
    renderList()
    await group()

    const card = featured()
    expect(within(card).getByRole('heading', { name: 'Reading Day 5' })).toBeVisible()
    expect(card).toHaveTextContent(`${COPY.today} · ${COPY.scoreLabel}`)
    expect(within(card).getByRole('link', { name: new RegExp(COPY.openResult) })).toBeVisible()
  })

  it('모두 냈으면 맨 위 카드는 가장 최근 회차의 결과 보기', async () => {
    server.use(
      http.get(LATEST, ({ params }) =>
        params.code === 'L2-B1-02'
          ? problem(404, 'NOT_FOUND')
          : HttpResponse.json({ ...graded, lessonCode: String(params.code) }),
      ),
    )
    renderList()
    await group()

    const card = featured()
    expect(within(card).getByRole('heading', { name: 'Reading Day 5' })).toBeVisible()
    expect(card).toHaveTextContent(`${COPY.scoreLabel} 35 / 48`)
    expect(within(card).getByRole('link', { name: new RegExp(COPY.openResult) })).toHaveAttribute(
      'href',
      '/lessons/L2-B1-05/word-test',
    )
  })

  it('동그라미를 누르면 그 회차 제출 화면', async () => {
    const user = userEvent.setup()
    const { router } = renderList()
    const box = await group()

    await user.click(stamp(box, 3))

    expect(router.state.location.pathname).toBe('/lessons/L2-B1-03/word-test')
    expect(await screen.findByText(COPY.guide[0])).toBeInTheDocument()
  })

  it('낼 시험이 없으면(전부 404·기능 꺼짐) 빈 안내 — 판·오류 안내 없음', async () => {
    server.use(http.get(LATEST, () => problem(404, 'FEATURE_DISABLED')))
    renderList()

    expect(await screen.findByText(COPY.listEmpty)).toBeInTheDocument()
    expect(screen.getByText(COPY.listEmptySub)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '겨울 1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('최근 제출을 묻는 동안은 "불러오는 중" — 동그라미가 하나씩 바뀌지 않게 다 온 뒤 그린다', async () => {
    WORD_TEST_MOCK.noSheetCodes = []
    server.use(
      http.get(LATEST, ({ params }) =>
        params.code === 'L2-B1-05' ? hold() : new HttpResponse(null, { status: 204 }),
      ),
    )
    renderList()

    expect(await screen.findByRole('status')).toHaveTextContent(COPY.listLoading)
    await waitFor(() => expect(latestCalls).toHaveLength(5))
    expect(screen.queryByRole('heading', { name: '겨울 1' })).not.toBeInTheDocument()
  })

  it('회차 목록을 받지 못하면(500) 안내 + 다시 시도', async () => {
    server.use(
      http.get('*/api/v1/student/classes/:classId/lessons', () => problem(500, 'INTERNAL')),
    )
    renderList()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(latestCalls).toHaveLength(0)
  })
})
