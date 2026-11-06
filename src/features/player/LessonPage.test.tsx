import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { buildLessonDetail, LESSON_MOCK, resetLessonMock } from '../../mocks/lessonData'
import { server } from '../../mocks/node'
import { renderRoutes } from '../../test/render'

// jsdom은 오디오를 재생하지 못한다 — 재생 위치·상태를 요소에 직접 두고 이벤트를 흉내 낸다(브라우저 순서대로)
type FakeAudio = HTMLAudioElement & {
  currentTime: number
  paused: boolean
  ended: boolean
  duration: number
}

let beacon: ReturnType<typeof vi.fn<(url: string, body: Blob) => boolean>>
let play: ReturnType<typeof vi.spyOn>
// keepalive는 MSW가 요청을 다시 만들며 잃는다 — sendFlush 단위 테스트(flushApi.test)에서 본다
let flushBodies: Array<Record<string, unknown>>

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
  resetLessonMock()
  setMockSession('student')
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  beacon = vi.fn(() => true)
  Object.defineProperty(Navigator.prototype, 'sendBeacon', {
    value: beacon,
    configurable: true,
    writable: true,
  })
  flushBodies = []
  server.events.on('request:start', async ({ request }) => {
    if (new URL(request.url).pathname.endsWith('/listening/flush')) {
      flushBodies.push(JSON.parse(await request.clone().text()))
    }
  })
})

afterEach(() => {
  server.events.removeAllListeners()
  delete (Navigator.prototype as { sendBeacon?: unknown }).sendBeacon
  delete (navigator as { mediaSession?: unknown }).mediaSession
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
  vi.unstubAllGlobals()
})

function renderLesson(code: string = LESSON_MOCK.code, options: { strict?: boolean } = {}) {
  return renderRoutes(routes, { initialEntries: [`/lessons/${code}`], ...options })
}

function audio(): FakeAudio {
  const element = document.querySelector('audio') as FakeAudio
  if (!Object.getOwnPropertyDescriptor(element, 'currentTime')) {
    for (const [key, value] of Object.entries({
      currentTime: 0,
      paused: true,
      ended: false,
      duration: NaN,
    })) {
      Object.defineProperty(element, key, { value, writable: true })
    }
  }
  return element
}

function fire(target: EventTarget, type: string) {
  act(() => {
    target.dispatchEvent(new Event(type))
  })
}

/** from초부터 to초까지 듣는다(멈추지 않음) */
function listen(from: number, to: number) {
  const element = audio()
  element.currentTime = from
  element.paused = false
  element.ended = false
  fire(element, 'playing')
  element.currentTime = to
  fire(element, 'timeupdate')
}

/** 재생 중에 위치가 바뀌었다(timeupdate) */
function reach(seconds: number) {
  const element = audio()
  element.currentTime = seconds
  fire(element, 'timeupdate')
}

/** 지금 트랙을 끝까지(브라우저처럼 pause → ended) */
function finish(at: number) {
  const element = audio()
  element.currentTime = at
  fire(element, 'timeupdate')
  element.paused = true
  element.ended = true
  fire(element, 'pause')
  fire(element, 'ended')
}

/** 음원 정보가 왔다(loadedmetadata) */
function metadata(seconds: number) {
  const element = audio()
  element.duration = seconds
  fire(element, 'loadedmetadata')
}

async function beaconBody(index: number) {
  return JSON.parse(await beacon.mock.calls[index][1].text())
}

/** 지문 no의 그 속도 문장 시각(초) — 목과 같은 값 */
const startOf = (no: number, s: number, variant: '0.8' | '1.0' | '1.2' = '1.0') =>
  LESSON_MOCK.timings(no, variant)[s - 1][0] / 1000
const seconds = (no: number, variant: '0.8' | '1.0' | '1.2' = '1.0') =>
  LESSON_MOCK.durationMs(no, variant) / 1000

/** 화면이 뜨기를 기다리고, 오디오 요소를 흉내 낼 준비를 한다(jsdom은 currentTime 쓰기를 무시한다) */
async function heading() {
  const found = await screen.findByRole('heading', { name: 'Reading Day 5' })
  audio()
  return found
}
/** 문장 상자(버튼) — 이름은 "문장 n[ · 들음], 영어 문장" */
const sentence = (no: number) =>
  screen.getByRole('button', { name: new RegExp(`^문장 ${no}( ·|,)`) })
const sentences = () => screen.getAllByRole('button', { name: /^문장 \d+( ·|,)/ })
const heardNos = () =>
  screen
    .queryAllByRole('button', { name: /^문장 \d+ · 들음,/ })
    .map((b) => Number(/문장 (\d+) · 들음,/.exec(b.textContent ?? '')?.[1]))
const player = () => screen.getByRole('region', { name: '플레이어' })
/** 서버가 "지문을 다 들었다"(6 / 6)고 주는 회차 — 복습이 열린다. 지문 5의 트랙 값은 그대로(첫 화면은 지문 5) */
function reviewOpenMock() {
  server.use(
    http.get('*/api/v1/student/lessons/:code', () => {
      const detail = buildLessonDetail(LESSON_MOCK.code)
      detail.completion.passagesDone = detail.completion.passagesTotal
      detail.completion.status = 'completed'
      return HttpResponse.json(detail)
    }),
  )
}
/** 복습 탭으로(열려 있을 때) */
function openReview() {
  act(() => {
    screen.getByRole('tab', { name: '복습 · 본문 보며' }).click()
  })
}
const testCard = () => screen.getByRole('region', { name: '테스트 듣기' })
const nudge = () => screen.queryByRole('status')

describe('S-05 화면', () => {
  it('머리글·지문 탭(서버 완료)·첫 미완료 지문·문장·플레이어', async () => {
    renderLesson()
    await heading()

    expect(screen.getByText('지문 듣기 4 / 6')).toBeInTheDocument()
    const tabs = screen.getByRole('navigation', { name: '지문' })
    expect(within(tabs).getByRole('button', { name: '지문 4 · 완료' })).toBeInTheDocument()
    expect(within(tabs).getByRole('button', { name: '지문 5' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByRole('heading', { name: LESSON_MOCK.title(5) })).toBeInTheDocument()
    // 기본은 테스트 듣기: 본문 글자 없이 책을 펴고 듣는다. 복습은 잠김(서버 4 / 6)
    expect(screen.getByRole('tab', { name: '테스트 듣기 · 책 보고' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: '복습 · 잠김 4/6' })).toBeInTheDocument()
    expect(testCard()).toHaveTextContent('책 5번 지문을 펴고 들어요')
    expect(testCard()).toHaveTextContent('전체 1:23')
    expect(screen.queryByText(LESSON_MOCK.sentence(5, 1))).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /^문장 \d+( ·|,)/ })).toHaveLength(0)

    // 속도는 지문 제목 옆(파일 선택), ●는 서버 required
    expect(screen.getByRole('button', { name: '1.0 필수' })).toHaveAttribute('aria-pressed', 'true')
    expect(player()).toHaveTextContent('지문 5 전체 · 1:23 · 1.0×')
    expect(player()).toHaveTextContent('들은 구간 30%') // 서버 coverage 0.30
    expect(screen.getByRole('button', { name: '처음부터 듣기 · 1:23' })).toBeInTheDocument()
    expect(audio().getAttribute('src')).toBe(`/mock-audio/${LESSON_MOCK.durationMs(5, '1.0')}.wav`)
    expect(audio().playbackRate).toBe(1)
    expect(play).not.toHaveBeenCalled()
  })

  it('복습(열렸을 때): 문장 상자, "들음" 점은 서버 heardRanges가 문장의 80% 이상 덮은 문장(지문 5: 1~3)', async () => {
    reviewOpenMock()
    const user = userEvent.setup()
    renderLesson()
    await heading()
    openReview()

    expect(sentences()).toHaveLength(9)
    expect(sentence(1)).toHaveTextContent(LESSON_MOCK.sentence(5, 1))
    // 재생 전에는 강조된 문장이 없다
    for (const row of sentences()) expect(row).not.toHaveAttribute('aria-current')
    expect(heardNos()).toEqual([1, 2, 3])
    await user.click(screen.getByRole('button', { name: '지문 1 · 완료' }))
    expect(screen.getByRole('heading', { name: LESSON_MOCK.title(1) })).toBeInTheDocument()
    expect(heardNos()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('잠긴 회차(423)는 서버 문구와 회차 목록으로 — 다시 시도 없음', async () => {
    renderLesson('L2-B1-08')

    expect(await screen.findByRole('alert')).toHaveTextContent('아직 열리지 않은 회차예요')
    expect(screen.getByRole('link', { name: '회차 목록으로' })).toHaveAttribute('href', '/lessons')
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('못 받으면(5xx) 다시 시도 → 받으면 화면', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let fail = true
    server.use(
      // fail이 풀리면 undefined를 돌려 기본 목으로 넘긴다
      http.get('*/api/v1/student/lessons/:code', () =>
        fail ? HttpResponse.json({}, { status: 503 }) : undefined,
      ),
    )
    const user = userEvent.setup()
    renderLesson()

    // 5xx는 운영 정책대로 한 번 다시 보낸 뒤 오류를 보인다
    const retry = await screen.findByRole('button', { name: '다시 시도' }, { timeout: 3000 })
    fail = false
    await user.click(retry)
    expect(await heading()).toBeInTheDocument()
  })
})

describe('단계 탭 — 테스트 듣기 · 복습(11/6)', () => {
  it('테스트: 재생하면 "문장 n / m", "이 문장 다시"·"앞 문장"은 그 문장부터 재생', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    expect(within(testCard()).getByRole('button', { name: '앞 문장' })).toBeDisabled()

    listen(0, startOf(5, 3) + 1)
    expect(testCard()).toHaveTextContent('문장 3 / 9')
    play.mockClear()
    audio().paused = true
    fire(audio(), 'pause')

    await user.click(within(testCard()).getByRole('button', { name: '이 문장 다시' }))
    expect(audio().currentTime).toBe(startOf(5, 3))
    expect(play).toHaveBeenCalledTimes(1)

    await user.click(within(testCard()).getByRole('button', { name: '앞 문장' }))
    expect(audio().currentTime).toBe(startOf(5, 2))
  })

  it('복습이 잠겼으면 잠금 안내 — "테스트 듣기로"로 돌아온다', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()

    await user.click(screen.getByRole('tab', { name: '복습 · 잠김 4/6' }))

    const lock = screen.getByRole('region', { name: '복습 잠김' })
    expect(lock).toHaveTextContent('복습은 지문 6개를 다 들으면 열려요')
    expect(lock).toHaveTextContent('지금 4 / 6 · 남은 지문 5, 6')
    expect(screen.queryByText(LESSON_MOCK.sentence(5, 1))).not.toBeInTheDocument()

    await user.click(within(lock).getByRole('button', { name: '테스트 듣기로' }))
    expect(testCard()).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '테스트 듣기 · 책 보고' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('탭을 바꾸면 안내 카드를 닫는다', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    await user.click(screen.getByRole('button', { name: '다음 지문 →' }))
    expect(nudge()).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '복습 · 잠김 4/6' }))

    expect(nudge()).not.toBeInTheDocument()
  })
})

describe('따라 읽기(ADR-26 — 문장 시각은 서버 timings)', () => {
  beforeEach(() => {
    reviewOpenMock()
  })
  it('문장을 누르면 그 문장 시작으로 옮겨 누른 순간 재생하고, 그 문장을 강조한다', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    openReview()

    await user.click(sentence(4))

    expect(audio().currentTime).toBe(startOf(5, 4))
    expect(play).toHaveBeenCalledTimes(1)
    expect(sentence(4)).toHaveAttribute('aria-current', 'true')
    expect(player()).toHaveTextContent('지문 5 · 문장 4 / 9 · 1.0×')
  })

  it('"처음부터 듣기"는 0초에서 재생', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    openReview()
    reach(20)

    await user.click(screen.getByRole('button', { name: /^처음부터 듣기/ }))

    expect(audio().currentTime).toBe(0)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('재생이 다음 문장으로 넘어가면 강조가 따라가고 그 상자를 가운데로 스크롤한다', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    renderLesson()
    await heading()
    openReview()

    listen(0, 1)
    expect(sentence(1)).toHaveAttribute('aria-current', 'true')
    scroll.mockClear()

    reach(startOf(5, 2) + 0.5)

    expect(sentence(2)).toHaveAttribute('aria-current', 'true')
    expect(sentence(1)).not.toHaveAttribute('aria-current')
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(scroll.mock.contexts[0]).toBe(sentence(2))
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }))
    // 같은 문장 안에서 위치만 바뀌면 다시 스크롤하지 않는다
    reach(startOf(5, 2) + 1.5)
    expect(scroll).toHaveBeenCalledTimes(1)
  })

  it('사용자가 직접 스크롤하면 5초 동안 자동 스크롤을 멈춘다', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    renderLesson()
    await heading()
    openReview()
    // Date만 가짜로(타이머는 그대로 — findBy와 섞여도 멈추지 않게)
    vi.useFakeTimers({ toFake: ['Date'] })
    listen(0, 1)
    scroll.mockClear()

    fire(window, 'wheel')
    reach(startOf(5, 2))
    expect(sentence(2)).toHaveAttribute('aria-current', 'true') // 강조는 그대로 따라간다
    expect(scroll).not.toHaveBeenCalled()

    vi.setSystemTime(Date.now() + 5_001)
    reach(startOf(5, 3))
    expect(scroll).toHaveBeenCalledTimes(1)
  })

  it('문장 누르기는 seek — 들은 구간이 끊기고 건너뛴 곳은 비어 있다(TRK-03)', async () => {
    const user = userEvent.setup()
    const { container } = renderLesson()
    await heading()
    openReview()
    await user.click(screen.getByRole('button', { name: '지문 6' }))

    listen(0, 5)
    await user.click(sentence(3))
    const element = audio()
    fire(element, 'seeking') // 브라우저는 currentTime을 바꾸면 seeking → 새 위치의 timeupdate
    reach(startOf(6, 3))
    reach(startOf(6, 3) + 3)

    const filled = [...container.querySelectorAll('[data-range]')].map((el) =>
      el.getAttribute('data-range'),
    )
    const s3 = startOf(6, 3) * 1000
    expect(filled).toEqual(['0-5000', `${s3}-${s3 + 3000}`])
  })

  it('속도를 바꾸면 그 속도의 파일로, 같은 문장의 새 시작 시각에서 이어 듣는다(playbackRate가 아니다)', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    openReview()
    await user.click(sentence(4))
    listen(startOf(5, 4), startOf(5, 4) + 2)
    play.mockClear()

    await user.click(screen.getByRole('button', { name: '1.2' }))

    expect(audio().getAttribute('src')).toBe(`/mock-audio/${LESSON_MOCK.durationMs(5, '1.2')}.wav`)
    expect(play).toHaveBeenCalledTimes(1) // 듣던 중이었으니 이어서 재생 — 누른 그 순간에
    metadata(seconds(5, '1.2'))
    expect(audio().currentTime).toBe(startOf(5, 4, '1.2'))
    expect(screen.getByRole('button', { name: '1.2' })).toHaveAttribute('aria-pressed', 'true')
    expect(audio().playbackRate).toBe(1)
  })

  it('이전·다음 문장은 그 문장 시작으로 옮긴다(재생 상태는 그대로)', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    openReview()
    expect(within(player()).getByRole('button', { name: '이전 문장' })).toBeDisabled()

    await user.click(within(player()).getByRole('button', { name: '다음 문장' }))
    expect(audio().currentTime).toBe(startOf(5, 2))
    expect(play).not.toHaveBeenCalled()
    expect(player()).toHaveTextContent('문장 2 / 9')

    await user.click(within(player()).getByRole('button', { name: '다음 문장' }))
    await user.click(within(player()).getByRole('button', { name: '이전 문장' }))
    expect(audio().currentTime).toBe(startOf(5, 2))

    await user.click(sentence(9))
    expect(within(player()).getByRole('button', { name: '다음 문장' })).toBeDisabled()
  })

  it('트랙(속도)을 바꾸면 이전 트랙에서 들은 구간을 sendBeacon(final)으로 보낸다', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    openReview()
    listen(30, 40)

    await user.click(screen.getByRole('button', { name: '0.8' }))

    expect(beacon).toHaveBeenCalledTimes(1)
    expect(await beaconBody(0)).toMatchObject({
      trackId: LESSON_MOCK.passageTrackId(5, '1.0'),
      final: true,
      segments: [expect.objectContaining({ startMs: 30000, endMs: 40000 })],
    })
  })

  it('진행 바는 서버의 들은 구간 + 이 화면에서 들은 구간만 채우고, 속도를 바꿨다 와도 남는다', async () => {
    const user = userEvent.setup()
    const { container } = renderLesson()
    await heading()
    openReview()
    listen(40, 45)

    const filled = () =>
      [...container.querySelectorAll('[data-range]')].map((el) => el.getAttribute('data-range'))
    const seeded = LESSON_MOCK.timings(5, '1.0')[2][1]
    expect(filled()).toEqual([`0-${seeded}`, '40000-45000'])

    await user.click(screen.getByRole('button', { name: '1.2' }))
    expect(filled()).toEqual([])
    await user.click(screen.getByRole('button', { name: '1.0 필수' }))
    expect(filled()).toEqual([`0-${seeded}`, '40000-45000'])
  })
})

describe('완료 전 안내 카드(NudgeCard — 막지 않음)', () => {
  it('완료 안 된 지문에서 "다음 지문" → 필수 속도의 들은 구간과 안 들은 문장', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()

    await user.click(screen.getByRole('button', { name: '다음 지문 →' }))

    expect(nudge()).toHaveTextContent('지문 5를 아직 다 안 들었어요')
    expect(nudge()).toHaveTextContent('1.0× 들은 구간 30% · 안 들은 문장 4, 5, 6, 7, 8, 9')
    expect(screen.getByRole('heading', { name: LESSON_MOCK.title(5) })).toBeInTheDocument()
  })

  it('"이어서 듣기"는 첫 안 들은 문장부터 재생하고 카드를 닫는다', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    await user.click(screen.getByRole('button', { name: '다음 지문 →' }))

    await user.click(within(nudge() as HTMLElement).getByRole('button', { name: '이어서 듣기' }))

    expect(audio().currentTime).toBe(startOf(5, 4))
    expect(play).toHaveBeenCalledTimes(1)
    expect(nudge()).not.toBeInTheDocument()
  })

  it('"그냥 넘어가기"는 다음 지문으로 — 마지막 지문에서 단어로 가려 하면 완료 안 된 지문 안내', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    await user.click(screen.getByRole('button', { name: '다음 지문 →' }))

    await user.click(within(nudge() as HTMLElement).getByRole('button', { name: '그냥 넘어가기' }))
    expect(screen.getByRole('heading', { name: LESSON_MOCK.title(6) })).toBeInTheDocument()
    expect(nudge()).not.toBeInTheDocument()
    expect(screen.getByText('마지막 지문이에요')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '오늘의 단어 학습하기 →' }))
    expect(nudge()).toHaveTextContent('아직 완료 안 된 지문이 있어요')
    expect(nudge()).toHaveTextContent('완료 안 된 지문: 5, 6 · 1.0×로 끝까지 들으면 완료돼요')
    expect(
      within(nudge() as HTMLElement).getByRole('link', { name: '그래도 단어로' }),
    ).toHaveAttribute('href', '/lessons/L2-B1-05/cards')

    await user.click(within(nudge() as HTMLElement).getByRole('button', { name: '마저 듣기' }))
    expect(screen.getByRole('heading', { name: LESSON_MOCK.title(5) })).toBeInTheDocument()
  })

  it('카드가 뜬 채 다른 지문 탭을 고르면 카드를 닫는다', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    await user.click(screen.getByRole('button', { name: '다음 지문 →' }))
    expect(nudge()).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '지문 1 · 완료' }))

    expect(screen.getByRole('heading', { name: LESSON_MOCK.title(1) })).toBeInTheDocument()
    expect(nudge()).not.toBeInTheDocument()
  })

  it('완료한 지문에서는 카드 없이 바로 다음 지문', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    await user.click(screen.getByRole('button', { name: '지문 1 · 완료' }))

    await user.click(screen.getByRole('button', { name: '다음 지문 →' }))

    expect(nudge()).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: LESSON_MOCK.title(2) })).toBeInTheDocument()
  })

  it('필수 속도는 서버 required에서 — 0.8·1.0 둘 다 필수면 둘 다 말한다(숫자 고정 아님)', async () => {
    server.use(
      http.get('*/api/v1/student/lessons/:code', () => {
        const detail = buildLessonDetail(LESSON_MOCK.code)
        for (const p of detail.passages)
          for (const s of p.speeds) if (s.variant === '0.8') s.required = true
        return HttpResponse.json(detail)
      }),
    )
    const user = userEvent.setup()
    renderLesson()
    await heading()
    await user.click(screen.getByRole('button', { name: '지문 6' }))

    await user.click(screen.getByRole('link', { name: '오늘의 단어 학습하기 →' }))

    expect(nudge()).toHaveTextContent('0.8× 또는 1.0×로 끝까지 들으면 완료돼요')
  })

  it('지문을 모두 마쳤으면 단어 학습 링크는 그대로 이동한다', async () => {
    server.use(
      http.get('*/api/v1/student/lessons/:code', () => {
        const detail = buildLessonDetail(LESSON_MOCK.code)
        for (const p of detail.passages) for (const s of p.speeds) s.completed = s.required
        return HttpResponse.json(detail)
      }),
    )
    const user = userEvent.setup()
    const { router } = renderLesson()
    await heading()
    await user.click(screen.getByRole('button', { name: '지문 6 · 완료' }))

    await user.click(screen.getByRole('link', { name: '오늘의 단어 학습하기 →' }))

    expect(nudge()).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/lessons/L2-B1-05/cards')
  })
})

describe('BE #18 계약 — 레벨 색, 문장 시각 없음', () => {
  it('반 레벨 색(level.colorHex)을 --level로 넣는다', async () => {
    renderLesson()
    await heading()

    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('data-level')
    expect(main.style.getPropertyValue('--level')).toBe(LESSON_MOCK.level.colorHex)
  })

  it('timings가 []면 강조·문장 이동 없이 재생만 — 안내 카드도 안 들은 문장을 세지 않는다', async () => {
    server.use(
      http.get('*/api/v1/student/lessons/:code', () => {
        const detail = buildLessonDetail(LESSON_MOCK.code)
        for (const p of detail.passages) for (const s of p.speeds) s.timings = []
        return HttpResponse.json(detail)
      }),
    )
    const user = userEvent.setup()
    renderLesson()
    await heading()

    listen(0, 20)
    expect(testCard()).toHaveTextContent('전체 1:23')
    expect(within(testCard()).getByRole('button', { name: '이 문장 다시' })).toBeDisabled()
    expect(player()).toHaveTextContent('지문 5 전체 · 1:23 · 1.0×')
    expect(within(player()).getByRole('button', { name: '이전 문장' })).toBeDisabled()
    expect(within(player()).getByRole('button', { name: '다음 문장' })).toBeDisabled()

    audio().paused = true
    fire(audio(), 'pause')
    play.mockClear()
    await user.click(screen.getByRole('button', { name: '다음 지문 →' }))
    expect(nudge()).toHaveTextContent('1.0× 들은 구간 30%')
    expect(nudge()).not.toHaveTextContent('안 들은 문장')
    await user.click(within(nudge() as HTMLElement).getByRole('button', { name: '이어서 듣기' }))
    expect(play).toHaveBeenCalledTimes(1)
    expect(audio().currentTime).toBe(20) // 자리를 옮기지 않고 이어서
  })
})

describe('청취 기록(03 §3.1)', () => {
  it('지문을 10초마다 fetch로 보내고, 건너뛴 곳은 보내지 않는다(TRK-01·03)', async () => {
    renderLesson()
    await heading()
    // 추적기(10초 타이머)는 화면이 뜰 때 붙었다 — 그 뒤 가짜 타이머로 바꾸면 그 타이머를 못 움직이므로,
    // 지문 탭을 다시 골라 추적기를 새로 붙인다
    vi.useFakeTimers()
    try {
      act(() => {
        screen.getByRole('button', { name: '지문 6' }).click()
      })
      await act(() => vi.advanceTimersByTimeAsync(0))
      listen(0, 8)
      const element = audio()
      fire(element, 'seeking')
      element.currentTime = 40
      fire(element, 'timeupdate')
      element.currentTime = 43
      fire(element, 'timeupdate')
      await act(() => vi.advanceTimersByTimeAsync(10_000))
      await act(() => vi.advanceTimersByTimeAsync(1_000))

      expect(flushBodies).toHaveLength(1)
      expect(flushBodies[0]).toMatchObject({
        trackId: LESSON_MOCK.passageTrackId(6, '1.0'),
        final: false,
        segments: [
          expect.objectContaining({ startMs: 0, endMs: 8000 }),
          expect.objectContaining({ startMs: 40000, endMs: 43000 }),
        ],
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('지문을 끝까지 들어 서버가 완료라고 하면 탭에 완료 표시(서버 값)', async () => {
    renderLesson()
    await heading()

    listen(0, seconds(5))
    finish(seconds(5))

    expect(await screen.findByRole('button', { name: '지문 5 · 완료' })).toBeInTheDocument()
    expect(screen.getByText('지문 듣기 5 / 6')).toBeInTheDocument()
    expect(player()).toHaveTextContent('들은 구간 100%')
  })

  it('마지막 지문까지 끝나면 회차 상태도 서버 값(완료)으로 바꾸고 홈·회차 목록을 다시 받게 한다', async () => {
    const user = userEvent.setup()
    const { client } = renderLesson()
    await heading()
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    listen(0, seconds(5))
    finish(seconds(5))
    await screen.findByRole('button', { name: '지문 5 · 완료' })
    await user.click(screen.getByRole('button', { name: '지문 6' }))
    listen(0, seconds(6))
    finish(seconds(6))
    await screen.findByRole('button', { name: '지문 6 · 완료' })
    // 서버가 6 / 6이라 하면 복습이 열린다
    expect(screen.getByRole('tab', { name: '복습 · 본문 보며' })).toBeInTheDocument()

    const detail = client.getQueryData<{ completion: { status: string } }>([
      'student',
      'lesson',
      LESSON_MOCK.code,
    ])
    expect(detail?.completion.status).toBe('completed')
    expect(screen.getByText('지문 듣기 6 / 6')).toBeInTheDocument()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['student', 'home'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['student', 'lessons'] })
  })

  it('일시정지는 fetch(final)로 한 번 — StrictMode에서도', async () => {
    renderLesson(LESSON_MOCK.code, { strict: true })
    await heading()

    listen(0, 3)
    const element = audio()
    element.paused = true
    fire(element, 'pause')

    await waitFor(() => expect(flushBodies).toHaveLength(1))
    expect(flushBodies[0]).toMatchObject({
      final: true,
      trackId: LESSON_MOCK.passageTrackId(5, '1.0'),
      segments: [expect.objectContaining({ startMs: 0, endMs: 3000 })],
    })
    expect(beacon).not.toHaveBeenCalled()
  })

  it('듣다가 화면을 떠나면 들은 구간을 sendBeacon(final, text/plain)으로 보낸다', async () => {
    const { router } = renderLesson()
    await heading()
    listen(0, 4)

    await act(() => router.navigate('/lessons'))

    expect(beacon).toHaveBeenCalledTimes(1)
    const [, blob] = beacon.mock.calls[0]
    expect(blob.type).toBe('text/plain;charset=utf-8')
    const body = await beaconBody(0)
    expect(body).toMatchObject({ final: true })
    expect(body.segments).toEqual([expect.objectContaining({ startMs: 0, endMs: 4000 })])
  })
})

describe('소리가 안 날 때 · 잠금화면', () => {
  it('음원을 못 불러오면 안내와 다시 불러오기', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    renderLesson()
    await heading()

    fire(audio(), 'error')

    expect(within(player()).getByRole('alert')).toHaveTextContent('소리를 불러오지 못했어요')
    await user.click(within(player()).getByRole('button', { name: '다시 불러오기' }))
    expect(play).toHaveBeenCalledTimes(1)
    expect(within(player()).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('브라우저가 재생을 막으면 안내(새 load가 끼어든 AbortError는 무시)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    renderLesson()
    await heading()

    play.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    await user.click(screen.getByRole('button', { name: '재생' }))
    expect(within(player()).queryByRole('alert')).not.toBeInTheDocument()

    play.mockRejectedValueOnce(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }))
    await user.click(screen.getByRole('button', { name: '재생' }))
    expect(await within(player()).findByRole('alert')).toHaveTextContent('재생이 멈췄어요')
  })

  it('Media Session: 제목 "Reading Day 5 · 지문 5 · 1.0×", 재생·일시정지는 각각', async () => {
    const handlers = new Map<string, (() => void) | null>()
    const session = {
      metadata: null as unknown,
      playbackState: 'none',
      setActionHandler: (action: string, handler: (() => void) | null) =>
        handlers.set(action, handler),
    }
    Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true })
    vi.stubGlobal(
      'MediaMetadata',
      class {
        title: string
        artist: string
        constructor(init: { title: string; artist: string }) {
          this.title = init.title
          this.artist = init.artist
        }
      },
    )
    const user = userEvent.setup()
    renderLesson()
    await heading()

    expect(session.metadata).toMatchObject({
      title: 'Reading Day 5 · 지문 5 · 1.0×',
      artist: '제이G 4 Seasons',
    })
    const pauseSpy = vi.mocked(HTMLMediaElement.prototype.pause)
    pauseSpy.mockClear()
    act(() => handlers.get('pause')?.())
    expect(pauseSpy).toHaveBeenCalledTimes(1)
    expect(play).not.toHaveBeenCalled()
    act(() => handlers.get('play')?.())
    expect(play).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: '1.2' }))
    expect(session.metadata).toMatchObject({ title: 'Reading Day 5 · 지문 5 · 1.2×' })
  })
})
