import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { buildWords, resetWordMock, WORD_MOCK } from '../../mocks/wordData'
import { renderRoutes } from '../../test/render'

let play: ReturnType<typeof vi.spyOn>
let saved: Array<Record<string, unknown>>

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
  resetWordMock()
  setMockSession('student')
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  saved = []
  server.events.on('request:start', async ({ request }) => {
    if (new URL(request.url).pathname.endsWith('/word-study')) {
      saved.push(JSON.parse(await request.clone().text()))
    }
  })
})

afterEach(async () => {
  // 화면이 닫힐 때도 저장(keepalive PUT)이 간다 — 그 요청이 다음 테스트 기록에 섞이지 않게 먼저 닫고 기다린다
  cleanup()
  await new Promise((resolve) => setTimeout(resolve, 20))
  server.events.removeAllListeners()
})

function renderWords(code = 'L2-B1-05') {
  return renderRoutes(routes, { initialEntries: [`/lessons/${code}/words`] })
}

/** 재생한 소리 주소들(오디오 요소의 src) */
const playedUrls = () =>
  play.mock.contexts.map((element: unknown) => (element as HTMLAudioElement).getAttribute('src'))
const card = () => screen.getByRole('region', { name: '단어 카드' })
/** 종이(위·아래 자리에 따라 이름이 바뀐다) */
const sheet = () => screen.getByRole('button', { name: /^(올려서 뜻 보기|내려서 단어 보기)$/ })
const meaning = (text: string) => screen.getByText(text)
const word = (text: string) => screen.getByText(text)
/** 종이가 아래 자리에서 올라간 거리 */
const shift = () => sheet().style.getPropertyValue('--shift')
const counter = (text: string) => screen.findByText(text)

/** 종이 높이(jsdom은 배치를 하지 않아 0) — 끌기 테스트에서만 정한다 */
const SHEET_HEIGHT = 200
function sheetHeight() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    height: SHEET_HEIGHT,
  } as DOMRect)
}

/** 종이를 dy만큼 끈다(위 +, 아래 -). 놓지 않음 */
function drag(dy: number) {
  fireEvent.pointerDown(sheet(), { pointerId: 1, clientY: 500, isPrimary: true })
  fireEvent.pointerMove(sheet(), { pointerId: 1, clientY: 500 - dy, isPrimary: true })
}

function release() {
  fireEvent.pointerUp(sheet(), { pointerId: 1, isPrimary: true })
  // 끈 뒤 브라우저가 보내는 click — 끌기였으면 자리를 바꾸지 않는다
  fireEvent.click(sheet())
}

/** 뜻이 보이는(종이가 위) 상태인가 — 단어는 가려지고 뜻은 읽힌다 */
function expectUp(english: string, korean: string) {
  expect(sheet()).toHaveAccessibleName('내려서 단어 보기')
  expect(sheet()).toHaveAttribute('aria-expanded', 'true')
  expect(meaning(korean)).not.toHaveAttribute('aria-hidden')
  expect(word(english).closest('[aria-hidden="true"]')).not.toBeNull()
}

/** 단어가 보이는(종이가 아래) 상태인가 — 뜻은 가려지고 단어는 읽힌다 */
function expectDown(english: string, korean: string) {
  expect(sheet()).toHaveAccessibleName('올려서 뜻 보기')
  expect(sheet()).toHaveAttribute('aria-expanded', 'false')
  expect(meaning(korean)).toHaveAttribute('aria-hidden', 'true')
  expect(word(english).closest('[aria-hidden="true"]')).toBeNull()
}

/** 첫 단어를 음원이 없는 대명사(어휘책에만 있는 단어)로 바꾼 응답 — 출처로 음원을 짐작하지 않는지도 본다 */
function bareFirstWord() {
  server.use(
    http.get('*/api/v1/student/lessons/:code/words', () => {
      const words = buildWords()
      const [first, ...rest] = words.items
      return HttpResponse.json({
        ...words,
        items: [{ ...first, pos: 'pron', audio: null, exampleAudio: null }, ...rest],
      })
    }),
  )
}

describe('S-06 단어 카드', () => {
  it('첫 카드: 출처·품사·단어, 발음 1회 자동 재생(표시는 없음, v0.2), 진행 1 / 57 — 뜻은 종이 아래, 예문은 없다', async () => {
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)

    expect(card()).toHaveTextContent('어휘책')
    expect(card()).toHaveTextContent('동사')
    expect(card()).toHaveTextContent(WORD_MOCK.english(1))
    expect(screen.queryByText('발음 자동 재생')).not.toBeInTheDocument()
    // 회차 코드 L2-B1-05 → 레벨 green(단어 응답에는 레벨이 없다)
    expect(document.documentElement).toHaveAttribute('data-level', 'green')
    expectDown(WORD_MOCK.english(1), WORD_MOCK.korean(1))
    expect(shift()).toBe('0px')
    expect(card()).not.toHaveTextContent('우리는 매일 점심 뒤에 수다를 떤다.')
    expect(card()).not.toHaveTextContent('We chat after lunch')
    expect(playedUrls()).toEqual(['/mock-audio/word-900.wav'])
    expect(screen.getByRole('progressbar', { name: '단어 카드' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    )
    expect(screen.queryByRole('link', { name: /암기·리콜·스펠/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /정답 확인/ })).not.toBeInTheDocument()
  })

  it('단어 없음: 카드 자리에 안내 상자, 머리에는 제목·회차 코드만(진행 수·카드·버튼 없음)', async () => {
    server.use(
      http.get('*/api/v1/student/lessons/:code/words', () =>
        HttpResponse.json({ ...buildWords(), items: [], total: 0 }),
      ),
    )
    renderWords('K-B1-S1')

    expect(await screen.findByText('이 수업에는 아직 단어가 없어요')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '단어 카드' })).toBeInTheDocument()
    expect(screen.getByText('K-B1-S1')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '단어 카드' })).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다음' })).not.toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('data-level', 'black')
  })

  it('음원 없는 단어(BE #38): 자동 재생 표시·재생 없이, 듣기 버튼은 누를 수 없다, 새 품사 표기', async () => {
    bareFirstWord()
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)

    expect(card()).toHaveTextContent('대명사')
    expect(card()).not.toHaveTextContent('발음 자동 재생')
    expect(play).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '단어 듣기' })).toBeDisabled()
  })

  it('종이를 누르면 위로 가 단어를 가리고 뜻을 보이고, 한 번 더 누르면 돌아온다', async () => {
    const user = userEvent.setup()
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)

    await user.click(sheet())
    expectUp(WORD_MOCK.english(1), WORD_MOCK.korean(1))
    expect(shift()).toBe('100%')

    await user.click(sheet())
    expectDown(WORD_MOCK.english(1), WORD_MOCK.korean(1))
    expect(shift()).toBe('0px')
  })

  it('키보드: 종이에서 Enter로 위·아래를 바꾼다', async () => {
    const user = userEvent.setup()
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)

    sheet().focus()
    await user.keyboard('{Enter}')
    expectUp(WORD_MOCK.english(1), WORD_MOCK.korean(1))
    await user.keyboard('{Enter}')
    expectDown(WORD_MOCK.english(1), WORD_MOCK.korean(1))
  })

  it('끌면 종이 끝이 손가락을 따라 넘어가고(카드 위 끝까지), 가운데선을 넘기고 놓으면 위로 넘어간다', async () => {
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)
    sheetHeight()

    drag(130)
    expect(shift()).toBe('130px')
    expect(sheet()).toHaveAttribute('aria-expanded', 'false')

    // 끝은 카드 위 끝(종이 높이의 2배)까지만
    fireEvent.pointerMove(sheet(), { pointerId: 1, clientY: 0, isPrimary: true })
    expect(shift()).toBe(`${SHEET_HEIGHT * 2}px`)
    fireEvent.pointerMove(sheet(), { pointerId: 1, clientY: 500 - 260, isPrimary: true })

    release()
    expectUp(WORD_MOCK.english(1), WORD_MOCK.korean(1))
    expect(shift()).toBe('100%')
  })

  it('가운데선을 넘기 전에 놓으면 아래로 돌아간다(아래로 끌면 내려가지 않는다)', async () => {
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)
    sheetHeight()

    drag(-50)
    expect(shift()).toBe('0px')
    fireEvent.pointerMove(sheet(), { pointerId: 1, clientY: 500 - 190, isPrimary: true })
    expect(shift()).toBe('190px')

    release()
    expectDown(WORD_MOCK.english(1), WORD_MOCK.korean(1))
    expect(shift()).toBe('0px')
  })

  it('넘어간 종이를 가운데선 아래로 내리고 놓으면 돌아와 뜻을 가린다', async () => {
    const user = userEvent.setup()
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)
    await user.click(sheet())
    sheetHeight()

    drag(-260)
    expect(shift()).toBe(`${SHEET_HEIGHT * 2 - 260}px`)
    release()
    expectDown(WORD_MOCK.english(1), WORD_MOCK.korean(1))
  })

  it('넘어간 종이를 조금만 내리고 놓으면 위에 그대로(위로는 더 넘어가지 않는다)', async () => {
    const user = userEvent.setup()
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)
    await user.click(sheet())
    sheetHeight()

    drag(40)
    expect(shift()).toBe(`${SHEET_HEIGHT * 2}px`)
    fireEvent.pointerMove(sheet(), { pointerId: 1, clientY: 500 + 150, isPrimary: true })
    expect(shift()).toBe(`${SHEET_HEIGHT * 2 - 150}px`)
    release()
    expectUp(WORD_MOCK.english(1), WORD_MOCK.korean(1))
  })

  it('끌기가 취소되면(pointercancel) 원래 자리로 돌아간다', async () => {
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)
    sheetHeight()

    drag(150)
    fireEvent.pointerCancel(sheet(), { pointerId: 1, isPrimary: true })
    expectDown(WORD_MOCK.english(1), WORD_MOCK.korean(1))
    expect(shift()).toBe('0px')
  })

  it('다음·이전 카드는 아래 자리(단어 보임)에서 시작하고 자동 재생한다 — 뜻을 봐도 넘어가지 않는다', async () => {
    const user = userEvent.setup()
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)
    await user.click(sheet())
    expect(screen.getByText(`1 / ${WORD_MOCK.total}`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.getByText(`2 / ${WORD_MOCK.total}`)).toBeInTheDocument()
    expectDown(WORD_MOCK.english(2), WORD_MOCK.korean(2))
    expect(playedUrls()).toHaveLength(2)

    await user.click(sheet())
    await user.click(screen.getByRole('button', { name: '이전' }))
    expectDown(WORD_MOCK.english(1), WORD_MOCK.korean(1))
  })
  it('"단어 듣기"는 지금 단어 발음을 다시 재생한다', async () => {
    const user = userEvent.setup()
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)

    await user.click(screen.getByRole('button', { name: '단어 듣기' }))
    expect(playedUrls()).toEqual(['/mock-audio/word-900.wav', '/mock-audio/word-900.wav'])
  })

  it('자동 재생이 막히면 "눌러서 듣기"로 들을 수 있다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    play.mockRejectedValueOnce(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }))
    const user = userEvent.setup()
    renderWords()
    const listen = await screen.findByRole('button', { name: '눌러서 듣기' })
    expect(card()).not.toHaveTextContent('발음 자동 재생')

    await user.click(listen)

    expect(play).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: '눌러서 듣기' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '단어 듣기' })).toBeInTheDocument()
  })

  it('옛 카드 학습 주소(/cards)는 단어 카드로 넘긴다', async () => {
    const { router } = renderRoutes(routes, { initialEntries: ['/lessons/L2-B1-05/cards'] })
    await counter(`1 / ${WORD_MOCK.total}`)

    expect(router.state.location.pathname).toBe('/lessons/L2-B1-05/words')
    expect(screen.queryByRole('group', { name: '학습 모드' })).not.toBeInTheDocument()
  })

  it('화면을 떠나면 가장 멀리 본 카드 수를 저장한다(2.5)', async () => {
    const user = userEvent.setup()
    const { router } = renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '이전' }))

    await act(() => router.navigate('/lessons'))
    await vi.waitFor(() => expect(saved).toHaveLength(1))

    expect(saved[0]).toEqual({ cardsViewed: 3 })
    expect(WORD_MOCK.study.cardsViewed).toBe(3)
  })

  it('마지막 카드의 "완료"는 저장하고 홈으로 — 같은 값은 다시 보내지 않는다', async () => {
    const user = userEvent.setup()
    const { router } = renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)
    for (let i = 1; i < WORD_MOCK.total; i++)
      await user.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.getByText(`${WORD_MOCK.total} / ${WORD_MOCK.total}`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '완료' }))
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'))
    await vi.waitFor(() => expect(WORD_MOCK.study.cardsViewed).toBe(WORD_MOCK.total))

    expect(saved).toEqual([{ cardsViewed: WORD_MOCK.total }])
  })

  it('교재 사용 기간이 아니면(403 LICENSE_INACTIVE) 서버 문구와 회차 목록으로', async () => {
    server.use(
      http.get('*/api/v1/student/lessons/:code/words', () =>
        HttpResponse.json(
          { code: 'LICENSE_INACTIVE', title: '사용 기간이 아니에요', status: 403 },
          { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderWords()

    expect(await screen.findByRole('alert')).toHaveTextContent('사용 기간이 아니에요')
    expect(screen.getByRole('link', { name: '회차 목록으로' })).toHaveAttribute('href', '/lessons')
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('잠긴 회차(423)는 서버 문구와 회차 목록으로', async () => {
    renderWords('L2-B1-08')

    expect(await screen.findByRole('alert')).toHaveTextContent('아직 열리지 않은 회차예요')
    expect(screen.getByRole('link', { name: '회차 목록으로' })).toHaveAttribute('href', '/lessons')
  })
})
