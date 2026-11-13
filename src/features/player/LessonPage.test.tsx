import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
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

type VoiceCode = 'us_w' | 'us_m' | 'uk_w' | 'uk_m'
/** 지문 no의 그 목소리 문장 시각(초) — 목과 같은 값 */
const startOf = (no: number, s: number, variant: VoiceCode = 'us_w') =>
  LESSON_MOCK.timings(no, variant)[s - 1][0] / 1000
const seconds = (no: number, variant: VoiceCode = 'us_w') =>
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
/** 듣기 카드(지금 지문) */
const player = () => screen.getByRole('region', { name: /^지문 \d+ 듣기$/ })
const rates = () => screen.getByRole('group', { name: '속도' })
/** 음성 버튼 — 이름은 늘 지금 고른 음성 */
const voiceButton = () => screen.getByRole('button', { name: /^음성 고르기, 지금 / })
/** 음성 시트를 열어 그 음성을 고르고 "이 음성으로 듣기" */
async function chooseVoice(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(voiceButton())
  const sheet = screen.getByRole('dialog', { name: '음성 고르기' })
  await user.click(within(sheet).getByRole('radio', { name: new RegExp(`^${label}`) }))
  await user.click(within(sheet).getByRole('button', { name: '이 음성으로 듣기' }))
}
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
/** 복습 본문을 펼친다(열려 있을 때) */
function openReview() {
  act(() => {
    screen.getByRole('button', { name: '복습하기 · 본문 보며 듣기' }).click()
  })
}
const testCard = player
const nudge = () => screen.queryByRole('status')

describe('S-05 화면', () => {
  it('머리 줄(뒤로·이름·홈)·지문 번호(서버 완료)·첫 미완료 지문·듣기 카드', async () => {
    renderLesson()
    await heading()

    expect(screen.getByText('지문 듣기 4 / 6')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '뒤로' })).toBeInTheDocument()
    expect(await screen.findByText('김민준')).toBeInTheDocument() // /me
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/')
    const tabs = screen.getByRole('navigation', { name: '지문 고르기' })
    expect(within(tabs).getByRole('button', { name: '지문 4 완료' })).toBeInTheDocument()
    expect(within(tabs).getByRole('button', { name: '지문 5 듣는 중' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(within(tabs).getByRole('button', { name: '지문 6 아직 안 들음' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: LESSON_MOCK.title(5) })).toBeInTheDocument()
    // 듣기 방식 탭·하단 고정 플레이어는 없다(v0.2). 본문 없이 책을 펴고 듣는다. 복습은 잠김(서버 4 / 6)
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '플레이어' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /10초/ })).not.toBeInTheDocument()
    expect(screen.getByText(/복습은 지문 6개를 다 들으면 열려요 · 4 \/ 6/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^복습하기/ })).not.toBeInTheDocument()
    expect(player()).toHaveTextContent('지문 5 · 1:23')
    expect(player()).toHaveTextContent('책 5번 지문을 펴고 들어요')
    expect(player()).toHaveTextContent(/문장\s*1 \/ 9/)
    expect(screen.getByRole('img', { name: '문장 9개' })).toBeInTheDocument() // 재생 전에는 지금 문장 없음
    expect(screen.queryByText(LESSON_MOCK.sentence(5, 1))).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /^문장 \d+( ·|,)/ })).toHaveLength(0)

    // 처음 음성은 미국 여성(A5 — 저장 전). 속도는 1.0
    expect(voiceButton()).toHaveAccessibleName('음성 고르기, 지금 미국 여성')
    expect(within(rates()).getByRole('button', { name: '1.0' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(player()).toHaveTextContent('들은 구간 30%') // 서버 coverage 0.30
    expect(player()).toHaveTextContent('90%면 완료') // 서버 completion.threshold
    expect(screen.getByRole('button', { name: '처음부터 듣기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다음 지문' })).toBeInTheDocument()
    expect(audio().getAttribute('src')).toBe(`/mock-audio/${LESSON_MOCK.durationMs(5, 'us_w')}.wav`)
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
    await user.click(screen.getByRole('button', { name: '지문 1 완료' }))
    expect(screen.getByRole('heading', { name: LESSON_MOCK.title(1) })).toBeInTheDocument()
    expect(heardNos()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('잠긴 회차(423)는 서버 문구와 회차 목록으로 — 다시 시도 없음', async () => {
    renderLesson('L2-B1-08')

    expect(await screen.findByRole('alert')).toHaveTextContent('아직 열리지 않은 회차예요')
    expect(screen.getByRole('link', { name: '회차 목록으로' })).toHaveAttribute('href', '/lessons')
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('교재 사용 기간이 아니면(403 LICENSE_INACTIVE) 서버 문구와 회차 목록으로 — 다시 시도 없음', async () => {
    server.use(
      http.get('*/api/v1/student/lessons/:code', () =>
        HttpResponse.json(
          { code: 'LICENSE_INACTIVE', title: '사용 기간이 아니에요', status: 403 },
          { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderLesson()

    expect(await screen.findByRole('alert')).toHaveTextContent('사용 기간이 아니에요')
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

describe('듣기 카드 · 복습 줄(v0.2)', () => {
  it('재생하면 "문장 n / m"과 점, "이 문장 다시"·"앞 문장"은 그 문장부터 재생', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    expect(within(testCard()).getByRole('button', { name: '앞 문장' })).toBeDisabled()

    listen(0, startOf(5, 3) + 1)
    expect(testCard()).toHaveTextContent(/문장\s*3 \/ 9/)
    const dots = screen.getByRole('img', { name: '문장 9개 중 3번째' })
    // 서버 heardRanges가 1~3을 덮고 지금 문장이 3 — 1·2는 들음, 3은 지금, 나머지는 남음
    expect([...dots.children].map((d) => d.getAttribute('data-state'))).toEqual([
      'heard',
      'heard',
      'current',
      'rest',
      'rest',
      'rest',
      'rest',
      'rest',
      'rest',
    ])
    play.mockClear()
    audio().paused = true
    fire(audio(), 'pause')

    await user.click(within(testCard()).getByRole('button', { name: '이 문장 다시' }))
    expect(audio().currentTime).toBe(startOf(5, 3))
    expect(play).toHaveBeenCalledTimes(1)

    await user.click(within(testCard()).getByRole('button', { name: '앞 문장' }))
    expect(audio().currentTime).toBe(startOf(5, 2))
  })

  it('복습이 열리면(서버 6 / 6) 복습 버튼으로 본문을 펼치고 닫는다', async () => {
    reviewOpenMock()
    const user = userEvent.setup()
    renderLesson()
    await heading()
    expect(screen.queryByText(/복습은 지문/)).not.toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /^문장 \d+( ·|,)/ })).toHaveLength(0)

    const toggle = screen.getByRole('button', { name: '복습하기 · 본문 보며 듣기' })
    // 펼치는 버튼: 스크린 리더가 접힘·펼침과 펼칠 곳(본문)을 안다
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const controls = toggle.getAttribute('aria-controls')
    expect(controls).toBeTruthy()

    await user.click(toggle)
    expect(sentences()).toHaveLength(9)
    const close = screen.getByRole('button', { name: '복습 닫기' })
    expect(close).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(controls!)).toBe(screen.getByRole('list', { name: '지문 본문' }))
    await user.click(close)
    expect(screen.queryAllByRole('button', { name: /^문장 \d+( ·|,)/ })).toHaveLength(0)
    expect(screen.getByRole('button', { name: '복습하기 · 본문 보며 듣기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('뒤로: 들어온 화면으로, 바로 들어왔으면 회차 목록으로', async () => {
    const user = userEvent.setup()
    const direct = renderLesson()
    await heading()
    await user.click(screen.getByRole('button', { name: '뒤로' }))
    expect(direct.router.state.location.pathname).toBe('/lessons')
    direct.unmount()

    const fromHome = renderRoutes(routes, { initialEntries: ['/', `/lessons/${LESSON_MOCK.code}`] })
    await heading()
    await user.click(screen.getByRole('button', { name: '뒤로' }))
    expect(fromHome.router.state.location.pathname).toBe('/')
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
    expect(player()).toHaveTextContent(/문장\s*4 \/ 9/)
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
    await user.click(screen.getByRole('button', { name: '지문 6 아직 안 들음' }))

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

  it('음성을 바꾸면 그 음성 파일로, 같은 문장의 새 시작 시각에서 이어 듣는다', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    openReview()
    await user.click(sentence(4))
    listen(startOf(5, 4), startOf(5, 4) + 2)
    play.mockClear()

    await chooseVoice(user, '영국 남성')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(audio().getAttribute('src')).toBe(`/mock-audio/${LESSON_MOCK.durationMs(5, 'uk_m')}.wav`)
    expect(play).toHaveBeenCalledTimes(1) // 듣던 중이었으니 이어서 재생 — 누른 그 순간에
    metadata(seconds(5, 'uk_m'))
    // 목소리마다 길이가 달라 같은 문장이라도 시각이 다르다
    expect(startOf(5, 4, 'uk_m')).not.toBe(startOf(5, 4))
    expect(audio().currentTime).toBe(startOf(5, 4, 'uk_m'))
    expect(voiceButton()).toHaveAccessibleName('음성 고르기, 지금 영국 남성')
  })

  it('속도는 재생 속도(playbackRate) — 파일·위치·구간은 그대로, 음성을 바꿔도 유지(ADR-27)', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    const src = audio().getAttribute('src')
    listen(10, 14)

    await user.click(within(rates()).getByRole('button', { name: '1.2' }))

    expect(audio().playbackRate).toBe(1.2)
    expect(audio().getAttribute('src')).toBe(src)
    expect(audio().currentTime).toBe(14)
    expect(beacon).not.toHaveBeenCalled() // 트랙이 바뀌지 않았다
    expect(within(rates()).getByRole('button', { name: '1.2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await chooseVoice(user, '미국 남성')
    expect(audio().playbackRate).toBe(1.2)
    expect(audio().defaultPlaybackRate).toBe(1.2)

    // 허용 밖 속도(브라우저 메뉴 등)는 고른 속도로 되돌린다
    audio().playbackRate = 2
    fire(audio(), 'ratechange')
    expect(audio().playbackRate).toBe(1.2)
  })

  it('음성 시트: 서버 음성 4개 순서, 고른 칸 체크, 방향키로 옮기기, Esc·바깥은 바꾸지 않고 닫기', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    const src = audio().getAttribute('src')

    await user.click(voiceButton())
    const sheet = screen.getByRole('dialog', { name: '음성 고르기' })
    expect(sheet).toHaveTextContent('고르면 지금 문장부터 그 음성으로 이어서 들려요')
    const radios = within(sheet).getAllByRole('radio')
    expect(radios.map((r) => r.textContent)).toEqual([
      '미국 여성US · Female',
      '미국 남성US · Male',
      '영국 여성UK · Female',
      '영국 남성UK · Male',
    ])
    expect(radios[0]).toHaveAttribute('aria-checked', 'true')
    expect(radios[0]).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(radios[1]).toHaveAttribute('aria-checked', 'true')
    expect(radios[1]).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(voiceButton()).toHaveFocus() // 연 버튼으로 돌아온다
    expect(voiceButton()).toHaveAccessibleName('음성 고르기, 지금 미국 여성') // 바뀌지 않음
    expect(audio().getAttribute('src')).toBe(src)
  })

  it('트랙(음성)을 바꾸면 이전 트랙에서 들은 구간을 sendBeacon(final)으로 보낸다', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    openReview()
    listen(30, 40)

    await chooseVoice(user, '미국 남성')

    expect(beacon).toHaveBeenCalledTimes(1)
    expect(await beaconBody(0)).toMatchObject({
      trackId: LESSON_MOCK.passageTrackId(5, 'us_w'),
      final: true,
      segments: [expect.objectContaining({ startMs: 30000, endMs: 40000 })],
    })
  })

  it('음성을 고른 뒤 지문을 옮겨도 그 음성으로 올린다', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    await chooseVoice(user, '영국 남성')

    await user.click(screen.getByRole('button', { name: '지문 6 아직 안 들음' }))

    expect(audio().getAttribute('src')).toBe(`/mock-audio/${LESSON_MOCK.durationMs(6, 'uk_m')}.wav`)
    expect(voiceButton()).toHaveAccessibleName('음성 고르기, 지금 영국 남성')
  })

  it('멈춘 상태에서 음성을 바꾸면 그 음성을 올리기만 하고 재생하지 않는다', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    play.mockClear()

    await chooseVoice(user, '영국 여성')

    expect(audio().getAttribute('src')).toBe(`/mock-audio/${LESSON_MOCK.durationMs(5, 'uk_w')}.wav`)
    expect(play).not.toHaveBeenCalled()
  })

  it('지문 탭을 옮기면 이전 트랙에서 들은 구간을 sendBeacon(final)으로 보내고, 새 지문은 자동 재생하지 않는다', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    listen(0, 5)
    play.mockClear()

    await user.click(screen.getByRole('button', { name: '지문 6 아직 안 들음' }))

    expect(beacon).toHaveBeenCalledTimes(1)
    expect(await beaconBody(0)).toMatchObject({
      trackId: LESSON_MOCK.passageTrackId(5, 'us_w'),
      final: true,
      segments: [expect.objectContaining({ startMs: 0, endMs: 5000 })],
    })
    expect(audio().getAttribute('src')).toBe(`/mock-audio/${LESSON_MOCK.durationMs(6, 'us_w')}.wav`)
    expect(play).not.toHaveBeenCalled()
  })

  it('들은 구간 바는 서버 + 이 화면에서 들은 구간만 채우고 건너뛴 곳은 빗금, 음성을 바꿨다 와도 남는다', async () => {
    const user = userEvent.setup()
    const { container } = renderLesson()
    await heading()
    openReview()
    listen(40, 45)

    const filled = () =>
      [...container.querySelectorAll('[data-range]')].map((el) => el.getAttribute('data-range'))
    const seeded = LESSON_MOCK.timings(5, 'us_w')[2][1]
    expect(filled()).toEqual([`0-${seeded}`, '40000-45000'])
    // 지금 위치(45초)보다 앞인데 듣지 않은 곳 = 서버 구간 끝 ~ 40초
    const skipped = () =>
      [...container.querySelectorAll('[data-skipped]')].map((el) => el.getAttribute('data-skipped'))
    expect(skipped()).toEqual([`${seeded}-40000`])

    await chooseVoice(user, '영국 여성')
    expect(filled()).toEqual([])
    await chooseVoice(user, '미국 여성')
    expect(filled()).toEqual([`0-${seeded}`, '40000-45000'])
  })
})

describe('들은 구간 바로 위치 옮기기(STU-05 — 11/9 실기기 요청)', () => {
  const seekBar = () => within(player()).getByRole('slider', { name: '재생 위치' })
  /** 바 영역(x 20~370, 폭 350)에 jsdom이 모르는 레이아웃을 넣는다 */
  function layout() {
    const area = seekBar().parentElement as HTMLElement
    vi.spyOn(area, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 700, 350, 8))
    return area
  }
  function pointer(target: Element, type: string, clientX: number) {
    act(() => {
      target.dispatchEvent(
        new PointerEvent(type, { bubbles: true, clientX, pointerId: 1, isPrimary: true }),
      )
    })
  }

  it('누르고 끄는 동안은 위치만 보여 주고, 손을 뗄 때 한 번 옮긴다', async () => {
    renderLesson()
    await heading()
    act(() => {
      within(player()).getByRole('button', { name: '재생' }).click()
    })
    metadata(seconds(5))
    const area = layout()
    const duration = LESSON_MOCK.durationMs(5, 'us_w')

    pointer(area, 'pointerdown', 20 + 350 * 0.25)
    pointer(area, 'pointermove', 20 + 350 * 0.5)
    expect(audio().currentTime).toBe(0) // 끄는 중에는 옮기지 않는다(seek 한 번 = 구간 끊김 한 번)
    expect(seekBar()).toHaveAttribute(
      'aria-valuetext',
      `${clockOf(duration * 0.5)} / ${clockOf(duration)}`,
    )

    pointer(area, 'pointerup', 20 + 350 * 0.5)
    expect(audio().currentTime).toBe(Math.round(duration * 0.5) / 1000)
  })

  it('끄는 동안 바 아래 시간 글자도 끄는 위치를 따라가고, 취소하면 지금 위치로 돌아온다', async () => {
    renderLesson()
    await heading()
    act(() => {
      within(player()).getByRole('button', { name: '재생' }).click()
    })
    metadata(seconds(5))
    const area = layout()
    const duration = LESSON_MOCK.durationMs(5, 'us_w')
    const half = clockOf(duration * 0.5)
    expect(within(player()).queryByText(half)).not.toBeInTheDocument()

    pointer(area, 'pointerdown', 20 + 350 * 0.25)
    pointer(area, 'pointermove', 20 + 350 * 0.5)
    expect(within(player()).getByText(half)).toBeInTheDocument()

    pointer(area, 'pointercancel', 20 + 350 * 0.5)
    expect(within(player()).queryByText(half)).not.toBeInTheDocument()
    expect(within(player()).getByText('0:00')).toBeInTheDocument()
  })

  it('바 밖으로 끌면 처음·끝에서 멈추고, 취소(pointercancel)되면 옮기지 않는다', async () => {
    renderLesson()
    await heading()
    act(() => {
      within(player()).getByRole('button', { name: '재생' }).click()
    })
    metadata(seconds(5))
    const area = layout()
    const end = clockOf(LESSON_MOCK.durationMs(5, 'us_w'))

    pointer(area, 'pointerdown', 500)
    expect(seekBar()).toHaveAttribute('aria-valuetext', `${end} / ${end}`) // 끝을 넘어 보이지 않는다
    pointer(area, 'pointercancel', 500)
    expect(audio().currentTime).toBe(0)
    expect(seekBar()).toHaveAttribute('aria-valuetext', `0:00 / ${end}`) // 지금 위치로 돌아온다

    pointer(area, 'pointerdown', 500)
    pointer(area, 'pointerup', 500)
    expect(audio().currentTime).toBe(seconds(5))
    pointer(area, 'pointerdown', -10)
    pointer(area, 'pointerup', -10)
    expect(audio().currentTime).toBe(0)
  })

  it('키보드(range 입력)로도 옮긴다 — 스크린 리더에는 "0:00 / 1:23"', async () => {
    renderLesson()
    await heading()
    act(() => {
      within(player()).getByRole('button', { name: '재생' }).click()
    })
    metadata(seconds(5))
    expect(seekBar()).toBeEnabled()
    expect(seekBar()).toHaveAttribute(
      'aria-valuetext',
      `0:00 / ${clockOf(LESSON_MOCK.durationMs(5, 'us_w'))}`,
    )
    act(() => {
      fireEvent.change(seekBar(), { target: { value: '30000' } })
    })
    expect(audio().currentTime).toBe(30)
  })
})

/** 63000 → "1:03" */
function clockOf(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

describe('완료 전 안내 카드(NudgeCard — 막지 않음)', () => {
  it('완료 안 된 지문에서 "다음 지문" → 가장 많이 들은 목소리의 들은 구간과 안 들은 문장', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()

    await user.click(screen.getByRole('button', { name: '다음 지문' }))

    expect(nudge()).toHaveTextContent('지문 5를 아직 다 안 들었어요')
    expect(nudge()).toHaveTextContent('미국 여 들은 구간 30% · 안 들은 문장 4, 5, 6, 7, 8, 9')
    expect(screen.getByRole('heading', { name: LESSON_MOCK.title(5) })).toBeInTheDocument()
  })

  it('"이어서 듣기"는 첫 안 들은 문장부터 재생하고 카드를 닫는다', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    await user.click(screen.getByRole('button', { name: '다음 지문' }))

    await user.click(within(nudge() as HTMLElement).getByRole('button', { name: '이어서 듣기' }))

    expect(audio().currentTime).toBe(startOf(5, 4))
    expect(play).toHaveBeenCalledTimes(1)
    expect(nudge()).not.toBeInTheDocument()
  })

  it('"그냥 넘어가기"는 다음 지문으로 — 마지막 지문에서 단어로 가려 하면 완료 안 된 지문 안내', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    await user.click(screen.getByRole('button', { name: '다음 지문' }))

    await user.click(within(nudge() as HTMLElement).getByRole('button', { name: '그냥 넘어가기' }))
    expect(screen.getByRole('heading', { name: LESSON_MOCK.title(6) })).toBeInTheDocument()
    expect(nudge()).not.toBeInTheDocument()
    // 마지막 지문: 단어 버튼(지문을 다 듣기 전에는 흰 버튼)
    expect(screen.queryByRole('button', { name: '다음 지문' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '오늘 단어 57개 보기' }))
    expect(nudge()).toHaveTextContent('아직 완료 안 된 지문이 있어요')
    expect(nudge()).toHaveTextContent(
      '완료 안 된 지문: 5, 6 · 아무 음성으로 끝까지 들으면 완료돼요',
    )
    expect(
      within(nudge() as HTMLElement).getByRole('link', { name: '그래도 단어로' }),
    ).toHaveAttribute('href', '/lessons/L2-B1-05/words')

    await user.click(within(nudge() as HTMLElement).getByRole('button', { name: '마저 듣기' }))
    expect(screen.getByRole('heading', { name: LESSON_MOCK.title(5) })).toBeInTheDocument()
  })

  it('카드가 뜬 채 다른 지문 탭을 고르면 카드를 닫는다', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    await user.click(screen.getByRole('button', { name: '다음 지문' }))
    expect(nudge()).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '지문 1 완료' }))

    expect(screen.getByRole('heading', { name: LESSON_MOCK.title(1) })).toBeInTheDocument()
    expect(nudge()).not.toBeInTheDocument()
  })

  it('완료한 지문에서는 카드 없이 바로 다음 지문', async () => {
    const user = userEvent.setup()
    renderLesson()
    await heading()
    await user.click(screen.getByRole('button', { name: '지문 1 완료' }))

    await user.click(screen.getByRole('button', { name: '다음 지문' }))

    expect(nudge()).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: LESSON_MOCK.title(2) })).toBeInTheDocument()
  })

  it('어느 음성으로든 완료하면 지문 완료(서버) — 처음 음성은 가장 많이 들은 것이 아니라 미국 여성', async () => {
    server.use(
      http.get('*/api/v1/student/lessons/:code', () => {
        const detail = buildLessonDetail(LESSON_MOCK.code)
        // 지문 5: 영국 남으로 다 들었다(서버 completed). 지문 6: 미국 남 40%, 미국 여 10%
        const [p5, p6] = [detail.passages[4], detail.passages[5]]
        for (const v of p5.voices)
          if (v.variant === 'uk_m') Object.assign(v, { completed: true, coverage: 1 })
        for (const v of p6.voices) {
          if (v.variant === 'us_m') v.coverage = 0.4
          if (v.variant === 'us_w') v.coverage = 0.1
        }
        detail.completion.passagesDone = 5
        return HttpResponse.json(detail)
      }),
    )
    renderLesson()
    await heading()

    // 첫 미완료는 지문 6, 지문 5는 완료
    expect(screen.getByRole('heading', { name: LESSON_MOCK.title(6) })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '지문 5 완료' })).toBeInTheDocument()
    expect(voiceButton()).toHaveAccessibleName('음성 고르기, 지금 미국 여성')
    expect(player()).toHaveTextContent('들은 구간 10%') // 미국 여성 트랙의 서버 coverage
  })

  it('지문을 모두 마쳤으면 단어 학습 링크는 그대로 이동한다', async () => {
    server.use(
      http.get('*/api/v1/student/lessons/:code', () => {
        const detail = buildLessonDetail(LESSON_MOCK.code)
        for (const p of detail.passages) for (const v of p.voices) v.completed = true
        return HttpResponse.json(detail)
      }),
    )
    const user = userEvent.setup()
    const { router } = renderLesson()
    await heading()
    await user.click(screen.getByRole('button', { name: '지문 6 완료' }))

    await user.click(screen.getByRole('link', { name: '오늘 단어 57개 보기' }))

    expect(nudge()).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/lessons/L2-B1-05/words')
  })
})

describe('BE #18 계약 — 레벨 색, 문장 시각 없음', () => {
  it('반 레벨(level.code L2)을 <html data-level="green">으로 — colorHex는 쓰지 않는다(DESIGN.md)', async () => {
    renderLesson()
    await heading()

    expect(LESSON_MOCK.level.code).toBe('L2')
    expect(document.documentElement).toHaveAttribute('data-level', 'green')
    expect(screen.getByRole('main').style.getPropertyValue('--level')).toBe('')
  })

  it('timings가 []면 강조·문장 이동 없이 재생만 — 안내 카드도 안 들은 문장을 세지 않는다', async () => {
    server.use(
      http.get('*/api/v1/student/lessons/:code', () => {
        const detail = buildLessonDetail(LESSON_MOCK.code)
        for (const p of detail.passages) for (const v of p.voices) v.timings = []
        return HttpResponse.json(detail)
      }),
    )
    const user = userEvent.setup()
    renderLesson()
    await heading()

    listen(0, 20)
    expect(testCard()).toHaveTextContent(/전체\s*1:23/)
    expect(screen.queryByRole('img', { name: /^문장/ })).not.toBeInTheDocument()
    expect(within(testCard()).getByRole('button', { name: '이 문장 다시' })).toBeDisabled()
    expect(within(testCard()).getByRole('button', { name: '앞 문장' })).toBeDisabled()

    audio().paused = true
    fire(audio(), 'pause')
    play.mockClear()
    await user.click(screen.getByRole('button', { name: '다음 지문' }))
    expect(nudge()).toHaveTextContent('미국 여 들은 구간 30%')
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
        screen.getByRole('button', { name: '지문 6 아직 안 들음' }).click()
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
        trackId: LESSON_MOCK.passageTrackId(6, 'us_w'),
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

    expect(await screen.findByRole('button', { name: '지문 5 듣는 중 · 완료' })).toBeInTheDocument()
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
    await screen.findByRole('button', { name: '지문 5 듣는 중 · 완료' })
    await user.click(screen.getByRole('button', { name: '지문 6 아직 안 들음' }))
    listen(0, seconds(6))
    finish(seconds(6))
    await screen.findByRole('button', { name: '지문 6 듣는 중 · 완료' })
    // 서버가 6 / 6이라 하면 복습이 열린다
    expect(screen.getByRole('button', { name: '복습하기 · 본문 보며 듣기' })).toBeInTheDocument()

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

  it('응답의 회차 상태가 그대로면 홈·회차 목록을 다시 받지 않는다', async () => {
    const { client } = renderLesson()
    await heading()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const applied = vi.spyOn(client, 'setQueryData')

    listen(0, 3)
    const element = audio()
    element.paused = true
    fire(element, 'pause')

    // 응답을 캐시에 반영할 때까지 기다린다(상태 비교는 그 직전)
    await waitFor(() => expect(applied).toHaveBeenCalled())
    expect(invalidate).not.toHaveBeenCalled()
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
      trackId: LESSON_MOCK.passageTrackId(5, 'us_w'),
      segments: [expect.objectContaining({ startMs: 0, endMs: 3000 })],
    })
    expect(beacon).not.toHaveBeenCalled()
  })

  it('홈 버튼으로 나가도 들은 구간을 sendBeacon(final)으로 보낸다(뒤로와 같은 처리)', async () => {
    const user = userEvent.setup()
    const { router } = renderLesson()
    await heading()
    listen(0, 6)

    await user.click(screen.getByRole('link', { name: '홈으로' }))

    expect(router.state.location.pathname).toBe('/')
    expect(beacon).toHaveBeenCalledTimes(1)
    const body = await beaconBody(0)
    expect(body).toMatchObject({ final: true, trackId: LESSON_MOCK.passageTrackId(5, 'us_w') })
    expect(body.segments).toEqual([expect.objectContaining({ startMs: 0, endMs: 6000 })])
  })

  it('화면을 떠나면 홈·회차 목록을 다시 받게 한다 — beacon은 응답(완료)을 받지 못한다', async () => {
    const { router, client } = renderLesson()
    await heading()
    listen(0, 4)
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    await act(() => router.navigate('/lessons'))

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['student', 'home'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['student', 'lessons'] })
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
  it('음원 오류 → refresh 한 번(서명 쿠키 403일 수 있다) → 같은 자리에서 다시 불러와 이어 재생', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let refreshes = 0
    server.use(
      http.post('*/api/v1/auth/refresh', () => {
        refreshes += 1
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderLesson()
    await heading()
    listen(10, 20)
    play.mockClear()
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load')

    fire(audio(), 'error')

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    expect(refreshes).toBe(1)
    expect(play).toHaveBeenCalledTimes(1) // 듣던 중이었다
    metadata(seconds(5))
    expect(audio().currentTime).toBe(20)
    expect(within(player()).queryByRole('alert')).not.toBeInTheDocument()

    // 다시 불러와도 오류면(재생이 시작되기 전) 더 refresh하지 않고 안내
    fire(audio(), 'error')
    expect(within(player()).getByRole('alert')).toHaveTextContent('소리를 불러오지 못했어요')
    expect(refreshes).toBe(1)
  })

  it('음원을 못 불러오고 refresh도 실패하면(5xx) 안내와 다시 불러오기 — 듣던 자리에서 이어 불러온다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(http.post('*/api/v1/auth/refresh', () => new HttpResponse(null, { status: 503 })))
    const user = userEvent.setup()
    const { router } = renderLesson()
    await heading()
    listen(10, 20)
    play.mockClear()

    fire(audio(), 'error')

    expect(await within(player()).findByRole('alert')).toHaveTextContent('소리를 불러오지 못했어요')
    await user.click(within(player()).getByRole('button', { name: '다시 불러오기' }))
    expect(play).toHaveBeenCalledTimes(1)
    expect(within(player()).queryByRole('alert')).not.toBeInTheDocument()
    audio().currentTime = 0 // 새로 불러오면 0초부터 — 음원 정보를 받은 뒤 옮긴다
    metadata(seconds(5))
    expect(audio().currentTime).toBe(20)
    expect(router.state.location.pathname).toBe(`/lessons/${LESSON_MOCK.code}`)
  })

  it('다시 불러오다 또 오류면 "다시 불러오기"는 가려던 자리(듣던 자리)에서 이어 불러온다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(http.post('*/api/v1/auth/refresh', () => new HttpResponse(null, { status: 204 })))
    const user = userEvent.setup()
    renderLesson()
    await heading()
    listen(10, 20)
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load')

    fire(audio(), 'error')
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1)) // refresh 뒤 20초로 다시 불러오는 중
    audio().currentTime = 0 // 새로 불러온 음원은 0초 — 음원 정보가 오기 전에 또 오류
    fire(audio(), 'error')

    expect(within(player()).getByRole('alert')).toHaveTextContent('소리를 불러오지 못했어요')
    await user.click(within(player()).getByRole('button', { name: '다시 불러오기' }))
    metadata(seconds(5))
    expect(audio().currentTime).toBe(20)
  })

  it('음원 오류 뒤 refresh가 401이면 세션이 끝난 것 — 입장 화면으로(다시 불러오기를 되풀이하지 않는다)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(http.post('*/api/v1/auth/refresh', () => new HttpResponse(null, { status: 401 })))
    const { router } = renderLesson()
    await heading()

    fire(audio(), 'error')

    await waitFor(() => expect(router.state.location.pathname).toBe('/join'))
    expect(router.state.location.state).toEqual({ reason: 'sessionExpired' })
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

  it('Media Session: 제목 "Reading Day 5 · 지문 5 · 미국 여 · 1.0×", 재생·일시정지는 각각', async () => {
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
      title: 'Reading Day 5 · 지문 5 · 미국 여 · 1.0×',
      artist: '제이G 4 Seasons',
    })
    const pauseSpy = vi.mocked(HTMLMediaElement.prototype.pause)
    pauseSpy.mockClear()
    act(() => handlers.get('pause')?.())
    expect(pauseSpy).toHaveBeenCalledTimes(1)
    expect(play).not.toHaveBeenCalled()
    act(() => handlers.get('play')?.())
    expect(play).toHaveBeenCalledTimes(1)

    await user.click(within(rates()).getByRole('button', { name: '1.2' }))
    expect(session.metadata).toMatchObject({ title: 'Reading Day 5 · 지문 5 · 미국 여 · 1.2×' })
    await chooseVoice(user, '영국 여성')
    expect(session.metadata).toMatchObject({ title: 'Reading Day 5 · 지문 5 · 영국 여 · 1.2×' })
  })
})
