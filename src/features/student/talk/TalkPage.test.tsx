import { act, screen, waitFor } from '@testing-library/react'
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
  /** 연결을 몇 번 시도했나 */
  calls: 0,
  /** 있으면 이번 연결 결과를 이걸로(실패·붙잡기). 없으면 바로 성공 */
  next: undefined as (() => Promise<void>) | undefined,
}))

vi.mock('./realtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('./realtime')>()
  return {
    ...original,
    connectRealtime: async (options: { handlers: RealtimeHandlers }) => {
      realtime.calls += 1
      realtime.handlers = options.handlers
      const next = realtime.next
      realtime.next = undefined
      if (next) await next()
      return { close: () => undefined, send: () => undefined, usage: () => ({}) }
    },
  }
})

// 종료 요청의 keepalive는 MSW가 요청을 다시 만들며 잃으므로(authFetch.test 참고) 호출에서 본다
const endCalls = vi.hoisted(() => [] as { body: Record<string, unknown>; keepalive: boolean }[])

vi.mock('./talkApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('./talkApi')>()
  return {
    ...original,
    endTalkSession: (...args: Parameters<typeof original.endTalkSession>) => {
      const [, body, options] = args
      endCalls.push({ body, keepalive: options?.keepalive ?? false })
      return original.endTalkSession(...args)
    },
  }
})

/** 붙잡아 두었다가 풀거나 실패시키는 약속 */
function deferred() {
  let resolve: () => void = () => undefined
  let reject: (error: Error) => void = () => undefined
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** 종료 요청 호출(본문 + keepalive) — 이번 테스트 것만 */
function recordEnds() {
  endCalls.length = 0
  return endCalls
}

/** 대화를 끊고 요약까지 — 테스트가 대화를 연 채 끝나 종료 요청이 다음 테스트로 새지 않게 */
async function hangUp() {
  await userEvent.click(screen.getByRole('button', { name: '대화 끝내기' }))
  await userEvent.click(screen.getByRole('button', { name: '끝내기' }))
  await screen.findByRole('link', { name: '홈으로' })
}

const track = { stop: vi.fn() }

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
  resetTalkMock()
  setMockSession('student')
  realtime.handlers = undefined
  realtime.calls = 0
  realtime.next = undefined
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
  server.events.removeAllListeners()
})

function renderTalk() {
  return renderRoutes(routes, { initialEntries: ['/talk'] })
}

const startButton = () => screen.findByRole('button', { name: '시작하기' })

describe('TalkPage', () => {
  it('시작 전: 주제 3개(회차 단어 카드 선택) · 단어 칩 3개 + 남은 수 · 남은 횟수, 목소리 선택 없음', async () => {
    renderTalk()
    await startButton()
    expect(screen.getByRole('heading', { name: '프리토킹' })).toBeInTheDocument()
    expect(screen.getByText(/3분 동안/)).toBeInTheDocument()
    const topics = screen.getAllByRole('radio')
    expect(topics).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /오늘 배운 단어로/ })).toBeChecked()
    expect(screen.getByText('Reading Day 5 단어가 대화에 나와요')).toBeInTheDocument()
    // 단어 4개 중 앞 3개는 칩, 나머지는 수로
    expect(screen.getByText('cheerful')).toBeInTheDocument()
    expect(screen.getByText('visit')).toBeInTheDocument()
    expect(screen.queryByText('play soccer')).not.toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
    // 다른 주제를 고르면 그쪽만 선택
    await userEvent.click(screen.getByRole('radio', { name: '좋아하는 것' }))
    expect(screen.getByRole('radio', { name: '좋아하는 것' })).toBeChecked()
    expect(screen.getByRole('radio', { name: /오늘 배운 단어로/ })).not.toBeChecked()
    // 목소리는 고르지 않는다(캐릭터에 맞춰 서버가 정함)
    expect(screen.queryByRole('button', { name: /목소리/ })).not.toBeInTheDocument()
    expect(screen.getByText('오늘 3번 더 할 수 있어요')).toBeInTheDocument()
    // 홈 표지와 같은 그림, 뒤로는 홈으로
    expect(screen.getByRole('img', { name: 'Green 그린 단계 캐릭터' })).toHaveAttribute(
      'src',
      '/art/green/winter/cover.webp',
    )
    expect(screen.getByRole('link', { name: '뒤로' })).toHaveAttribute('href', '/')
  })

  it('회차 단어가 없으면: 카드 부제가 바뀌고 칩 없음, 처음 선택은 "오늘 하루"', async () => {
    TALK_MOCK.lessonWords = []
    renderTalk()
    await startButton()
    expect(screen.getByText('오늘 회차 단어가 아직 없어요')).toBeInTheDocument()
    expect(screen.queryByText(/단어가 대화에 나와요/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '오늘 하루' })).toBeChecked()
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

    // 끊기 → 확인 시트 → 계속 말하기면 그대로
    await userEvent.click(screen.getByRole('button', { name: '대화 끝내기' }))
    const sheet = screen.getByRole('dialog', { name: '대화를 끝낼까요' })
    expect(sheet).toHaveAttribute('aria-modal', 'true')
    expect(sheet).toHaveAccessibleDescription('지금까지 말한 내용을 정리해서 보여 드려요')
    // 열리면 "계속 말하기"에 포커스, 뒤 화면은 inert. 닫으면 끊기 버튼으로 돌아온다
    expect(screen.getByRole('button', { name: '계속 말하기' })).toHaveFocus()
    expect(
      screen.getByRole('button', { name: '대화 끝내기', hidden: true }).closest('[inert]'),
    ).not.toBeNull()
    // Tab은 시트 안에서만 돈다
    await userEvent.tab()
    expect(screen.getByRole('button', { name: '끝내기' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: '계속 말하기' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: '계속 말하기' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(track.stop).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '대화 끝내기' })).toHaveFocus()

    // Esc도 계속 말하기
    await userEvent.click(screen.getByRole('button', { name: '대화 끝내기' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '대화 끝내기' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: '대화 끝내기' }))
    await userEvent.click(screen.getByRole('button', { name: '끝내기' }))

    expect(await screen.findByText('오늘 대화는 여기까지예요')).toBeInTheDocument()
    expect(screen.queryByText('잘 쓴 표현')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /동안 말했어요/ })).toBeInTheDocument()
    expect(screen.getByText('내가 말한 문장 1개 · 오늘 배운 단어로')).toBeInTheDocument()
    expect(screen.getByText('시험 삼아 여는 기능이에요')).toBeInTheDocument()
    expect(track.stop).toHaveBeenCalled()
    expect(ended).toMatchObject({
      endReason: 'user',
      turns: [{ role: 'character' }, { role: 'student' }],
    })
  })

  it('캐릭터 말 속 회차 단어는 강조 글자(버튼 아님, 뜻 없음). 학생 말은 강조 없음', async () => {
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

    const character = await screen.findByText(
      line('You sound cheerful! Did you visit anyone this weekend?'),
    )
    expect(highlighted(character)).toEqual(['cheerful', 'visit', 'weekend'])
    expect(highlighted(screen.getByText('I visited my cheerful grandma.'))).toEqual([])
    expect(screen.queryByRole('button', { name: /뜻 보기/ })).not.toBeInTheDocument()
    expect(screen.queryByText('쾌활한')).not.toBeInTheDocument()
    await hangUp()
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
    expect(highlighted(await screen.findByText(line('You sound cheerful!')))).toEqual([])
    await hangUp()
  })

  it('상태 줄: 캐릭터가 말하면 "말하고 있어요", 아니면 "듣고 있어요"', async () => {
    renderTalk()
    await userEvent.click(await startButton())
    await waitFor(() => expect(realtime.handlers).toBeDefined())
    act(() => realtime.handlers!.onOpen())
    expect(await screen.findByText('듣고 있어요')).toBeInTheDocument()
    act(() => {
      const h = realtime.handlers!
      h.onResponseCreated('r1')
      h.onTextDelta('r1', 'Hello there')
      h.onAudioStarted('r1')
    })
    expect(await screen.findByText('말하고 있어요')).toBeInTheDocument()
    act(() => {
      const h = realtime.handlers!
      h.onTextDone('r1', 'Hello there')
      h.onAudioStopped('r1')
      h.onResponseDone('r1', 'completed')
    })
    expect(await screen.findByText('듣고 있어요')).toBeInTheDocument()
    await hangUp()
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

describe('TalkPage 연결·이탈(리뷰 11/25)', () => {
  it('세션을 만드는 중에 화면을 떠나면 연결하지 않고 마이크를 끄고, 만든 세션은 left로 닫는다', async () => {
    const ends = recordEnds()
    const create = deferred()
    server.use(
      http.post('*/api/v1/talk/sessions', async () => {
        await create.promise
        return HttpResponse.json(
          {
            id: 91,
            status: 'created',
            maxSeconds: 180,
            realtime: {
              clientSecret: 'ek_test',
              expiresAt: '2026-11-26T00:00:00Z',
              model: 'm',
              closingInstruction: 'Bye',
            },
          },
          { status: 201 },
        )
      }),
      http.post('*/api/v1/talk/sessions/:id/end', () =>
        HttpResponse.json({
          id: 91,
          status: 'ended',
          durationSec: 0,
          studentTurnCount: 0,
          summary: null,
        }),
      ),
    )
    const { router } = renderTalk()
    await userEvent.click(await startButton())
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled())
    await act(() => router.navigate('/'))
    create.resolve()

    await waitFor(() => expect(ends).toHaveLength(1))
    expect(ends[0]).toEqual({
      body: { durationSec: 0, endReason: 'left', turns: [] },
      keepalive: true,
    })
    expect(track.stop).toHaveBeenCalled()
    expect(realtime.calls).toBe(0)
  })

  it('연결 실패 → "다시 시도"는 같은 clientSessionId로, 실패한 시도의 마이크는 끈다', async () => {
    const ids: string[] = []
    server.events.on('request:start', async ({ request }) => {
      if (new URL(request.url).pathname.endsWith('/talk/sessions'))
        ids.push(((await request.clone().json()) as { clientSessionId: string }).clientSessionId)
    })
    realtime.next = () => Promise.reject(new Error('realtime calls 500'))
    renderTalk()
    await userEvent.click(await startButton())

    expect(await screen.findByText('연결하지 못했어요. 다시 해 봐요')).toBeInTheDocument()
    expect(track.stop).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(realtime.calls).toBe(2))
    expect(ids).toHaveLength(2)
    expect(ids[1]).toBe(ids[0])
    act(() => realtime.handlers!.onOpen())
    await hangUp()
  })

  it('연결하는 중에 끊고 그 뒤 연결이 실패해도 요약 화면이 그대로', async () => {
    const connect = deferred()
    realtime.next = () => connect.promise
    renderTalk()
    await userEvent.click(await startButton())
    await waitFor(() => expect(realtime.calls).toBe(1))
    await hangUp()
    expect(await screen.findByText('잘 쓴 표현')).toBeInTheDocument()

    await act(async () => connect.reject(new Error('realtime calls 500')))
    expect(screen.getByText('잘 쓴 표현')).toBeInTheDocument()
    expect(screen.queryByText('연결하지 못했어요. 다시 해 봐요')).not.toBeInTheDocument()
  })

  it('대화 중 탭을 닫으면(pagehide) left로 keepalive 종료 요청 한 번', async () => {
    const ends = recordEnds()
    renderTalk()
    await userEvent.click(await startButton())
    await waitFor(() => expect(realtime.handlers).toBeDefined())
    act(() => realtime.handlers!.onOpen())
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    await waitFor(() => expect(ends).toHaveLength(1))
    expect(ends[0].body).toMatchObject({ endReason: 'left' })
    expect(ends[0].keepalive).toBe(true)
    expect(track.stop).toHaveBeenCalled()
    await screen.findByRole('link', { name: '홈으로' })
  })

  it('대화 중 다른 화면으로 가면 left로 keepalive 종료 요청', async () => {
    const ends = recordEnds()
    const { router } = renderTalk()
    await userEvent.click(await startButton())
    await waitFor(() => expect(realtime.handlers).toBeDefined())
    act(() => realtime.handlers!.onOpen())
    await act(() => router.navigate('/'))
    await waitFor(() => expect(ends).toHaveLength(1))
    expect(ends[0]).toMatchObject({ body: { endReason: 'left' }, keepalive: true })
  })

  it('사용 기간 아님(403 LICENSE_INACTIVE)은 구독 잠금이 아니라 연결 실패 안내', async () => {
    server.use(
      http.post('*/api/v1/talk/sessions', () =>
        HttpResponse.json(
          { title: '사용 기간이 아니에요', status: 403, code: 'LICENSE_INACTIVE' },
          { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderTalk()
    await userEvent.click(await startButton())
    expect(await screen.findByText('연결하지 못했어요. 다시 해 봐요')).toBeInTheDocument()
    expect(screen.queryByText('구독하면 캐릭터와 영어로 말할 수 있어요')).not.toBeInTheDocument()
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

/** 자막 줄에서 강조된 회차 단어(강조 span > 단어 span) — 강조 없는 단어는 줄 바로 아래 span */
function highlighted(lineElement: HTMLElement): string[] {
  return [...lineElement.querySelectorAll(':scope > span')]
    .filter((span) => span.querySelector('span') !== null)
    .map((span) => span.textContent ?? '')
}

/** 단어마다 span으로 나뉜 자막 줄을 전체 글자로 찾는다 */
function line(text: string) {
  return (_: string, element: Element | null) =>
    element?.tagName === 'P' && !element.hasAttribute('aria-live') && element.textContent === text
}
