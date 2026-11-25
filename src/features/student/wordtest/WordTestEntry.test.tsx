import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../../app/routes'
import { resetAuthMock, setMockSession } from '../../../mocks/handlers'
import { server } from '../../../mocks/node'
import { buildHome } from '../../../mocks/studentData'
import { resetWordTestMock } from '../../../mocks/wordTestData'
import { hold } from '../../../test/hold'
import { renderRoutes } from '../../../test/render'
import { latestQuery, type WordTestSubmission } from './wordTestApi'
import { COPY } from './wordTestCopy'

// 진입점은 비용 문제로 꺼 두었다(WORD_TEST_ENABLED, #191) — 진입점 자체를 보는 테스트라 켠 채로 돈다
vi.mock('../../../shared/features', () => ({ WORD_TEST_ENABLED: true }))

// S-03 홈의 단어시험 진입 줄(#173) — 최근 제출 조회(…/latest) 200·204일 때만, 그 밖은 숨기고 홈은 그대로
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

const todayCode = () => buildHome().words!.lessonCode
const entry = () => screen.queryByRole('link', { name: new RegExp(COPY.title) })
/** 홈이 그려졌다(오늘 단어 상자) */
const homeShown = () => screen.findByRole('link', { name: /오늘 단어/ })

function renderHome() {
  return renderRoutes(routes, { initialEntries: ['/'] })
}

function problem(status: number, code?: string) {
  return HttpResponse.json(
    code === undefined ? { title: 'Not Found' } : { title: '오류', status, code, requestId: 'r1' },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

const graded: WordTestSubmission = {
  id: 9,
  lessonCode: 'L2-B1-05',
  section: 'B',
  attemptNo: 1,
  status: 'graded',
  score: 35,
  total: 48,
  submittedAt: '2026-11-26T05:05:12Z',
  gradedAt: '2026-11-26T05:05:21Z',
  items: [],
}

describe('홈 단어시험 진입 줄', () => {
  it('제출이 없으면(204) 오늘 단어 회차로 가는 줄 + 안내 글, B 영역으로 조회', async () => {
    renderHome()
    await homeShown()
    const link = await screen.findByRole('link', { name: new RegExp(COPY.title) })
    expect(link).toHaveAttribute('href', `/lessons/${todayCode()}/word-test`)
    expect(link).toHaveTextContent(COPY.entryNew)
    expect(latestCalls).toEqual([`/api/v1/word-tests/lessons/${todayCode()}/latest?section=B`])
  })

  it.each([
    ['채점 결과', graded, `${COPY.scoreLabel} 35 / 48`],
    ['채점 중', { ...graded, status: 'grading', score: null, items: undefined }, COPY.grading],
    [
      '접수(pending)',
      { ...graded, status: 'pending', score: null, items: undefined },
      COPY.grading,
    ],
    ['실패', { ...graded, status: 'failed', score: null, items: undefined }, COPY.failed],
    [
      '확인 중(2단계)',
      { ...graded, status: 'confirming', score: null, items: undefined },
      COPY.held,
    ],
    ['점수 없는 graded(계약 밖)', { ...graded, score: null, items: undefined }, COPY.held],
  ] as const)('최근 제출이 %s이면 보조 글에 서버 상태', async (_, body, text) => {
    server.use(http.get(LATEST, () => HttpResponse.json(body)))
    renderHome()
    expect(await screen.findByRole('link', { name: new RegExp(COPY.title) })).toHaveTextContent(
      text,
    )
  })

  it.each([
    ['404 FEATURE_DISABLED(기능 꺼짐)', () => problem(404, 'FEATURE_DISABLED')],
    ['404 NOT_FOUND(시험지 없음)', () => problem(404, 'NOT_FOUND')],
    ['code 없는 404(백엔드 배포 전)', () => problem(404)],
    ['403 LICENSE_INACTIVE', () => problem(403, 'LICENSE_INACTIVE')],
    ['423 LESSON_LOCKED', () => problem(423, 'LESSON_LOCKED')],
    ['500', () => problem(500, 'INTERNAL')],
    ['네트워크 오류', () => HttpResponse.error()],
  ])('%s → 진입 줄이 없고 홈은 그대로', async (_, respond) => {
    server.use(http.get(LATEST, respond))
    const { client } = renderHome()
    await homeShown()
    await waitFor(() =>
      expect(client.getQueryState(latestQuery(todayCode()).queryKey)?.status).toBe('error'),
    )
    expect(entry()).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /오늘 단어/ })).toBeInTheDocument()
  })

  it('받는 중에는 그리지 않는다', async () => {
    server.use(http.get(LATEST, () => hold()))
    renderHome()
    await homeShown()
    await waitFor(() => expect(latestCalls).toHaveLength(1))
    expect(entry()).not.toBeInTheDocument()
  })

  it('오늘 단어가 없으면 조회하지 않고 줄도 없다', async () => {
    server.use(
      http.get('*/api/v1/student/home', () => HttpResponse.json({ ...buildHome(), words: null })),
    )
    const { client } = renderHome()
    await screen.findByText('다음 수업')
    expect(entry()).not.toBeInTheDocument()
    // 요청 수(비동기 이벤트) 대신 쿼리 캐시로 — 조회를 만들지 않았다
    expect(client.getQueryCache().findAll({ queryKey: ['student', 'wordTest'] })).toHaveLength(0)
    expect(latestCalls).toHaveLength(0)
  })

  it('회차는 오늘 수업이 아니라 오늘 단어 회차를 쓴다', async () => {
    const home = buildHome()
    server.use(
      http.get('*/api/v1/student/home', () =>
        HttpResponse.json({ ...home, words: { ...home.words!, lessonCode: 'L2-B1-04' } }),
      ),
    )
    renderHome()
    const link = await screen.findByRole('link', { name: new RegExp(COPY.title) })
    expect(link).toHaveAttribute('href', '/lessons/L2-B1-04/word-test')
    expect(latestCalls).toEqual(['/api/v1/word-tests/lessons/L2-B1-04/latest?section=B'])
  })
})
