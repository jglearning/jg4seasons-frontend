import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RealtimeConnection, RealtimeHandlers } from './realtime'
import type { TalkEndBody, TalkSessionResult } from './talkApi'
import {
  CLOSING_AT_SECONDS,
  firstWords,
  GRACE_SECONDS,
  HIDDEN_LIMIT_MS,
  OPEN_TIMEOUT_MS,
  TalkCall,
  WORDS_PER_SECOND,
} from './talkCall'

// 대화 한 번의 진행 — 종료 네 경로가 정리 함수 하나를 한 번만 타는지, 자막을 말 속도로 푸는지,
// 끼어들면 들린 데까지만 남는지, 마무리 지시가 한 번만 나가고 인사가 끝나면 끝나는지, 시간 + 5초에 끊기는지

const RESULT: TalkSessionResult = {
  id: 77,
  status: 'ended',
  durationSec: 0,
  studentTurnCount: 0,
  summary: null,
}

const CLOSING = 'Say goodbye.'

function setup({
  maxSeconds = 180,
  connectFails = false,
  closingInstruction = CLOSING,
  /** true면 connect가 resolveConnect()를 부를 때까지 끝나지 않는다(연결하는 중 상황) */
  deferConnect = false,
} = {}) {
  const track = { stop: vi.fn() }
  const mic = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream
  const sent: Record<string, unknown>[] = []
  const connection: RealtimeConnection = {
    close: vi.fn(),
    send: (event) => sent.push(event),
    usage: () => ({ responses: { total_tokens: 12 } }),
  }
  let handlers: RealtimeHandlers | undefined
  const end = vi.fn<
    (body: TalkEndBody, options: { keepalive: boolean }) => Promise<TalkSessionResult>
  >(() => Promise.resolve(RESULT))
  const release = vi.fn()
  const holdScreen = vi.fn(() => release)
  let resolveConnect: () => void = () => undefined
  const call = new TalkCall({
    sessionId: 77,
    maxSeconds,
    mic,
    closingInstruction,
    connect: (h) => {
      handlers = h
      if (connectFails) return Promise.reject(new Error('sdp 500'))
      if (deferConnect)
        return new Promise<RealtimeConnection>((resolve) => {
          resolveConnect = () => resolve(connection)
        })
      return Promise.resolve(connection)
    },
    end,
    onChange: () => undefined,
    holdScreen,
  })
  const h = () => handlers!
  /** 캐릭터가 한 마디 한다(글자가 먼저 오고 소리가 시작됨) */
  const characterSays = (id: string, text: string) => {
    h().onResponseCreated(id)
    h().onTextDelta(id, text)
    h().onTextDone(id, text)
    h().onAudioStarted(id)
  }
  const visible = () =>
    call.state.lines.filter((l) => l.text !== '').map((l) => `${l.role}:${l.text}`)
  return {
    call,
    track,
    connection,
    end,
    release,
    holdScreen,
    sent,
    h,
    characterSays,
    visible,
    resolveConnect: () => resolveConnect(),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('종료', () => {
  it('끝내기: 몇 번 눌러도 종료 요청은 한 번, 마이크 정지 · 연결 닫기 · 화면 꺼짐 방지 풀기', async () => {
    const t = setup()
    await t.call.start()
    t.h().onOpen()
    t.characterSays('r1', 'Hi! What did you do today?')
    t.h().onAudioStopped('r1')
    t.h().onResponseDone('r1', 'completed')
    t.h().onSpeechStarted('i1')
    t.h().onSpeechStopped('i1')
    t.h().onStudentText('i1', 'I play soccer.')
    await vi.advanceTimersByTimeAsync(5_000)

    await Promise.all([t.call.finish('user'), t.call.finish('user'), t.call.finish('timeout')])

    expect(t.end).toHaveBeenCalledTimes(1)
    expect(t.end).toHaveBeenCalledWith(
      {
        durationSec: 5,
        endReason: 'user',
        turns: [
          { role: 'character', text: 'Hi! What did you do today?' },
          { role: 'student', text: 'I play soccer.' },
        ],
        usage: { responses: { total_tokens: 12 } },
      },
      { keepalive: false },
    )
    expect(t.track.stop).toHaveBeenCalledTimes(1)
    expect(t.connection.close).toHaveBeenCalledTimes(1)
    expect(t.release).toHaveBeenCalledTimes(1)
    expect(t.call.state).toMatchObject({ phase: 'ended', result: RESULT })
  })

  it('시간 종료: 캐릭터가 말하지 않으면 maxSeconds에 timeout 한 번', async () => {
    const t = setup({ maxSeconds: 10, closingInstruction: '' })
    await t.call.start()
    t.h().onOpen()
    await vi.advanceTimersByTimeAsync(9_000)
    expect(t.call.state.remaining).toBe(1)
    expect(t.end).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1_100)
    expect(t.end).toHaveBeenCalledTimes(1)
    expect(t.end.mock.calls[0][0]).toMatchObject({ endReason: 'timeout', durationSec: 10 })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(t.end).toHaveBeenCalledTimes(1)
  })

  it('시간이 다 됐는데 말하는 중이면 기다리고, 소리가 끝나면 끝낸다', async () => {
    const t = setup({ maxSeconds: 10, closingInstruction: '' })
    await t.call.start()
    t.h().onOpen()
    await vi.advanceTimersByTimeAsync(9_000)
    t.characterSays('r1', 'One more thing about your weekend.')
    await vi.advanceTimersByTimeAsync(3_000)
    expect(t.call.state.remaining).toBe(0)
    expect(t.end).not.toHaveBeenCalled()

    t.h().onAudioStopped('r1')
    await vi.advanceTimersByTimeAsync(200)
    expect(t.end).toHaveBeenCalledTimes(1)
    expect(t.end.mock.calls[0][0].durationSec).toBe(10)
  })

  it('계속 말해도 maxSeconds + 5초에는 무조건 끊는다', async () => {
    const t = setup({ maxSeconds: 10, closingInstruction: '' })
    await t.call.start()
    t.h().onOpen()
    await vi.advanceTimersByTimeAsync(8_000)
    t.characterSays('r1', 'This is a very long story that keeps going and going.')
    await vi.advanceTimersByTimeAsync((2 + GRACE_SECONDS) * 1000 - 200)
    expect(t.end).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)
    expect(t.end).toHaveBeenCalledTimes(1)
    expect(t.end.mock.calls[0][0].endReason).toBe('timeout')
  })

  it('타이머는 연결되기 전에는 세지 않는다', async () => {
    const t = setup({ maxSeconds: 10 })
    await t.call.start()
    await vi.advanceTimersByTimeAsync(OPEN_TIMEOUT_MS - 1_000)
    expect(t.call.state.remaining).toBe(10)
    await t.call.finish('user')
    expect(t.end.mock.calls[0][0].durationSec).toBe(0)
  })
})

describe('연결 단계', () => {
  it('채널이 기한 안에 열리지 않으면 연결 실패 — 마이크·연결 정리, 종료 요청 없음(같은 세션으로 다시 시도)', async () => {
    const t = setup()
    await t.call.start()
    const opened = t.call.whenOpen()
    const failed = expect(opened).rejects.toThrow('채널이 열리지 않음')
    await vi.advanceTimersByTimeAsync(OPEN_TIMEOUT_MS + 100)
    await failed
    expect(t.track.stop).toHaveBeenCalled()
    expect(t.connection.close).toHaveBeenCalledTimes(1)
    expect(t.end).not.toHaveBeenCalled()
    // 늦게 열려도 대화가 시작되지 않는다
    t.h().onOpen()
    expect(t.holdScreen).not.toHaveBeenCalled()
  })

  it('채널이 열리기 전에 끊기면 연결 실패(요약으로 가지 않음)', async () => {
    const t = setup()
    await t.call.start()
    const failed = expect(t.call.whenOpen()).rejects.toThrow('채널이 열리기 전에 끊김')
    t.h().onLost()
    await failed
    expect(t.end).not.toHaveBeenCalled()
    expect(t.track.stop).toHaveBeenCalled()
  })

  it('열리면 whenOpen이 끝나고 기한은 더 세지 않는다', async () => {
    const t = setup()
    await t.call.start()
    t.h().onOpen()
    await expect(t.call.whenOpen()).resolves.toBeUndefined()
    await vi.advanceTimersByTimeAsync(OPEN_TIMEOUT_MS + 1_000)
    expect(t.connection.close).not.toHaveBeenCalled()
    expect(t.track.stop).not.toHaveBeenCalled()
  })

  it('연결하는 중에 끊으면 0초로 한 번 끝내고, 늦게 온 연결은 바로 닫고 열림은 무시한다', async () => {
    const t = setup({ deferConnect: true })
    const starting = t.call.start()
    const opened = expect(t.call.whenOpen()).rejects.toThrow()
    await t.call.finish('user')
    await opened
    expect(t.end).toHaveBeenCalledTimes(1)
    expect(t.end.mock.calls[0][0]).toMatchObject({ endReason: 'user', durationSec: 0, turns: [] })
    expect(t.track.stop).toHaveBeenCalled()

    t.resolveConnect()
    await starting
    expect(t.connection.close).toHaveBeenCalledTimes(1)
    t.h().onOpen()
    expect(t.holdScreen).not.toHaveBeenCalled()
    expect(t.call.state.phase).toBe('ended')
  })

  it('화면 이탈: 30초 넘게 숨겨지면 left로 keepalive 한 번, 그 전에 돌아오면 이어서', async () => {
    const t = setup()
    await t.call.start()
    t.h().onOpen()
    t.call.visibilityChanged(true)
    await vi.advanceTimersByTimeAsync(HIDDEN_LIMIT_MS - 1_000)
    t.call.visibilityChanged(false)
    await vi.advanceTimersByTimeAsync(HIDDEN_LIMIT_MS)
    expect(t.end).not.toHaveBeenCalled()
    expect(t.holdScreen).toHaveBeenCalledTimes(2)

    t.call.visibilityChanged(true)
    await vi.advanceTimersByTimeAsync(HIDDEN_LIMIT_MS)
    expect(t.end).toHaveBeenCalledTimes(1)
    expect(t.end.mock.calls[0][0].endReason).toBe('left')
    expect(t.end.mock.calls[0][1]).toEqual({ keepalive: true })
    expect(t.track.stop).toHaveBeenCalled()
    await t.call.finish('left', { keepalive: true })
    expect(t.end).toHaveBeenCalledTimes(1)
  })

  it('연결 끊김: disconnected로 한 번 끝나고 연결을 닫는다', async () => {
    const t = setup()
    await t.call.start()
    t.h().onOpen()
    t.h().onLost()
    t.h().onLost()
    await vi.advanceTimersByTimeAsync(0)
    expect(t.end).toHaveBeenCalledTimes(1)
    expect(t.end.mock.calls[0][0].endReason).toBe('disconnected')
    expect(t.connection.close).toHaveBeenCalledTimes(1)
    expect(t.track.stop).toHaveBeenCalled()
  })

  it('연결에 실패하면 마이크를 멈추고 던진다(종료 요청 없음)', async () => {
    const t = setup({ connectFails: true })
    await expect(t.call.start()).rejects.toThrow('sdp 500')
    expect(t.track.stop).toHaveBeenCalled()
    expect(t.end).not.toHaveBeenCalled()
  })

  it('종료 요청이 실패해도 끝 화면으로(endFailed)', async () => {
    const t = setup()
    t.end.mockRejectedValueOnce(new Error('offline'))
    await t.call.start()
    t.h().onOpen()
    await t.call.finish('user')
    expect(t.call.state).toMatchObject({ phase: 'ended', endFailed: true })
  })
})

describe('자막', () => {
  it('글자는 소리가 시작돼야 보이고, 말 속도로 단어를 하나씩 푼다', async () => {
    const t = setup()
    await t.call.start()
    t.h().onOpen()
    t.h().onResponseCreated('r1')
    t.h().onTextDelta('r1', 'Hi there! How was your weekend?')
    expect(t.visible()).toEqual([])

    t.h().onAudioStarted('r1')
    expect(t.call.state.phase).toBe('speaking')
    expect(t.visible()).toEqual(['character:Hi'])
    await vi.advanceTimersByTimeAsync(1_000 / WORDS_PER_SECOND + 50)
    expect(t.visible()).toEqual(['character:Hi there!'])
    await vi.advanceTimersByTimeAsync(1_000 / WORDS_PER_SECOND)
    expect(t.visible()).toEqual(['character:Hi there! How'])

    // 소리가 끝나면 남은 글자를 모두
    t.h().onTextDone('r1', 'Hi there! How was your weekend?')
    t.h().onAudioStopped('r1')
    expect(t.visible()).toEqual(['character:Hi there! How was your weekend?'])
    expect(t.call.state.lines[0].done).toBe(true)
    expect(t.call.state.announce).toBe('Hi there! How was your weekend?')
    expect(t.call.state.phase).toBe('listening')
  })

  it('끼어들기: 학생이 말을 시작하면 자막이 멈추고 turns에는 들린 데까지만', async () => {
    const t = setup()
    await t.call.start()
    t.h().onOpen()
    t.characterSays('r1', 'Tell me about your cheerful friend and your weekend trip.')
    await vi.advanceTimersByTimeAsync(1_000 / WORDS_PER_SECOND + 50)
    expect(t.visible()).toEqual(['character:Tell me'])

    t.h().onSpeechStarted('i1')
    // 서버의 cleared가 늦게 와도 학생 말이 시작된 때 이미 멈춰 있다
    await vi.advanceTimersByTimeAsync(3_000)
    expect(t.visible()).toEqual(['character:Tell me'])
    t.h().onAudioCleared('r1')
    await vi.advanceTimersByTimeAsync(3_000)
    // 나중에 오는 글자·소리 끝 이벤트로 늘지 않는다
    t.h().onTextDone('r1', 'Tell me about your cheerful friend and your weekend trip.')
    t.h().onAudioStopped('r1')
    expect(t.visible()).toEqual(['character:Tell me'])

    t.h().onSpeechStopped('i1')
    t.h().onStudentText('i1', 'My friend is Mina.')
    await t.call.finish('user')
    expect(t.end.mock.calls[0][0].turns).toEqual([
      { role: 'character', text: 'Tell me' },
      { role: 'student', text: 'My friend is Mina.' },
    ])
  })

  it('학생 줄은 말이 끝난 자리에 — 글자가 캐릭터 대답보다 늦게 와도 순서 유지, 비어 오면 줄 없음', async () => {
    const t = setup()
    await t.call.start()
    t.h().onOpen()
    t.h().onSpeechStarted('i1')
    t.h().onSpeechStopped('i1')
    t.characterSays('r1', 'Nice!')
    t.h().onAudioStopped('r1')
    t.h().onStudentText('i1', 'I went to the park.')
    t.h().onSpeechStarted('i2')
    t.h().onSpeechStopped('i2')
    t.h().onStudentText('i2', '   ')

    expect(t.visible()).toEqual(['student:I went to the park.', 'character:Nice!'])
    expect(t.call.state.lines).toHaveLength(2)
  })

  it('끝낼 때 말하던 줄은 보인 데까지만 turns에', async () => {
    const t = setup()
    await t.call.start()
    t.h().onOpen()
    t.characterSays('r1', 'One two three four five six.')
    await vi.advanceTimersByTimeAsync(1_000 / WORDS_PER_SECOND + 50)
    await t.call.finish('user')
    expect(t.end.mock.calls[0][0].turns).toEqual([{ role: 'character', text: 'One two' }])
  })

  it('firstWords: 앞 단어 n개, 뒤 공백 없이', () => {
    expect(firstWords('Hi there!  How are you?', 2)).toBe('Hi there!')
    expect(firstWords('Hi', 5)).toBe('Hi')
    expect(firstWords('Hi there', 0)).toBe('')
  })
})

describe('마무리 인사', () => {
  const closingSent = (sent: Record<string, unknown>[]) =>
    sent.filter((e) => e.type === 'response.create')

  it('남은 시간 20초에 한 번만 보내고, 그 인사의 소리가 끝나면 timeout으로 끝낸다', async () => {
    const t = setup({ maxSeconds: 30 })
    await t.call.start()
    t.h().onOpen()
    await vi.advanceTimersByTimeAsync((30 - CLOSING_AT_SECONDS) * 1000 + 100)

    expect(closingSent(t.sent)).toEqual([
      { type: 'response.create', response: { instructions: CLOSING } },
    ])
    expect(t.call.state.closing).toBe(true)
    await vi.advanceTimersByTimeAsync(3_000)
    expect(closingSent(t.sent)).toHaveLength(1)
    // 다시 보낼 기회가 와도(학생 말 끝 · 다른 응답 끝) 두 번 보내지 않는다
    t.h().onSpeechStarted('i9')
    t.h().onSpeechStopped('i9')
    t.h().onResponseDone('other', 'completed')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(closingSent(t.sent)).toHaveLength(1)

    t.characterSays('bye', 'Great talking with you. Bye!')
    t.h().onAudioStopped('bye')
    await vi.advanceTimersByTimeAsync(0)
    expect(t.end).toHaveBeenCalledTimes(1)
    expect(t.end.mock.calls[0][0].endReason).toBe('timeout')
    expect(t.end.mock.calls[0][0].turns).toEqual([
      { role: 'character', text: 'Great talking with you. Bye!' },
    ])
  })

  it('학생이 말하는 중이면 기다렸다가 말이 끝난 뒤(자동 응답이 끝나면) 보낸다', async () => {
    const t = setup({ maxSeconds: 30 })
    await t.call.start()
    t.h().onOpen()
    await vi.advanceTimersByTimeAsync(9_000)
    t.h().onSpeechStarted('i1')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(closingSent(t.sent)).toHaveLength(0)

    t.h().onSpeechStopped('i1')
    // 서버가 학생 말에 자동으로 대답하는 중에는 보내지 않는다
    t.characterSays('r1', 'Cool!')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(closingSent(t.sent)).toHaveLength(0)
    t.h().onAudioStopped('r1')
    t.h().onResponseDone('r1', 'completed')
    expect(closingSent(t.sent)).toHaveLength(1)
  })

  it('학생 말 뒤 자동 응답이 없으면 잠시 뒤 보낸다', async () => {
    const t = setup({ maxSeconds: 30 })
    await t.call.start()
    t.h().onOpen()
    t.h().onSpeechStarted('i1')
    await vi.advanceTimersByTimeAsync(11_000)
    t.h().onSpeechStopped('i1')
    expect(closingSent(t.sent)).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1_600)
    expect(closingSent(t.sent)).toHaveLength(1)
  })

  it('학생이 직접 끊으면 마무리 없이 바로 끝', async () => {
    const t = setup({ maxSeconds: 30 })
    await t.call.start()
    t.h().onOpen()
    await t.call.finish('user')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(closingSent(t.sent)).toHaveLength(0)
    expect(t.end).toHaveBeenCalledTimes(1)
  })
})
