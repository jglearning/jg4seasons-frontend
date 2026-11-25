import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../../app/routes'
import { resetAuthMock, setMockSession } from '../../../mocks/handlers'
import { server } from '../../../mocks/node'
import { resetTalkMock, TALK_MOCK } from '../../../mocks/talkData'
import { renderRoutes } from '../../../test/render'
import type { RealtimeHandlers } from './realtime'

// 프리토킹 화면 — 연결(realtime.ts)은 가짜로 바꾸고 화면 흐름과 서버 응답별 화면을 본다.
// 실제 WebRTC·마이크·소리는 jsdom에 없어 브라우저·실기기에서 확인

const realtime = vi.hoisted(() => ({
  handlers: undefined as RealtimeHandlers | undefined,
  close: () => undefined as void,
}))

vi.mock('./realtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('./realtime')>()
  return {
    ...original,
    connectRealtime: (options: { handlers: RealtimeHandlers }) => {
      realtime.handlers = options.handlers
      return Promise.resolve({
        close: () => realtime.close(),
        send: () => undefined,
        usage: () => ({}),
      })
    },
  }
})

const track = { stop: vi.fn() }

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
  resetTalkMock()
  setMockSession('student')
  realtime.handlers = undefined
  track.stop.mockClear()
  // jsdom 30의 play()는 Promise가 아니고 "Not implemented"를 찍는다(CLAUDE.md 테스트 설정)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(() =>
        Promise.resolve({ getTracks: () => [track], getAudioTracks: () => [track] }),
      ),
    },
  })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices')
})

function renderTalk() {
  return renderRoutes(routes, { initialEntries: ['/talk'] })
}

const startButton = () => screen.findByRole('button', { name: '시작하기' })

describe('TalkPage', () => {
  it('시작 전: 주제 3개(첫 번째 선택) · 남은 횟수, 목소리 선택 없음', async () => {
    renderTalk()
    await startButton()
    const topics = screen.getAllByRole('radio')
    expect(topics).toHaveLength(3)
    expect(topics[0]).toBeChecked()
    // 목소리는 고르지 않는다(캐릭터에 맞춰 서버가 정함)
    expect(screen.queryByRole('button', { name: /목소리/ })).not.toBeInTheDocument()
    expect(screen.getByText('오늘 3번 더 할 수 있어요')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Green 그린 단계 캐릭터' })).toHaveAttribute(
      'src',
      '/art/green/winter/bust.webp',
    )
  })

  it('구독 없음(entitled: false): 잠금 안내 + 홈으로, 시작 버튼 없음', async () => {
    TALK_MOCK.entitled = false
    renderTalk()
    expect(await screen.findByText('구독하면 캐릭터와 영어로 말할 수 있어요')).toBeInTheDocument()
    expect(screen.getByText('선생님께 물어봐요')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('button', { name: '시작하기' })).not.toBeInTheDocument()
  })

  it('세션 생성 403이면 잠금 화면으로', async () => {
    server.use(
      http.post('*/api/v1/talk/sessions', () =>
        HttpResponse.json(
          { title: '구독하면 쓸 수 있어요', status: 403, code: 'SUBSCRIPTION_REQUIRED' },
          { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderTalk()
    await userEvent.click(await startButton())
    expect(await screen.findByText('구독하면 캐릭터와 영어로 말할 수 있어요')).toBeInTheDocument()
    expect(track.stop).toHaveBeenCalled()
  })

  it('기능 꺼짐(404 FEATURE_DISABLED)이면 홈으로 보낸다', async () => {
    TALK_MOCK.enabled = false
    renderTalk()
    expect(await screen.findByRole('link', { name: /오늘 단어/ })).toBeInTheDocument()
  })

  it('하루 3회 초과(429): 횟수 문구 + 시작 버튼 비활성', async () => {
    TALK_MOCK.dailyLimit = 0
    renderTalk()
    expect(await screen.findByText('오늘은 세 번 다 했어요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '시작하기' })).toBeDisabled()
  })

  it('세션 생성 429면 횟수 문구로 바뀐다', async () => {
    server.use(
      http.post('*/api/v1/talk/sessions', () =>
        HttpResponse.json(
          { title: '오늘은 세 번 다 했어요', status: 429, code: 'DAILY_LIMIT' },
          { status: 429, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderTalk()
    await userEvent.click(await startButton())
    expect(await screen.findByText('오늘은 세 번 다 했어요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '시작하기' })).toBeDisabled()
  })

  it('마이크 거부: 안내 문구, 대화로 넘어가지 않는다', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(new DOMException('denied', 'NotAllowedError')),
      },
    })
    renderTalk()
    await userEvent.click(await startButton())
    expect(await screen.findByText('마이크를 켜야 말할 수 있어요')).toBeInTheDocument()
  })

  it('시작 → 대화 → 끊기(확인) → 요약(summary: null이면 한 줄만)', async () => {
    TALK_MOCK.summaryFails = true
    let ended: unknown
    server.events.on('request:start', async ({ request }) => {
      if (request.url.endsWith('/end')) ended = await request.clone().json()
    })
    renderTalk()
    await userEvent.click(await startButton())
    await waitFor(() => expect(realtime.handlers).toBeDefined())
    // 연결 중: 전화 거는 화면처럼 — 남은 시간 없이 상태와 끊기 버튼
    expect(screen.getByText('연결하고 있어요')).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '대화 끝내기' })).toBeInTheDocument()

    act(() => {
      realtime.handlers!.onOpen()
      say('r1', 'Hi! What did you do today?')
      realtime.handlers!.onSpeechStarted('i1')
      realtime.handlers!.onSpeechStopped('i1')
      realtime.handlers!.onStudentText('i1', 'I play soccer.')
    })

    expect(await screen.findByText(line('Hi! What did you do today?'))).toBeInTheDocument()
    expect(screen.getByText('I play soccer.')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('3:00')
    // 머리 줄의 "끝내기" 글자 버튼은 없다
    expect(screen.queryByRole('button', { name: '끝내기' })).not.toBeInTheDocument()

    // 끊기 → 확인 → 계속하기면 그대로
    await userEvent.click(screen.getByRole('button', { name: '대화 끝내기' }))
    expect(screen.getByText('대화를 끝낼까요')).toBeInTheDocument()
    // 누른 끊기 버튼이 사라지므로 포커스는 "계속하기"로, 계속하면 끊기 버튼으로 돌아온다
    expect(screen.getByRole('button', { name: '계속하기' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: '계속하기' }))
    expect(screen.queryByText('대화를 끝낼까요')).not.toBeInTheDocument()
    expect(track.stop).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '대화 끝내기' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: '대화 끝내기' }))
    await userEvent.click(screen.getByRole('button', { name: '끝내기' }))

    expect(await screen.findByText('오늘 대화는 여기까지예요')).toBeInTheDocument()
    expect(screen.queryByText('잘 쓴 표현')).not.toBeInTheDocument()
    expect(screen.getByText('내가 말한 문장 1개')).toBeInTheDocument()
    expect(screen.getByText('시험 삼아 여는 기능이에요')).toBeInTheDocument()
    expect(track.stop).toHaveBeenCalled()
    expect(ended).toMatchObject({
      endReason: 'user',
      turns: [{ role: 'character' }, { role: 'student' }],
    })
    server.events.removeAllListeners()
  })

  it('캐릭터 말 속 회차 단어는 버튼 — 누르면 자막 아래 뜻 한 줄, 3초 뒤 사라진다. 학생 말은 강조 없음', async () => {
    renderTalk()
    await userEvent.click(await startButton())
    await waitFor(() => expect(realtime.handlers).toBeDefined())
    act(() => {
      realtime.handlers!.onOpen()
      say('r1', 'You sound cheerful! Did you visit anyone this weekend?')
      realtime.handlers!.onSpeechStarted('i1')
      realtime.handlers!.onSpeechStopped('i1')
      realtime.handlers!.onStudentText('i1', 'I visited my cheerful grandma.')
    })

    const cheerful = await screen.findByRole('button', { name: 'cheerful 뜻 보기' })
    expect(screen.getByRole('button', { name: 'visit 뜻 보기' })).toHaveTextContent('visit')
    expect(screen.getByRole('button', { name: 'weekend 뜻 보기' })).toBeInTheDocument()
    // 학생 줄에는 버튼이 없다(cheerful 버튼은 캐릭터 줄의 하나뿐)
    expect(screen.getAllByRole('button', { name: /뜻 보기/ })).toHaveLength(3)

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fireEvent.click(cheerful)
    expect(screen.getByText('쾌활한')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(3_100))
    expect(screen.queryByText('쾌활한')).not.toBeInTheDocument()
    vi.useRealTimers()

    // 다른 곳을 누르면 바로 사라진다
    await userEvent.click(screen.getByRole('button', { name: 'visit 뜻 보기' }))
    expect(screen.getByText('방문하다')).toBeInTheDocument()
    await userEvent.click(screen.getByText('I visited my cheerful grandma.'))
    expect(screen.queryByText('방문하다')).not.toBeInTheDocument()
  })

  it('회차 단어가 없으면 강조 없이 그대로', async () => {
    TALK_MOCK.lessonWords = []
    renderTalk()
    await userEvent.click(await startButton())
    await waitFor(() => expect(realtime.handlers).toBeDefined())
    act(() => {
      realtime.handlers!.onOpen()
      say('r1', 'You sound cheerful!')
    })
    expect(await screen.findByText(line('You sound cheerful!'))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /뜻 보기/ })).not.toBeInTheDocument()
  })

  it('요약이 있으면 잘 쓴 표현 · 이렇게도 말해 봐요', async () => {
    renderTalk()
    await userEvent.click(await startButton())
    await waitFor(() => expect(realtime.handlers).toBeDefined())
    act(() => realtime.handlers!.onOpen())
    await userEvent.click(screen.getByRole('button', { name: '대화 끝내기' }))
    await userEvent.click(screen.getByRole('button', { name: '끝내기' }))

    expect(await screen.findByText('잘 쓴 표현')).toBeInTheDocument()
    expect(screen.getByText('I went to school and played soccer.')).toBeInTheDocument()
    expect(screen.getByText('지난 일은 과거형으로 말해요')).toBeInTheDocument()
  })
})

/** 캐릭터가 한 마디를 끝까지 말함(글자 → 소리 시작 → 소리 끝) */
function say(id: string, text: string) {
  const h = realtime.handlers!
  h.onResponseCreated(id)
  h.onTextDelta(id, text)
  h.onTextDone(id, text)
  h.onAudioStarted(id)
  h.onAudioStopped(id)
  h.onResponseDone(id, 'completed')
}

/** 단어마다 span으로 나뉜 자막 줄을 전체 글자로 찾는다 */
function line(text: string) {
  return (_: string, element: Element | null) =>
    element?.tagName === 'P' && !element.hasAttribute('aria-live') && element.textContent === text
}
