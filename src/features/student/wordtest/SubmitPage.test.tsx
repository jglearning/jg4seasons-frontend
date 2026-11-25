import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../../app/routes'
import { resetAuthMock, setMockSession } from '../../../mocks/handlers'
import { server } from '../../../mocks/node'
import {
  buildItems,
  resetWordTestMock,
  studentItems,
  WORD_TEST_MOCK,
} from '../../../mocks/wordTestData'
import { hold } from '../../../test/hold'
import { renderRoutes } from '../../../test/render'
import { resizeImage } from './resizeImage'
import { latestQuery, type WordTestItem, type WordTestSubmission } from './wordTestApi'
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

describe('결과(#173)', () => {
  const ITEMS: WordTestItem[] = [
    { no: 1, prompt: '아름다운', written: 'beautful', result: 'wrong', answer: 'beautiful' },
    { no: 2, prompt: '도서관', written: 'library', result: 'correct', answer: 'library' },
    { no: 3, prompt: '받다', written: '', result: 'blank', answer: 'receive' },
    { no: 4, prompt: '조용한', written: 'qui', result: 'unclear', answer: null },
    { no: 5, prompt: '날씨', written: 'weather', result: 'correct', answer: 'weather' },
  ]

  function renderResult(
    items: WordTestItem[] | undefined,
    score: number,
    total = items?.length ?? 0,
  ) {
    server.use(
      http.get('*/api/v1/word-tests/lessons/:code/latest', () =>
        HttpResponse.json(
          submission({ status: 'graded', score, total, gradedAt: '2026-11-26T05:05:21Z', items }),
        ),
      ),
    )
    const { client } = renderRoutes(routes, { initialEntries: [PATH] })
    return { user: userEvent.setup(), client }
  }

  const groupTitles = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
  const row = (prompt: string) => screen.getByText(prompt).closest('li') as HTMLElement
  /** 문항 줄 안 "내가 쓴 것"·"정답" 이름 칸 옆의 값 */
  const valueOf = (rowEl: HTMLElement, label: string) =>
    within(rowEl).getByText(label).nextElementSibling?.textContent

  it('다시 볼 것부터 묶는다: 틀림 → 안 씀 → 잘 안 보임, 맞은 단어는 접혀 있다', async () => {
    renderResult(ITEMS, 2)
    expect(await screen.findByText('2 / 5')).toBeInTheDocument()
    expect(groupTitles()).toEqual(['틀린 단어 1개', '안 쓴 단어 1개', '잘 안 보인 단어 1개'])
    const toggle = screen.getByRole('button', { name: /맞은 단어 2개/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('도서관')).not.toBeInTheDocument()
    expect(screen.getByText(COPY.unclearNote(1))).toBeInTheDocument()
  })

  it('틀림·안 씀은 내가 쓴 것과 정답, 잘 안 보임은 정답 없이 안내', async () => {
    renderResult(ITEMS, 2)
    await screen.findByText('2 / 5')

    const wrong = row('아름다운')
    expect(wrong).toHaveTextContent('1번 아름다운 틀림')
    expect(valueOf(wrong, COPY.mine)).toBe('beautful')
    expect(valueOf(wrong, COPY.answer)).toBe('beautiful')

    const blank = row('받다')
    expect(valueOf(blank, COPY.mine)).toBe(COPY.blank)
    expect(valueOf(blank, COPY.answer)).toBe('receive')

    const unclear = row('조용한')
    expect(unclear).toHaveTextContent(COPY.unclearItem)
    expect(unclear).not.toHaveTextContent('quiet')
    expect(unclear).not.toHaveTextContent(COPY.answer)
  })

  it('맞은 단어를 펼치면 쓴 글자만(정답 줄 없음), 다시 누르면 접힌다', async () => {
    const { user } = renderResult(ITEMS, 2)
    await screen.findByText('2 / 5')
    const toggle = screen.getByRole('button', { name: /맞은 단어 2개/ })
    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const correct = row('도서관')
    expect(correct).toHaveTextContent('2번 도서관 맞음')
    expect(correct).toHaveTextContent('library')
    expect(correct).not.toHaveTextContent(COPY.answer)
    await user.click(toggle)
    expect(screen.queryByText('도서관')).not.toBeInTheDocument()
  })

  it('틀린 단어가 있으면 그 단어만 보는 단어 카드로 가는 주 버튼(#187), 다시 풀고 올리기 → 찍기 화면', async () => {
    const { user } = renderResult(ITEMS, 2)
    await screen.findByText('2 / 5')
    // 틀림(beautiful)·안 씀(receive)의 정답 철자만 — 맞음·판단 못 함(정답 null)은 빠진다
    const href = screen.getByRole('link', { name: COPY.reviewWords }).getAttribute('href')!
    const url = new URL(href, 'http://x')
    expect(url.pathname).toBe(`/lessons/${CODE}/words`)
    expect(url.searchParams.get('only')).toBe('beautiful,receive')
    expect(screen.getByRole('link', { name: COPY.home })).toHaveAttribute('href', '/')
    expect(screen.getByText(COPY.footnote)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: COPY.retry }))
    expect(screen.getByRole('button', { name: COPY.take })).toBeInTheDocument()
  })

  // 리뷰 지적: 새로 낸 뒤에도 최근 제출 캐시에 옛 결과가 남아 홈 진입 줄·다시 들어오기에서 옛 결과가 보였다
  it('다시 풀고 올리면 새 결과가 보이고 최근 제출 캐시도 새 제출로 바뀐다', async () => {
    WORD_TEST_MOCK.gradedAtPoll = 1
    const { user, client } = renderResult(ITEMS, 2)
    await screen.findByText('2 / 5')
    await user.click(screen.getByRole('button', { name: COPY.retry }))
    await user.upload(input(), photo())
    await user.click(await screen.findByRole('button', { name: COPY.send }))

    expect(await screen.findByText(/ \/ 48$/)).toBeInTheDocument()
    expect(screen.queryByText('2 / 5')).not.toBeInTheDocument()
    const cached = client.getQueryData<WordTestSubmission>(latestQuery(CODE).queryKey)
    expect(cached?.id).toBe(318)
    expect(cached?.status).toBe('graded')
  })

  it('제출하고 조회 응답이 오기 전에도 옛 최근 제출은 다시 받을 대상(stale)이 된다', async () => {
    server.use(http.get('*/api/v1/word-tests/submissions/:id', () => hold()))
    const { user, client } = renderResult(ITEMS, 2)
    await screen.findByText('2 / 5')
    await user.click(screen.getByRole('button', { name: COPY.retry }))
    await user.upload(input(), photo())
    await user.click(await screen.findByRole('button', { name: COPY.send }))

    expect(await screen.findByText(COPY.grading)).toBeInTheDocument()
    expect(client.getQueryState(latestQuery(CODE).queryKey)?.isInvalidated).toBe(true)
  })

  it('모두 맞으면 "모두 맞았어요", 틀린 단어 묶음과 단어 카드 버튼이 없다', async () => {
    const all = ITEMS.filter((item) => item.result === 'correct')
    renderResult(all, all.length)
    await screen.findByText('2 / 2')
    expect(screen.getByText(COPY.allCorrect)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: COPY.reviewWords })).not.toBeInTheDocument()
    expect(screen.queryByText(/잘 안 보인 글자/)).not.toBeInTheDocument()
  })

  it('잘 안 보인 단어만 있으면 "모두 맞았어요"도 단어 카드 버튼도 없다', async () => {
    const items = ITEMS.filter((item) => item.result === 'correct' || item.result === 'unclear')
    renderResult(items, 2)
    await screen.findByText('2 / 3')
    expect(screen.queryByText(COPY.allCorrect)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: COPY.reviewWords })).not.toBeInTheDocument()
    expect(groupTitles()).toEqual(['잘 안 보인 단어 1개'])
  })

  it('문항 수는 서버 items 그대로 — 목 48문항 묶음 개수의 합이 48', async () => {
    const items = studentItems(48)
    // 학생 응답의 unclear 문항은 정답이 null(`BE #73`)
    expect(items.filter((item) => item.result === 'unclear').map((item) => item.answer)).toEqual([
      null,
      null,
      null,
    ])
    const score = items.filter((item) => item.result === 'correct').length
    renderResult(items, score)
    await screen.findByText(`${score} / 48`)
    const counts = [...groupTitles(), screen.getByRole('button', { name: /맞은 단어/ }).textContent]
      .map((text) => Number(/(\d+)개/.exec(text ?? '')?.[1]))
      .reduce((a, b) => a + b, 0)
    expect(counts).toBe(48)
    expect(screen.getAllByRole('listitem')).toHaveLength(48 - score)
  })

  // 리뷰 지적: 모르는 result 문항이 묶음에서 빠져 "모두 맞았어요"가 점수와 어긋났다
  it('모르는 result 문항은 "잘 안 보인 단어"로 보이고 "모두 맞았어요"는 뜨지 않는다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const items = [
      ITEMS[1],
      { ...ITEMS[0], result: 'mystery' as unknown as WordTestItem['result'] },
    ]
    renderResult(items, 1)
    await screen.findByText('1 / 2')
    expect(screen.queryByText(COPY.allCorrect)).not.toBeInTheDocument()
    expect(groupTitles()).toEqual(['잘 안 보인 단어 1개'])
    expect(row('아름다운')).toHaveTextContent(COPY.unclearItem)
    expect(row('아름다운')).not.toHaveTextContent('beautiful')
    expect(logged).toHaveBeenCalledWith('[wordtest] unknown item result', 1)
  })

  it('문항이 모두 맞음이어도 서버 점수가 만점이 아니면 "모두 맞았어요"를 띄우지 않는다', async () => {
    const all = ITEMS.filter((item) => item.result === 'correct')
    renderResult(all, 1, 2)
    await screen.findByText('1 / 2')
    expect(screen.queryByText(COPY.allCorrect)).not.toBeInTheDocument()
  })

  it('graded인데 items가 없으면(계약 밖) 점수와 다시 풀기만, 기록을 남긴다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderResult(undefined, 3, 5)
    await screen.findByText('3 / 5')
    expect(screen.queryByText(COPY.allCorrect)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: COPY.reviewWords })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: COPY.retry })).toBeInTheDocument()
    expect(logged).toHaveBeenCalledWith('[wordtest] graded without items', 500)
  })

  it('안 쓴 단어만 있어도 단어 카드 버튼이 있다', async () => {
    const items = ITEMS.filter((item) => item.result !== 'wrong' && item.result !== 'unclear')
    renderResult(items, 2)
    await screen.findByText('2 / 3')
    expect(screen.getByRole('link', { name: COPY.reviewWords })).toBeInTheDocument()
  })
})

describe('조회·사진 실패(#173 리뷰)', () => {
  it('제출 조회가 다시 해도 같은 오류(404)면 채점 중에 갇히지 않고 서버 문구 + 홈으로', async () => {
    server.use(
      http.get('*/api/v1/word-tests/lessons/:code/latest', () =>
        HttpResponse.json(submission({ status: 'grading' })),
      ),
      http.get('*/api/v1/word-tests/submissions/:id', () =>
        problem(404, 'NOT_FOUND', '제출을 찾을 수 없어요'),
      ),
    )
    renderRoutes(routes, { initialEntries: [PATH] })
    expect(await screen.findByText('제출을 찾을 수 없어요')).toBeInTheDocument()
    expect(screen.queryByText(COPY.grading)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: COPY.home })).toHaveAttribute('href', '/')
    expect(polls()).toHaveLength(1)
  })

  it('모르는 status는 확인 안내로 받고 경고를 남긴다(confirming·rejected는 남기지 않음)', async () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {})
    server.use(
      http.get('*/api/v1/word-tests/lessons/:code/latest', () =>
        HttpResponse.json({ ...submission({}), status: 'cancelled' }),
      ),
    )
    renderRoutes(routes, { initialEntries: [PATH] })
    expect(await screen.findByText(COPY.held)).toBeInTheDocument()
    expect(warned).toHaveBeenCalledWith('[wordtest] unknown status', 'cancelled')
  })

  it('confirming은 경고를 남기지 않는다', async () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {})
    server.use(
      http.get('*/api/v1/word-tests/lessons/:code/latest', () =>
        HttpResponse.json(submission({ status: 'confirming' })),
      ),
    )
    renderRoutes(routes, { initialEntries: [PATH] })
    expect(await screen.findByText(COPY.held)).toBeInTheDocument()
    expect(warned).not.toHaveBeenCalled()
  })

  it('사진을 줄이지 못하면 오류 줄 + 원인 기록(이름·고정 메시지)', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(resizeImage).mockRejectedValueOnce(new Error('image decode failed'))
    const user = userEvent.setup()
    renderRoutes(routes, { initialEntries: [PATH] })
    await screen.findByRole('button', { name: COPY.take })
    await user.upload(input(), photo())

    await alertWith(COPY.badImage)
    expect(screen.queryByRole('img', { name: '찍은 답안지' })).not.toBeInTheDocument()
    expect(logged).toHaveBeenCalledWith('[wordtest] photo prepare failed', {
      name: 'Error',
      message: 'image decode failed',
    })
  })
})
