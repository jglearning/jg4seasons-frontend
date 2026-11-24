import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { buildItems, resetWordTestMock, WORD_TEST_MOCK } from '../../mocks/wordTestData'
import { hold } from '../../test/hold'
import { renderRoutes } from '../../test/render'
import type { WordTestSubmission } from './wordTestApi'
import { COPY, POLL_MS, SLOW_MS } from './wordTestCopy'

// jsdom은 그림을 읽지 못한다 — 줄이기는 코드로 만든 작은 JPEG 머리 바이트로 대신(답안지 사진을 저장소에 넣지 않는다)
vi.mock('./resizeImage', () => ({
  resizeImage: vi.fn(
    async () => new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
  ),
}))

const CODE = 'L2-B1-05'
const PATH = `/lessons/${CODE}/word-test`

/** 보낸 요청: 경로(메서드 포함)와 제출 본문 */
let requests: string[]
let submitBodies: Array<Record<string, unknown>>
let uploadCsrf: Array<string | null>

beforeEach(() => {
  resetAuthMock()
  resetWordTestMock()
  setMockSession('student')
  // jsdom에는 objectURL이 없다
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:photo'),
    configurable: true,
    writable: true,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
    writable: true,
  })
  requests = []
  submitBodies = []
  uploadCsrf = []
  server.events.on('request:start', async ({ request }) => {
    const url = new URL(request.url)
    requests.push(`${request.method} ${url.pathname}`)
    if (request.method === 'POST' && url.pathname === '/api/v1/word-tests/submissions') {
      submitBodies.push(JSON.parse(await request.clone().text()))
    }
    if (request.method === 'PUT' && url.pathname.startsWith('/mock-upload/')) {
      uploadCsrf.push(request.headers.get('X-CSRF'))
    }
  })
})

afterEach(() => {
  server.events.removeAllListeners()
})

const photo = () => new File([new Uint8Array([1, 2, 3])], 'page.jpg', { type: 'image/jpeg' })
const input = () => screen.getByTestId('photo-input') as HTMLInputElement
const sendButton = () => screen.getByRole('button', { name: COPY.send })
const polls = () => requests.filter((r) => /^GET \/api\/v1\/word-tests\/submissions\/\d+$/.test(r))

function problem(status: number, code: string, title = '오류') {
  return HttpResponse.json(
    { title, status, code, requestId: 'r1' },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

function submission(over: Partial<WordTestSubmission>): WordTestSubmission {
  return {
    id: 500,
    lessonCode: CODE,
    section: 'B',
    attemptNo: 1,
    status: 'pending',
    score: null,
    total: 48,
    submittedAt: '2026-11-26T05:05:12Z',
    gradedAt: null,
    ...over,
  }
}

/** 오류 줄(role alert, 자리는 늘 있음)에 그 글이 나올 때까지 */
async function alertWith(text: string) {
  expect(await screen.findByText(text)).toHaveAttribute('role', 'alert')
}

/** 실제 시간으로 기다린다 — 목 응답은 타이머가 아닌 비동기로 오므로 가짜 타이머로는 진행되지 않는다 */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 찍기 화면까지 열고 사진을 고른다 */
async function pickPhoto() {
  const user = userEvent.setup()
  renderRoutes(routes, { initialEntries: [PATH] })
  await screen.findByRole('button', { name: COPY.take })
  await user.upload(input(), photo())
  await screen.findByRole('img', { name: '찍은 답안지' })
  return user
}

describe('찍기 화면', () => {
  it('처음 들어오면 머리 줄·안내 세 줄·찍기 버튼, 카메라 입력은 뒤쪽 카메라 사진만', async () => {
    renderRoutes(routes, { initialEntries: [PATH] })
    expect(await screen.findByRole('heading', { name: COPY.title })).toBeInTheDocument()
    expect(screen.getByText(CODE)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: COPY.take })).toBeEnabled()
    for (const line of COPY.guide) expect(screen.getByText(line)).toBeInTheDocument()
    expect(input()).toHaveAttribute('accept', 'image/*')
    expect(input()).toHaveAttribute('capture', 'environment')
    expect(requests).toContain(`GET /api/v1/word-tests/lessons/${CODE}/latest`)
  })

  it('사진을 고르면 미리보기와 다시 찍기·채점 받기', async () => {
    await pickPhoto()
    expect(screen.getByRole('button', { name: COPY.retake })).toBeEnabled()
    expect(sendButton()).toBeEnabled()
    expect(screen.queryByText(COPY.guide[0])).not.toBeInTheDocument()
  })
})

describe('올리기', () => {
  it('성공: 주소 발급 → PUT(쿠키·CSRF 없음) → 제출(B 영역) → 채점 중 → 결과 점수', async () => {
    WORD_TEST_MOCK.gradedAtPoll = 1
    const user = await pickPhoto()
    await user.click(sendButton())

    const total = buildItems(48).filter((item) => item.result === 'correct').length
    expect(await screen.findByText(`${total} / 48`)).toBeInTheDocument()
    expect(requests.filter((r) => !r.startsWith('GET'))).toEqual([
      'POST /api/v1/word-tests/uploads',
      expect.stringMatching(/^PUT \/mock-upload\/homework\//),
      'POST /api/v1/word-tests/submissions',
    ])
    expect(uploadCsrf).toEqual([null])
    expect(submitBodies).toHaveLength(1)
    expect(submitBodies[0]).toMatchObject({ lessonCode: CODE, section: 'B' })
    expect(submitBodies[0].clientSubmissionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(submitBodies[0].imageKey).toMatch(/^homework\//)
  })

  it('업로드(PUT)가 실패하면 미리보기에 오류 줄, 제출은 보내지 않는다', async () => {
    server.use(http.put('*/mock-upload/*', () => new HttpResponse(null, { status: 403 })))
    const user = await pickPhoto()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await user.click(sendButton())

    await alertWith(COPY.sendFailed)
    expect(screen.getByRole('img', { name: '찍은 답안지' })).toBeInTheDocument()
    expect(sendButton()).toBeEnabled()
    expect(submitBodies).toHaveLength(0)
  })

  it('주소 발급이 실패해도 같은 오류 줄', async () => {
    server.use(http.post('*/api/v1/word-tests/uploads', () => problem(500, 'INTERNAL')))
    const user = await pickPhoto()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await user.click(sendButton())
    await alertWith(COPY.sendFailed)
  })

  it('제출이 실패한 뒤 다시 누르면 같은 clientSubmissionId로 다시 보낸다', async () => {
    server.use(
      http.post('*/api/v1/word-tests/submissions', () => problem(500, 'INTERNAL'), { once: true }),
    )
    const user = await pickPhoto()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await user.click(sendButton())
    await alertWith(COPY.sendFailed)

    await user.click(sendButton())
    expect(await screen.findByText(COPY.grading)).toBeInTheDocument()
    expect(submitBodies).toHaveLength(2)
    expect(submitBodies[1].clientSubmissionId).toBe(submitBodies[0].clientSubmissionId)
  })

  it('사진을 다시 찍으면 새 clientSubmissionId', async () => {
    server.use(
      http.post('*/api/v1/word-tests/submissions', () => problem(500, 'INTERNAL'), { once: true }),
    )
    const user = await pickPhoto()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await user.click(sendButton())
    await screen.findByText(COPY.sendFailed)

    await user.upload(input(), photo())
    await user.click(sendButton())
    await screen.findByText(COPY.grading)
    expect(submitBodies[1].clientSubmissionId).not.toBe(submitBodies[0].clientSubmissionId)
  })

  it('보내는 동안 채점 받기·다시 찍기가 잠기고(포커스는 남음) 두 번 보내지 않는다', async () => {
    server.use(http.post('*/api/v1/word-tests/submissions', () => hold()))
    const user = await pickPhoto()
    const openPicker = vi.spyOn(input(), 'click')
    await user.click(sendButton())
    await vi.waitFor(() => expect(submitBodies).toHaveLength(1))
    expect(sendButton()).toHaveAttribute('aria-disabled', 'true')
    expect(sendButton()).toHaveFocus()
    expect(screen.getByRole('button', { name: COPY.retake })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await user.click(sendButton())
    await user.click(screen.getByRole('button', { name: COPY.retake }))
    expect(submitBodies).toHaveLength(1)
    expect(openPicker).not.toHaveBeenCalled()
  })

  it.each([
    [400, 'INVALID_IMAGE', COPY.badImage],
    [429, 'DAILY_LIMIT', COPY.dailyLimit],
  ])('제출 %i %s → "%s"', async (status, code, text) => {
    server.use(http.post('*/api/v1/word-tests/submissions', () => problem(status, code)))
    const user = await pickPhoto()
    await user.click(sendButton())
    await alertWith(text)
  })

  it('하루 한도: 목도 네 번째 제출을 429로 막는다', async () => {
    WORD_TEST_MOCK.dailyLimit = 0
    const user = await pickPhoto()
    await user.click(sendButton())
    await alertWith(COPY.dailyLimit)
  })
})

describe('채점 중', () => {
  // 실제 시간 약 4.5초: 제출 직후 1번(grading) → 2초 뒤 2번(graded) → 2.5초 더 기다려도 3번째 없음
  it('2초마다 조회하고 graded에서 멈춘다', { timeout: 15_000 }, async () => {
    WORD_TEST_MOCK.gradedAtPoll = 2
    const user = await pickPhoto()
    await user.click(sendButton())

    expect(await screen.findByText(COPY.grading)).toBeInTheDocument()
    await vi.waitFor(() => expect(polls()).toHaveLength(1))
    expect(await screen.findByText(/ \/ 48$/, {}, { timeout: POLL_MS + 1500 })).toBeInTheDocument()
    expect(polls()).toHaveLength(2)

    await wait(POLL_MS + 500)
    expect(polls()).toHaveLength(2)
  })

  it('failed에서 멈추고 실패 안내 + 다시 찍기 → 찍기 화면', { timeout: 10_000 }, async () => {
    server.use(
      http.get('*/api/v1/word-tests/lessons/:code/latest', () =>
        HttpResponse.json(submission({ status: 'grading' })),
      ),
      http.get('*/api/v1/word-tests/submissions/:id', () =>
        HttpResponse.json(submission({ status: 'failed' })),
      ),
    )
    const user = userEvent.setup()
    renderRoutes(routes, { initialEntries: [PATH] })
    expect(await screen.findByRole('alert')).toHaveTextContent(COPY.failed)
    expect(polls()).toHaveLength(1)
    await wait(POLL_MS + 500)
    expect(polls()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: COPY.retake }))
    expect(screen.getByRole('button', { name: COPY.take })).toBeInTheDocument()
  })

  // setTimeout만 가짜로 — 조회 응답(목)은 실제 비동기로 받고, 60초 안내 타이머만 앞당긴다
  it('60초가 넘으면 안내 문구를 바꾼다', async () => {
    server.use(
      http.get('*/api/v1/word-tests/lessons/:code/latest', () =>
        HttpResponse.json(submission({ status: 'pending' })),
      ),
      http.get('*/api/v1/word-tests/submissions/:id', () => hold()),
    )
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    renderRoutes(routes, { initialEntries: [PATH] })
    await vi.waitFor(() => expect(screen.getByText(COPY.gradingDetail)).toBeInTheDocument())
    await act(() => vi.advanceTimersByTimeAsync(SLOW_MS))
    expect(screen.getByText(COPY.gradingSlow)).toBeInTheDocument()
    expect(screen.queryByText(COPY.gradingDetail)).not.toBeInTheDocument()
  })

  // 안전장치: 1단계에는 오지 않는 값이 와도 2초 조회에 갇히지 않는다 — 조회를 멈추고 홈으로 나갈 길
  it.each(['confirming', 'rejected', 'unknown_status'])(
    '%s가 오면 조회를 멈추고 확인 안내 + 홈으로',
    { timeout: 10_000 },
    async (status) => {
      server.use(
        http.get('*/api/v1/word-tests/lessons/:code/latest', () =>
          HttpResponse.json(submission({ status: 'pending' })),
        ),
        http.get('*/api/v1/word-tests/submissions/:id', () =>
          HttpResponse.json({ ...submission({}), status }),
        ),
      )
      renderRoutes(routes, { initialEntries: [PATH] })
      expect(await screen.findByText(COPY.held)).toBeInTheDocument()
      expect(screen.getByText(COPY.heldDetail)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: COPY.home })).toHaveAttribute('href', '/')
      expect(polls()).toHaveLength(1)
      await wait(POLL_MS + 500)
      expect(polls()).toHaveLength(1)
    },
  )

  it('최근 제출이 confirming이면 조회 없이 확인 안내', async () => {
    server.use(
      http.get('*/api/v1/word-tests/lessons/:code/latest', () =>
        HttpResponse.json(submission({ status: 'confirming' })),
      ),
    )
    renderRoutes(routes, { initialEntries: [PATH] })
    expect(await screen.findByText(COPY.held)).toBeInTheDocument()
    expect(polls()).toHaveLength(0)
  })
})

describe('다시 들어오기', () => {
  it('최근 제출이 채점 중이면 그 제출을 이어서 조회한다', async () => {
    server.use(
      http.get('*/api/v1/word-tests/lessons/:code/latest', () =>
        HttpResponse.json(submission({ id: 777, status: 'grading' })),
      ),
      http.get('*/api/v1/word-tests/submissions/:id', ({ params }) =>
        HttpResponse.json(
          submission({ id: Number(params.id), status: 'graded', score: 30, total: 35, items: [] }),
        ),
      ),
    )
    renderRoutes(routes, { initialEntries: [PATH] })
    expect(await screen.findByText('30 / 35')).toBeInTheDocument()
    expect(polls()).toEqual(['GET /api/v1/word-tests/submissions/777'])
  })

  it('최근 제출이 끝났으면 다시 조회하지 않고 그 결과', async () => {
    server.use(
      http.get('*/api/v1/word-tests/lessons/:code/latest', () =>
        HttpResponse.json(
          submission({ status: 'graded', score: 44, total: 48, gradedAt: '2026-11-26T05:05:21Z' }),
        ),
      ),
    )
    renderRoutes(routes, { initialEntries: [PATH] })
    expect(await screen.findByText('44 / 48')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '철자 쓰기 점수' })).toHaveAttribute(
      'aria-valuenow',
      '44',
    )
    expect(polls()).toHaveLength(0)
  })

  it('잠긴 회차(423)는 서버 문구와 홈으로', async () => {
    renderRoutes(routes, { initialEntries: ['/lessons/L2-B1-09/word-test'] })
    expect(await screen.findByText('아직 열리지 않은 회차예요')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: COPY.home })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('button', { name: COPY.take })).not.toBeInTheDocument()
  })
})
