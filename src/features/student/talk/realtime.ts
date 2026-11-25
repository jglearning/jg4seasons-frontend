// OpenAI Realtime에 브라우저가 직접 붙는 WebRTC 연결(1단계 — 임시 키 방식).
// 순서(공식 가이드 realtime-webrtc, 11/25 확인):
//   RTCPeerConnection → 원격 소리 트랙을 <audio>에 → 마이크 트랙 추가 → 데이터 채널 "oai-events"
//   → offer → POST {url}(Content-Type: application/sdp, Authorization: Bearer 임시 키) → 응답 SDP를 answer로
// 여기서는 이벤트를 이름 붙은 콜백으로 넘기기만 한다. 자막 속도·끼어들기·마무리는 talkCall.ts.
//   캐릭터 말   response.output_audio_transcript.delta(delta) / .done(transcript) — 시각 정보 없음
//               (문서: 모델도 글자와 소리를 정확히 맞출 정보가 없다)
//   캐릭터 소리 output_audio_buffer.started / stopped / cleared(WebRTC 전용, response_id만)
//   학생 말     input_audio_buffer.speech_started / speech_stopped(item_id),
//               conversation.item.input_audio_transcription.completed(item_id, transcript) — 서버가 받아쓰기를 켜야 온다
//   응답        response.created / response.done(status: completed · cancelled …)
//   사용량      response.done의 response.usage, 받아쓰기 .completed의 usage — 숫자 필드를 그대로 더한다
// 닫는 이벤트는 문서에 없다 — 마이크 트랙은 호출한 쪽이 멈추고, 여기서는 채널·연결을 닫는다.
// 임시 키는 이 함수 안에서 요청 헤더에만 쓰고 저장·로그하지 않는다

export const REALTIME_CALLS_URL = 'https://api.openai.com/v1/realtime/calls'

export type RealtimeHandlers = {
  /** 이벤트 채널이 열림 = 대화 시작(타이머 기준) */
  onOpen: () => void
  /** 우리가 닫지 않았는데 연결이 끊김 */
  onLost: () => void
  onResponseCreated: (responseId: string) => void
  onResponseDone: (responseId: string, status: string) => void
  /** 캐릭터 말 글자 조각(소리보다 먼저 온다) */
  onTextDelta: (responseId: string, delta: string) => void
  /** 캐릭터 말 한 마디의 전체 글자 */
  onTextDone: (responseId: string, transcript: string) => void
  onAudioStarted: (responseId: string) => void
  onAudioStopped: (responseId: string) => void
  /** 끼어들기 등으로 아직 안 나간 소리를 버림 */
  onAudioCleared: (responseId: string) => void
  onSpeechStarted: (itemId: string) => void
  onSpeechStopped: (itemId: string) => void
  onStudentText: (itemId: string, transcript: string) => void
}

export type RealtimeConnection = {
  close: () => void
  /** 데이터 채널로 이벤트를 보낸다(열려 있을 때만) */
  send: (event: Record<string, unknown>) => void
  /** 지금까지 받은 사용량 합(§D-3 usage) */
  usage: () => Record<string, unknown>
}

export type ConnectOptions = {
  clientSecret: string
  url?: string
  mic: MediaStream
  /** 원격 소리를 틀 요소 */
  audio: HTMLAudioElement
  handlers: RealtimeHandlers
  /** 테스트용 */
  createPeer?: () => RTCPeerConnection
  fetchFn?: typeof fetch
  now?: () => number
  log?: (message: string, data?: Record<string, unknown>) => void
}

type Usage = Record<string, unknown>

/** 숫자는 더하고 객체는 안으로 들어가 더한다(모양은 서비스에 따름 — 모르는 필드도 그대로) */
export function addUsage(target: Usage, source: unknown): void {
  if (typeof source !== 'object' || source === null) return
  for (const [key, value] of Object.entries(source as Usage)) {
    if (typeof value === 'number') {
      const prev = target[key]
      target[key] = (typeof prev === 'number' ? prev : 0) + value
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const prev = target[key]
      const child =
        typeof prev === 'object' && prev !== null ? (prev as Usage) : (target[key] = {} as Usage)
      addUsage(child as Usage, value)
    }
  }
}

const defaultLog = (message: string, data?: Record<string, unknown>) => {
  // 리허설 기록용(기획 §7 Before 수치). 화면에는 보이지 않는다
  console.info(`[talk] ${message}`, data ?? '')
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

export async function connectRealtime(options: ConnectOptions): Promise<RealtimeConnection> {
  const {
    clientSecret,
    url = REALTIME_CALLS_URL,
    mic,
    audio,
    handlers,
    createPeer = () => new RTCPeerConnection(),
    fetchFn = fetch,
    now = () => performance.now(),
    log = defaultLog,
  } = options

  const startedAt = now()
  const usage = { responses: {} as Usage, transcription: {} as Usage }
  let closedByUs = false
  let lostReported = false
  let firstSound = true
  /** 학생 말이 끝난 시각(다음 캐릭터 소리까지의 지연을 잰다) */
  let speechStoppedAt: number | undefined

  const pc = createPeer()
  const lost = () => {
    if (closedByUs || lostReported) return
    lostReported = true
    handlers.onLost()
  }

  pc.ontrack = (event) => {
    audio.srcObject = event.streams[0] ?? new MediaStream([event.track])
    // 마이크를 잡고 있는 페이지는 원격 스트림 자동 재생이 된다(WebKit). 막혀도 다음 트랙에서 다시
    void audio.play()?.catch(() => undefined)
  }
  for (const track of mic.getAudioTracks()) pc.addTrack(track, mic)

  const channel = pc.createDataChannel('oai-events')
  const send = (event: Record<string, unknown>) => {
    if (closedByUs || channel.readyState !== 'open') return
    channel.send(JSON.stringify(event))
  }
  channel.onopen = () => {
    log('이벤트 채널 열림', { ms: Math.round(now() - startedAt) })
    handlers.onOpen()
    // 캐릭터가 먼저 묻는다(기획 §1-7) — 무엇을 말할지는 서버가 넣은 세션 지시문에 있다
    send({ type: 'response.create' })
  }
  channel.onclose = lost
  channel.onmessage = (message: MessageEvent) => {
    let event: Record<string, unknown>
    try {
      event = JSON.parse(String(message.data)) as Record<string, unknown>
    } catch {
      return
    }
    const responseId = str(event.response_id)
    const itemId = str(event.item_id)
    switch (event.type) {
      case 'response.created': {
        const response = event.response as { id?: unknown } | undefined
        handlers.onResponseCreated(str(response?.id))
        break
      }
      case 'response.done': {
        const response = event.response as { id?: unknown; status?: unknown; usage?: unknown }
        addUsage(usage.responses, response?.usage)
        handlers.onResponseDone(str(response?.id), str(response?.status))
        break
      }
      case 'output_audio_buffer.started': {
        const at = now()
        if (firstSound) {
          firstSound = false
          log('연결 시작 → 캐릭터 첫 소리', { ms: Math.round(at - startedAt) })
        } else if (speechStoppedAt !== undefined) {
          log('학생 말 끝 → 캐릭터 소리 시작', { ms: Math.round(at - speechStoppedAt) })
        }
        speechStoppedAt = undefined
        handlers.onAudioStarted(responseId)
        break
      }
      case 'output_audio_buffer.stopped':
        handlers.onAudioStopped(responseId)
        break
      case 'output_audio_buffer.cleared':
        handlers.onAudioCleared(responseId)
        break
      case 'input_audio_buffer.speech_started':
        handlers.onSpeechStarted(itemId)
        break
      case 'input_audio_buffer.speech_stopped':
        speechStoppedAt = now()
        handlers.onSpeechStopped(itemId)
        break
      case 'response.output_audio_transcript.delta':
        handlers.onTextDelta(responseId, str(event.delta))
        break
      case 'response.output_audio_transcript.done':
        handlers.onTextDone(responseId, str(event.transcript))
        break
      case 'conversation.item.input_audio_transcription.completed':
        addUsage(usage.transcription, event.usage)
        handlers.onStudentText(itemId, str(event.transcript))
        break
      case 'error':
        log('모델 서비스 오류', { error: event.error })
        break
    }
  }
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') lost()
  }

  const close = () => {
    if (closedByUs) return
    closedByUs = true
    try {
      channel.close()
    } catch {
      // 이미 닫힘
    }
    pc.close()
    audio.srcObject = null
  }

  try {
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    const response = await fetchFn(url, {
      method: 'POST',
      body: offer.sdp,
      headers: { Authorization: `Bearer ${clientSecret}`, 'Content-Type': 'application/sdp' },
    })
    if (!response.ok) throw new Error(`realtime calls ${response.status}`)
    await pc.setRemoteDescription({ type: 'answer', sdp: await response.text() })
  } catch (error) {
    close()
    throw error
  }

  return {
    close,
    send,
    usage: () => {
      const result: Usage = {}
      if (Object.keys(usage.responses).length > 0) result.responses = usage.responses
      if (Object.keys(usage.transcription).length > 0) result.transcription = usage.transcription
      return result
    },
  }
}
