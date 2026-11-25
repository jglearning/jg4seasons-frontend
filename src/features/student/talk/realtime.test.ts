import { describe, expect, it, vi } from 'vitest'
import { addUsage, connectRealtime, REALTIME_CALLS_URL, type RealtimeHandlers } from './realtime'

// WebRTC 연결 순서와 이벤트 해석 — RTCPeerConnection은 가짜 객체(jsdom에 없다). 실제 연결은 브라우저에서 확인

class FakeChannel {
  readyState = 'open'
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  sent: string[] = []
  send(data: string) {
    this.sent.push(data)
  }
  close = vi.fn(() => {
    this.readyState = 'closed'
  })
  emit(event: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(event) } as MessageEvent)
  }
}

class FakePeer {
  channel = new FakeChannel()
  channelName = ''
  tracks: unknown[] = []
  remote: RTCSessionDescriptionInit | undefined
  connectionState = 'new'
  ontrack: ((event: RTCTrackEvent) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  addTrack(track: unknown) {
    this.tracks.push(track)
  }
  createDataChannel(name: string) {
    this.channelName = name
    return this.channel
  }
  createOffer() {
    return Promise.resolve({ type: 'offer', sdp: 'v=0 offer' })
  }
  setLocalDescription() {
    return Promise.resolve()
  }
  setRemoteDescription(description: RTCSessionDescriptionInit) {
    this.remote = description
    return Promise.resolve()
  }
  close = vi.fn()
}

function handlers() {
  return {
    onOpen: vi.fn<RealtimeHandlers['onOpen']>(),
    onLost: vi.fn<RealtimeHandlers['onLost']>(),
    onResponseCreated: vi.fn<RealtimeHandlers['onResponseCreated']>(),
    onResponseDone: vi.fn<RealtimeHandlers['onResponseDone']>(),
    onTextDelta: vi.fn<RealtimeHandlers['onTextDelta']>(),
    onTextDone: vi.fn<RealtimeHandlers['onTextDone']>(),
    onAudioStarted: vi.fn<RealtimeHandlers['onAudioStarted']>(),
    onAudioStopped: vi.fn<RealtimeHandlers['onAudioStopped']>(),
    onAudioCleared: vi.fn<RealtimeHandlers['onAudioCleared']>(),
    onSpeechStarted: vi.fn<RealtimeHandlers['onSpeechStarted']>(),
    onSpeechStopped: vi.fn<RealtimeHandlers['onSpeechStopped']>(),
    onStudentText: vi.fn<RealtimeHandlers['onStudentText']>(),
  }
}

async function connect(fetchFn = vi.fn(() => Promise.resolve(new Response('v=0 answer')))) {
  const peer = new FakePeer()
  const h = handlers()
  const track = { kind: 'audio' }
  const mic = { getAudioTracks: () => [track] } as unknown as MediaStream
  const audio = { srcObject: null, play: () => Promise.resolve() } as unknown as HTMLAudioElement
  const log = vi.fn()
  const connection = await connectRealtime({
    clientSecret: 'ek_test',
    mic,
    audio,
    handlers: h,
    createPeer: () => peer as unknown as RTCPeerConnection,
    fetchFn: fetchFn as unknown as typeof fetch,
    log,
  })
  return { peer, h, track, audio, fetchFn, connection, log }
}

describe('connectRealtime', () => {
  it('마이크 트랙 · oai-events 채널 · offer를 calls로 보내고 응답을 answer로', async () => {
    const { peer, track, fetchFn } = await connect()
    expect(peer.tracks).toEqual([track])
    expect(peer.channelName).toBe('oai-events')
    expect(fetchFn).toHaveBeenCalledWith(REALTIME_CALLS_URL, {
      method: 'POST',
      body: 'v=0 offer',
      headers: { Authorization: 'Bearer ek_test', 'Content-Type': 'application/sdp' },
    })
    expect(peer.remote).toEqual({ type: 'answer', sdp: 'v=0 answer' })
  })

  it('채널이 열리면 시작을 알리고 캐릭터가 먼저 말하게 response.create', async () => {
    const { peer, h } = await connect()
    peer.channel.onopen?.()
    expect(h.onOpen).toHaveBeenCalled()
    expect(peer.channel.sent.map((s) => JSON.parse(s))).toEqual([{ type: 'response.create' }])
  })

  it('이벤트를 이름 붙은 콜백으로, 사용량은 합산', async () => {
    const { peer, h, connection } = await connect()
    const ch = peer.channel
    ch.emit({ type: 'response.created', response: { id: 'r1' } })
    ch.emit({ type: 'output_audio_buffer.started', response_id: 'r1' })
    ch.emit({ type: 'response.output_audio_transcript.delta', response_id: 'r1', delta: 'Hi' })
    ch.emit({
      type: 'response.output_audio_transcript.done',
      response_id: 'r1',
      transcript: 'Hi there!',
    })
    ch.emit({ type: 'output_audio_buffer.stopped', response_id: 'r1' })
    ch.emit({ type: 'output_audio_buffer.cleared', response_id: 'r2' })
    ch.emit({ type: 'input_audio_buffer.speech_started', item_id: 'i1' })
    ch.emit({ type: 'input_audio_buffer.speech_stopped', item_id: 'i1' })
    ch.emit({
      type: 'conversation.item.input_audio_transcription.completed',
      item_id: 'i1',
      transcript: 'I play soccer.',
      usage: { total_tokens: 5, input_token_details: { audio_tokens: 4 } },
    })
    ch.emit({
      type: 'response.done',
      response: { id: 'r1', status: 'completed', usage: { total_tokens: 100, output_tokens: 60 } },
    })
    ch.emit({
      type: 'response.done',
      response: { id: 'r2', status: 'cancelled', usage: { total_tokens: 50, output_tokens: 20 } },
    })

    expect(h.onResponseCreated).toHaveBeenCalledWith('r1')
    expect(h.onAudioStarted).toHaveBeenCalledWith('r1')
    expect(h.onTextDelta).toHaveBeenCalledWith('r1', 'Hi')
    expect(h.onTextDone).toHaveBeenCalledWith('r1', 'Hi there!')
    expect(h.onAudioStopped).toHaveBeenCalledWith('r1')
    expect(h.onAudioCleared).toHaveBeenCalledWith('r2')
    expect(h.onSpeechStarted).toHaveBeenCalledWith('i1')
    expect(h.onSpeechStopped).toHaveBeenCalledWith('i1')
    expect(h.onStudentText).toHaveBeenCalledWith('i1', 'I play soccer.')
    expect(h.onResponseDone.mock.calls).toEqual([
      ['r1', 'completed'],
      ['r2', 'cancelled'],
    ])
    expect(connection.usage()).toEqual({
      responses: { total_tokens: 150, output_tokens: 80 },
      transcription: { total_tokens: 5, input_token_details: { audio_tokens: 4 } },
    })
  })

  it('send: 열린 채널로만, 닫은 뒤에는 보내지 않는다', async () => {
    const { peer, connection } = await connect()
    connection.send({ type: 'response.create', response: { instructions: 'Bye' } })
    connection.close()
    connection.send({ type: 'response.create' })
    expect(peer.channel.sent.map((s) => JSON.parse(s))).toEqual([
      { type: 'response.create', response: { instructions: 'Bye' } },
    ])
  })

  it('우리가 닫으면 끊김을 알리지 않고, 저쪽에서 끊기면 한 번 알린다', async () => {
    const first = await connect()
    first.connection.close()
    first.peer.channel.onclose?.()
    expect(first.h.onLost).not.toHaveBeenCalled()
    expect(first.peer.close).toHaveBeenCalled()
    expect(first.audio.srcObject).toBeNull()

    const second = await connect()
    second.peer.connectionState = 'failed'
    second.peer.onconnectionstatechange?.()
    second.peer.channel.onclose?.()
    expect(second.h.onLost).toHaveBeenCalledTimes(1)
  })

  it('SDP 요청이 실패하면 연결을 닫고 던진다', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(new Response('no', { status: 401 })))
    await expect(connect(fetchFn)).rejects.toThrow('realtime calls 401')
  })

  it('임시 키를 로그에 남기지 않는다', async () => {
    const { peer, log } = await connect()
    peer.channel.onopen?.()
    peer.channel.emit({ type: 'output_audio_buffer.started' })
    expect(JSON.stringify(log.mock.calls)).not.toContain('ek_test')
  })
})

describe('addUsage', () => {
  it('숫자는 더하고 객체는 안으로, 숫자 아닌 값은 건너뛴다', () => {
    const target: Record<string, unknown> = {}
    addUsage(target, { a: 1, b: { c: 2 }, s: 'x' })
    addUsage(target, { a: 2, b: { c: 3, d: 1 } })
    addUsage(target, undefined)
    expect(target).toEqual({ a: 3, b: { c: 5, d: 1 } })
  })
})
