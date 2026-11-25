import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { buildWords, resetWordMock, WORD_MOCK } from '../../mocks/wordData'
import { hold } from '../../test/hold'
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
const sheet = () => screen.getByRole('button', { name: /^(눌러서 뜻 보기|눌러서 단어 보기)$/ })
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

/**
 * 그리기를 브라우저처럼 — jsdom의 requestAnimationFrame은 창이 만들어진 때가 기준인 시각을 넘긴다. 전역
 * performance.now()보다 그만큼(약 1초) 작아 넘김이 그 시간만큼 늦게 끝난다(#151). 같은 기준 시각으로 약 16ms마다
 * 부른다(다음 테스트를 시작하기 전에 unstubGlobals가 되돌린다 — vite.config.ts)
 */
function browserFrames() {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 16),
  )
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
}

/** 종이가 위 자리에 다 넘어가 쉴 때까지(보이는 글 + 읽는 이름이 "눌러서 단어 보기") */
async function settledUp() {
  await waitFor(() => expect(screen.getAllByText('눌러서 단어 보기')).toHaveLength(2))
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
  expect(sheet()).toHaveAccessibleName('눌러서 단어 보기')
  expect(sheet()).toHaveAttribute('aria-expanded', 'true')
  expect(meaning(korean)).not.toHaveAttribute('aria-hidden')
  expect(word(english).closest('[aria-hidden="true"]')).not.toBeNull()
}

/** 단어가 보이는(종이가 아래) 상태인가 — 뜻은 가려지고 단어는 읽힌다 */
function expectDown(english: string, korean: string) {
  expect(sheet()).toHaveAccessibleName('눌러서 뜻 보기')
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
  it('첫 카드: 출처·품사·단어, 발음 1회 자동 재생, 진행 1 / 57 — 뜻은 종이 아래, 예문은 없다', async () => {
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)

    expect(card()).toHaveTextContent('어휘책')
    expect(card()).toHaveTextContent('동사')
    expect(card()).toHaveTextContent(WORD_MOCK.english(1))
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
    // 나갈 길은 늘 있다(#126)
    expect(screen.getByRole('button', { name: '뒤로' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/')
  })

  describe('머리 줄의 뒤로·홈으로(#126)', () => {
    it('주소로 바로 열었으면 "뒤로"는 회차 목록으로 — 나가면서 본 카드 수를 저장한다', async () => {
      const user = userEvent.setup()
      const { router } = renderWords()
      await counter(`1 / ${WORD_MOCK.total}`)
      await user.click(screen.getByRole('button', { name: '다음' }))

      await user.click(screen.getByRole('button', { name: '뒤로' }))

      expect(router.state.location.pathname).toBe('/lessons')
      await vi.waitFor(() => expect(saved).toEqual([{ cardsViewed: 2 }]))
    })

    it('앱 안에서 왔으면 "뒤로"는 온 화면으로(설정 → 단어 카드 → 설정)', async () => {
      const user = userEvent.setup()
      const { router } = renderRoutes(routes, { initialEntries: ['/settings'] })
      await screen.findByRole('heading', { level: 1 })
      await act(() => router.navigate('/lessons/L2-B1-05/words'))
      await counter(`1 / ${WORD_MOCK.total}`)

      await user.click(screen.getByRole('button', { name: '뒤로' }))

      await vi.waitFor(() => expect(router.state.location.pathname).toBe('/settings'))
    })

    it('"홈으로"는 홈으로 — 나가면서 본 카드 수를 저장한다', async () => {
      const user = userEvent.setup()
      const { router } = renderWords()
      await counter(`1 / ${WORD_MOCK.total}`)
      await user.click(screen.getByRole('button', { name: '다음' }))
      await user.click(screen.getByRole('button', { name: '다음' }))

      await user.click(screen.getByRole('link', { name: '홈으로' }))

      expect(router.state.location.pathname).toBe('/')
      await vi.waitFor(() => expect(saved).toEqual([{ cardsViewed: 3 }]))
    })
  })

  it('음원 없는 단어(BE #38): 자동 재생 없이, 듣기 버튼은 누를 수 없다, 새 품사 표기', async () => {
    bareFirstWord()
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)

    expect(card()).toHaveTextContent('대명사')
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

  it('종이의 안내 글은 누르기 기준이다 — 아래 자리 "눌러서 뜻 보기", 위 자리 "눌러서 단어 보기"(#128)', async () => {
    browserFrames()
    const user = userEvent.setup()
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)

    // 보이는 글 + 버튼의 읽는 이름
    expect(screen.getAllByText('눌러서 뜻 보기')).toHaveLength(2)
    expect(card()).not.toHaveTextContent('올려서')

    // 읽는 이름은 누르는 즉시, 종이 위 보이는 글은 넘김(140ms)이 끝난 뒤 바뀐다(#151)
    await user.click(sheet())
    expect(sheet()).toHaveAccessibleName('눌러서 단어 보기')
    await waitFor(() => expect(screen.getAllByText('눌러서 단어 보기')).toHaveLength(2))
    expect(card()).not.toHaveTextContent('내려서')
  })

  it('누르다 손가락이 조금(10px 미만) 밀려도 누르기다 — 종이가 넘어간다(#128)', async () => {
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)
    sheetHeight()

    drag(9)
    expect(shift()).toBe('0px')
    release()

    expectUp(WORD_MOCK.english(1), WORD_MOCK.korean(1))
    expect(shift()).toBe('100%')
  })

  it('10px부터는 끌기다 — 가운데선을 못 넘기고 놓으면 돌아간다(#128)', async () => {
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)
    sheetHeight()

    drag(10)
    expect(shift()).toBe('10px')
    release()

    expectDown(WORD_MOCK.english(1), WORD_MOCK.korean(1))
  })

  describe('넘어가는 시간(#128) — 누르면 140ms, 끌다 놓으면 200ms', () => {
    /** 예약된 그리기 콜백. 테스트가 시각을 정해 직접 부른다 */
    let frames: FrameRequestCallback[]

    beforeEach(() => {
      frames = []
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frames.push(callback)
        return frames.length
      })
      // 취소한 그리기는 브라우저처럼 다시 불리지 않게 빈 함수로 바꾼다(#153)
      vi.stubGlobal('cancelAnimationFrame', (id: number) => {
        if (id > 0 && id <= frames.length) frames[id - 1] = () => {}
      })
      // 종이가 말리는 그림은 폭·높이가 있어야 그린다
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 300,
        height: SHEET_HEIGHT,
      } as DOMRect)
    })

    /** 마지막으로 예약된 그리기를 그 시각에 실행 */
    function frameAt(time: number) {
      const callback = frames[frames.length - 1]
      act(() => callback(time))
    }
    /** 넘어가는 중이면 종이의 보이는 글이 없다(읽는 이름 하나만 남는다) */
    const moving = (label: string) => screen.getAllByText(label).length === 1

    it('누르면 140ms에 다 넘어간다', async () => {
      renderWords()
      await counter(`1 / ${WORD_MOCK.total}`)

      const before = performance.now()
      fireEvent.click(sheet())
      const after = performance.now()

      frameAt(before + 60)
      expect(moving('눌러서 단어 보기')).toBe(true)
      frameAt(after + 140)
      expect(moving('눌러서 단어 보기')).toBe(false)
    })

    // #151: 움직임 진행값이 첫 프레임에야 채워져, 그 전 한 번의 그리기가 도착할 자리 모양으로 나왔다(번쩍임) —
    // 아래 세 테스트가 누르기·끌어 넘기기·끌다 되돌아가기에서 지킨다
    it('누른 직후 첫 프레임 전에도 종이는 아래 자리에서 시작한다(번쩍이지 않음)', async () => {
      renderWords()
      await counter(`1 / ${WORD_MOCK.total}`)

      fireEvent.click(sheet())

      // 읽는 이름은 바로 바뀌고, 보이는 글은 아직 아래 자리 것(t=0은 멈춘 그림이라 moving()으로는 못 본다)
      expect(sheet()).toHaveAccessibleName('눌러서 단어 보기')
      expect(screen.getAllByText('눌러서 단어 보기')).toHaveLength(1)
      expect(screen.getByText('눌러서 뜻 보기')).toBeInTheDocument()
    })

    it('끌다 놓은 직후 첫 프레임 전에도 놓은 자리에서 이어 넘어간다(다 넘어간 모양 아님)', async () => {
      renderWords()
      await counter(`1 / ${WORD_MOCK.total}`)

      drag(260)
      release()

      expect(moving('눌러서 단어 보기')).toBe(true)
    })

    it('가운데선을 못 넘기고 놓아 되돌아갈 때도 첫 프레임 전부터 놓은 자리에서(아래 모양으로 튀지 않음)', async () => {
      renderWords()
      await counter(`1 / ${WORD_MOCK.total}`)

      drag(150)
      release()

      expect(moving('눌러서 뜻 보기')).toBe(true)
    })

    // #153: 움직이는 도중에 다시 누르거나 잡으면 지금 그려진 자리에서 이어 가야 한다(끝 자리로 튀지 않음)
    /** 눌러서 넘기기 시작하고, 시작 뒤 ms만큼 지난 프레임까지 그린다(누른 뒤 시각 기준 — 느려도 진행값이 그만큼은 감) */
    function tapAndRun(ms: number) {
      fireEvent.click(sheet())
      const after = performance.now()
      frameAt(after + ms)
      return after
    }
    /** 말린 그림(넘어가는 중) — 종이 위 보이는 글이 없어 두 글을 합쳐 읽는 이름 하나만 남는다 */
    const curled = () => screen.queryAllByText(/^눌러서 (뜻|단어) 보기$/).length === 1

    it('넘어가는 도중 다시 누르면 지금 자리에서 되돌아간다 — 첫 프레임 전에도 끝 자리로 튀지 않음', async () => {
      renderWords()
      await counter(`1 / ${WORD_MOCK.total}`)
      tapAndRun(40)
      expect(curled()).toBe(true)

      fireEvent.click(sheet())

      // 말린 그림이 이어진다(끝 자리로 튀면 "눌러서 단어 보기"가 보인다)
      expect(sheet()).toHaveAccessibleName('눌러서 뜻 보기')
      expect(curled()).toBe(true)
      expect(screen.queryByText('눌러서 단어 보기')).toBeNull()
    })

    it('넘어가는 도중 잡아 끌면 지금 그려진 자리에서 끌기 시작한다', async () => {
      renderWords()
      await counter(`1 / ${WORD_MOCK.total}`)
      tapAndRun(40)

      drag(20)

      // 끝 자리(종이 높이 2배 = 400px)도 0도 아닌, 넘어가던 자리 근처
      const travel = parseFloat(shift())
      expect(travel).toBeGreaterThan(20)
      expect(travel).toBeLessThan(SHEET_HEIGHT * 2)
    })

    it('넘어가는 도중 잡고 머물다 끌면 끌기가 시작될 때의 자리에서 — 잡았던 자리로 되돌아 튀지 않음', async () => {
      renderWords()
      await counter(`1 / ${WORD_MOCK.total}`)
      const after = tapAndRun(40)
      // 잡기만 하고(끌기 전) 넘김은 계속 — 거의 다 넘어감
      fireEvent.pointerDown(sheet(), { pointerId: 1, clientY: 500, isPrimary: true })
      frameAt(after + 130)

      fireEvent.pointerMove(sheet(), { pointerId: 1, clientY: 480, isPrimary: true })

      // 잡았던 순간(진행 약 0.6 = 250px 근처)이 아니라 지금 자리(거의 끝)에서
      expect(parseFloat(shift())).toBeGreaterThan(SHEET_HEIGHT * 2 * 0.9)
    })

    it('넘어가는 도중 끝까지 끌어 놓으면 그 자리에 멈춘다 — 앞 움직임이 계속 돌지 않음', async () => {
      renderWords()
      await counter(`1 / ${WORD_MOCK.total}`)
      tapAndRun(40)

      drag(SHEET_HEIGHT * 2)
      release()

      // 다 넘어간 자리에 쉬는 모양(보이는 글 + 읽는 이름)
      expect(screen.getAllByText('눌러서 단어 보기')).toHaveLength(2)
    })

    it('넘어가는 도중 끝까지 끌다 취소돼도(pointercancel) 그 자리에 멈춘다', async () => {
      renderWords()
      await counter(`1 / ${WORD_MOCK.total}`)
      tapAndRun(40)

      drag(SHEET_HEIGHT * 2)
      fireEvent.pointerCancel(sheet(), { pointerId: 1, isPrimary: true })

      expect(screen.getAllByText('눌러서 단어 보기')).toHaveLength(2)
    })

    it('움직임 줄이기면 움직이지 않고 누르는 즉시 위 자리 — 그리기를 예약하지 않는다', async () => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }))
      renderWords()
      await counter(`1 / ${WORD_MOCK.total}`)
      const scheduled = frames.length

      fireEvent.click(sheet())

      expect(screen.getAllByText('눌러서 단어 보기')).toHaveLength(2)
      expect(shift()).toBe('100%')
      expect(frames).toHaveLength(scheduled)
    })

    it('끌다 놓으면 200ms에 다 넘어간다(그대로)', async () => {
      renderWords()
      await counter(`1 / ${WORD_MOCK.total}`)

      drag(260)
      const before = performance.now()
      release()
      const after = performance.now()

      frameAt(before + 199)
      expect(moving('눌러서 단어 보기')).toBe(true)
      frameAt(after + 200)
      expect(moving('눌러서 단어 보기')).toBe(false)
    })
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
    browserFrames()
    const user = userEvent.setup()
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)
    await user.click(sheet())
    await settledUp() // 다 넘어간 뒤에 잡는다(#153 — 넘어가는 중이면 그 자리에서 끌기 시작)
    sheetHeight()

    drag(-260)
    expect(shift()).toBe(`${SHEET_HEIGHT * 2 - 260}px`)
    release()
    expectDown(WORD_MOCK.english(1), WORD_MOCK.korean(1))
  })

  it('넘어간 종이를 조금만 내리고 놓으면 위에 그대로(위로는 더 넘어가지 않는다)', async () => {
    browserFrames()
    const user = userEvent.setup()
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)
    await user.click(sheet())
    await settledUp()
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

    await user.click(listen)

    expect(play).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: '눌러서 듣기' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '단어 듣기' })).toBeInTheDocument()
  })

  describe('음원을 못 받았을 때(서명 쿠키 만료 403) — refresh 한 번 뒤 다시 재생', () => {
    /** 브라우저가 음원을 못 받으면 play()가 이 이름으로 거부한다 */
    const loadFailure = () => Object.assign(new Error('no source'), { name: 'NotSupportedError' })
    let refreshed: number

    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      refreshed = 0
      server.events.on('request:start', ({ request }) => {
        if (new URL(request.url).pathname.endsWith('/auth/refresh')) refreshed += 1
      })
    })

    it('refresh가 성공하면 같은 단어를 다시 재생한다 — "눌러서 듣기"는 보이지 않는다', async () => {
      play.mockRejectedValueOnce(loadFailure())
      renderWords()
      await counter(`1 / ${WORD_MOCK.total}`)

      await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(2))
      expect(playedUrls()).toEqual(['/mock-audio/word-900.wav', '/mock-audio/word-900.wav'])
      expect(refreshed).toBe(1)
      expect(screen.getByRole('button', { name: '단어 듣기' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '눌러서 듣기' })).not.toBeInTheDocument()
    })

    it('다시 재생도 실패하면 refresh를 또 보내지 않고 "눌러서 듣기"를 보인다', async () => {
      play.mockRejectedValueOnce(loadFailure()).mockRejectedValueOnce(loadFailure())
      renderWords()

      expect(await screen.findByRole('button', { name: '눌러서 듣기' })).toBeInTheDocument()
      expect(play).toHaveBeenCalledTimes(2)
      expect(refreshed).toBe(1)
    })

    it('refresh가 5xx면 "눌러서 듣기"를 보이고, 누르면 다시 들을 수 있다', async () => {
      server.use(http.post('*/api/v1/auth/refresh', () => new HttpResponse(null, { status: 503 })))
      play.mockRejectedValueOnce(loadFailure())
      const user = userEvent.setup()
      const { router } = renderWords()
      const listen = await screen.findByRole('button', { name: '눌러서 듣기' })
      expect(play).toHaveBeenCalledTimes(1)
      expect(router.state.location.pathname).toBe('/lessons/L2-B1-05/words')

      await user.click(listen)

      expect(play).toHaveBeenCalledTimes(2)
      expect(await screen.findByRole('button', { name: '단어 듣기' })).toBeInTheDocument()
    })

    it('refresh가 401이면 세션이 끝난 것 — 들어가기 화면으로 간다(저장된 반 없음)', async () => {
      server.use(http.post('*/api/v1/auth/refresh', () => new HttpResponse(null, { status: 401 })))
      play.mockRejectedValueOnce(loadFailure())
      const { router } = renderWords()

      await vi.waitFor(() => expect(router.state.location.pathname).toBe('/join'))
      expect(play).toHaveBeenCalledTimes(1)
    })

    it('갱신을 기다리는 사이 다음 카드로 넘기면 앞 단어를 다시 틀지 않는다', async () => {
      // 이 테스트 안에서 풀어 주는 응답(끝나지 않는 Promise가 아니다)
      let finishRefresh: ((response: Response) => void) | null = null
      server.use(
        http.post(
          '*/api/v1/auth/refresh',
          () => new Promise<Response>((resolve) => (finishRefresh = resolve)),
        ),
      )
      play.mockRejectedValueOnce(loadFailure())
      const user = userEvent.setup()
      renderWords()
      await counter(`1 / ${WORD_MOCK.total}`)
      await vi.waitFor(() => expect(finishRefresh).not.toBeNull())

      await user.click(screen.getByRole('button', { name: '다음' }))
      expect(screen.getByText(`2 / ${WORD_MOCK.total}`)).toBeInTheDocument()
      expect(play).toHaveBeenCalledTimes(2)
      finishRefresh!(new HttpResponse(null, { status: 200 }))
      await new Promise((resolve) => setTimeout(resolve, 30))

      // 목 단어는 음원 주소가 모두 같다 — 다시 틀었으면 3번이 된다
      expect(play).toHaveBeenCalledTimes(2)
      expect(refreshed).toBe(1)
      expect(screen.getByRole('button', { name: '단어 듣기' })).toBeInTheDocument()
    })
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

  // #187: 단어시험 결과의 "틀린 단어 다시 보기" — 주소의 철자(?only=)와 같은 단어만
  describe('거른 단어만 보기(?only=, #187)', () => {
    const items = () => buildWords().items
    function renderOnly(only: string) {
      return renderRoutes(routes, {
        initialEntries: [`/lessons/L2-B1-05/words?${new URLSearchParams({ only })}`],
      })
    }

    it('그 철자의 단어만 회차 순서대로 — 머리 "다시 볼 단어 n개", 진행 1 / n', async () => {
      const [a, b] = [items()[5], items()[2]]
      const user = userEvent.setup()
      // 순서를 뒤집고 대소문자·공백을 섞어도 회차 순서·같은 철자로 맞춘다
      renderOnly(` ${a.english.toUpperCase()} ,${b.english}`)
      await counter('1 / 2')

      expect(screen.getByText(`L2-B1-05 · 다시 볼 단어 2개`)).toBeInTheDocument()
      expect(within(card()).getByText(b.english)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: '다음' }))
      expect(within(card()).getByText(a.english)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '완료' })).toBeInTheDocument()
    })

    it('거른 화면은 본 카드 수를 저장하지 않는다 — 회차 학습 기록은 전체 카드 기준', async () => {
      const user = userEvent.setup()
      const { router } = renderOnly(`${items()[0].english},${items()[1].english}`)
      await counter('1 / 2')
      await user.click(screen.getByRole('button', { name: '다음' }))

      await act(() => router.navigate('/lessons'))
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(saved).toEqual([])
    })

    it('맞는 단어가 없으면 전체 단어 + 안내 한 줄(저장은 평소처럼)', async () => {
      renderOnly('zzzz-not-a-word')
      await counter(`1 / ${WORD_MOCK.total}`)

      expect(screen.getByRole('status')).toHaveTextContent(
        '다시 볼 단어를 찾지 못해 전체 단어를 보여요',
      )
      expect(screen.getByText(`L2-B1-05 · 단어 ${WORD_MOCK.total}개`)).toBeInTheDocument()
    })
  })

  // #154: 못 받은 상태는 S-05(받기 전 화면, 명세 S04_S05_빈상태 §2)와 같은 상태 안내
  describe('단어를 못 받았을 때 — S-05와 같은 상태 안내(StatusPanel)', () => {
    const problem = (status: number, code: string, title: string, detail?: string) =>
      http.get('*/api/v1/student/lessons/:code/words', () =>
        HttpResponse.json(
          { status, code, title, requestId: 'req-1', ...(detail ? { detail } : {}) },
          { status, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      )

    // 5xx·연결 오류는 운영 정책대로 한 번 다시 보낸다(테스트 쿼리 클라이언트는 대기 0)
    it('인터넷 끊김(연결 오류): 와이파이 아이콘·정한 문구·주 버튼 "다시 시도" → 다시 받으면 카드', async () => {
      let fail = true
      server.use(
        http.get('*/api/v1/student/lessons/:code/words', () =>
          fail ? HttpResponse.error() : undefined,
        ),
      )
      const user = userEvent.setup()
      renderWords()

      const panel = await screen.findByRole('alert')
      expect(within(panel).getByText('인터넷이 끊겼어요')).toBeInTheDocument()
      expect(within(panel).getByText('연결을 확인하고 다시 시도해 주세요')).toBeInTheDocument()
      expect(panel.querySelector('svg.lucide-wifi-off')).not.toBeNull()
      expect(screen.getByRole('button', { name: '다시 시도' }).className).toMatch(/primary/)
      fail = false
      await user.click(screen.getByRole('button', { name: '다시 시도' }))
      expect(await counter(`1 / ${WORD_MOCK.total}`)).toBeInTheDocument()
    })

    it('다시 시도를 누르면 받는 동안 안내는 그대로, 버튼만 누를 수 없게 — 화면이 비지 않는다', async () => {
      let fail = true
      server.use(
        http.get('*/api/v1/student/lessons/:code/words', () =>
          fail ? HttpResponse.error() : hold(),
        ),
      )
      const user = userEvent.setup()
      renderWords()
      await screen.findByRole('alert')
      fail = false

      const retry = screen.getByRole('button', { name: '다시 시도' })
      await user.click(retry)

      expect(screen.getByRole('alert')).toHaveTextContent('인터넷이 끊겼어요')
      // 누를 수 없게 하되 포커스는 그 버튼에 남는다(disabled는 포커스를 뺀다)
      expect(retry).toHaveAttribute('aria-disabled', 'true')
      expect(retry).not.toBeDisabled()
      expect(retry).toHaveFocus()
    })

    it('서버 오류(5xx): 경고 아이콘·정한 문구(서버 title 아님)·"다시 시도", 상태·code·requestId만 기록', async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
      server.use(problem(500, 'INTERNAL', '서버 오류'))
      renderWords()

      const panel = await screen.findByRole('alert')
      expect(within(panel).getByText('잠시 문제가 생겼어요')).toBeInTheDocument()
      expect(within(panel).getByText('잠시 후 다시 시도해 주세요')).toBeInTheDocument()
      expect(panel.querySelector('svg.lucide-triangle-alert')).not.toBeNull()
      expect(screen.queryByText('서버 오류')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
      expect(logged).toHaveBeenCalledWith('[api]', {
        status: 500,
        code: 'INTERNAL',
        requestId: 'req-1',
      })
    })

    it('잠긴 회차(423): 자물쇠 아이콘·서버 제목과 보조 글·"회차 목록으로", 머리 줄의 뒤로·홈은 그대로', async () => {
      renderWords('L2-B1-08')

      const panel = await screen.findByRole('status')
      expect(within(panel).getByText('아직 열리지 않은 회차예요')).toBeInTheDocument()
      expect(within(panel).getByText('수업일이 되면 열려요')).toBeInTheDocument()
      expect(panel.querySelector('svg.lucide-lock')).not.toBeNull()
      expect(screen.getByRole('link', { name: '회차 목록으로' })).toHaveAttribute(
        'href',
        '/lessons',
      )
      expect(screen.getByRole('link', { name: '회차 목록으로' }).className).toMatch(/secondary/)
      expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '뒤로' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/')
    })

    it('교재 사용 기간이 아니면(403 LICENSE_INACTIVE): 달력 아이콘·서버 제목(보조 글이 같으면 한 번만)·"회차 목록으로"', async () => {
      server.use(problem(403, 'LICENSE_INACTIVE', '사용 기간이 아니에요', '사용 기간이 아니에요'))
      renderWords()

      const panel = await screen.findByRole('status')
      expect(within(panel).getAllByText('사용 기간이 아니에요')).toHaveLength(1)
      expect(panel.querySelector('svg.lucide-calendar-x')).not.toBeNull()
      expect(screen.getByRole('link', { name: '회차 목록으로' })).toHaveAttribute(
        'href',
        '/lessons',
      )
    })

    it('그 밖의 4xx(404): 원 아이콘·서버 문구·"회차 목록으로"', async () => {
      server.use(problem(404, 'NOT_FOUND', '회차를 찾을 수 없어요'))
      renderWords()

      const panel = await screen.findByRole('status')
      expect(panel).toHaveTextContent('회차를 찾을 수 없어요')
      expect(panel.querySelector('svg.lucide-circle-alert')).not.toBeNull()
      expect(screen.getByRole('link', { name: '회차 목록으로' })).toBeInTheDocument()
    })
  })
})
