import type { RealtimeConnection, RealtimeHandlers } from './realtime'
import type { TalkEndBody, TalkEndReason, TalkRole, TalkSessionResult, TalkTurn } from './talkApi'

// 대화 한 번(세션 하나)의 진행 — 타이머·자막·마무리·종료. 화면(TalkPage)과 연결(realtime.ts) 사이.
//
// 자막(추가 지시 나-2, 11/25 밤)
// - 캐릭터 말 글자는 소리보다 먼저 오고 시각 정보가 없다(공식 문서) → 소리가 시작된 때부터
//   WORDS_PER_SECOND로 단어를 하나씩 푼다. 소리가 끝나면(output_audio_buffer.stopped) 남은 글자를 모두.
// - 끼어들기(학생 말 시작·소리 버림 cleared)면 그때까지 보여 준 데서 멈춘다. turns에도 거기까지만.
//   서버 쪽 대화 기록은 WebRTC에서 안 나간 소리를 버릴 때 함께 잘린다고 공식 가이드(realtime-conversations)에 있어
//   conversation.item.truncate는 보내지 않는다
// - 학생 말은 말이 끝난 자리(speech_stopped)에 줄 자리를 잡고, 받아쓰기 글자가 오면 채운다. 비어 오면 줄을 지운다
//
// 마무리(나-3): 남은 시간이 CLOSING_AT_SECONDS가 되면 closingInstruction을 한 번만 보낸다(response.create의
// response.instructions — 그 응답에만 세션 설정을 덮어쓴다, 공식 client-events). 응답은 한 번에 하나만 쓸 수 있어
// 학생이 말하는 중·응답이 도는 중·소리가 나는 중에는 기다린다. 그 응답의 소리가 끝나면 종료(timeout).
// 시간이 0이 됐는데 캐릭터가 말하는 중이면 기다리고, maxSeconds + GRACE_SECONDS에는 무조건 끊는다.
//
// 종료 네 경로(끝내기 user · 시간 종료 timeout · 화면 이탈 left · 연결 끊김 disconnected)는 모두 finish() 하나.
// finish()는 한 번만: 마이크 트랙 정지 → 연결 닫기 → 화면 꺼짐 방지 풀기 → §D-3 종료 요청 한 번.
// 타이머는 서버 maxSeconds, 이벤트 채널이 열린 때부터(연결 전 시간은 세지 않는다).
//
// 채널이 열리기 전(연결 단계)의 실패는 "연결 실패"다 — OPEN_TIMEOUT_MS 안에 안 열리거나 열리기 전에 끊기면
// 마이크를 끄고 연결을 닫되 종료 요청은 보내지 않는다(다시 시도에서 같은 세션). 화면은 whenOpen()으로 받는다.
// UDP를 막는 망에서는 ICE가 failed까지 오래 걸려 "연결하고 있어요"에 마이크가 켜진 채 머물 수 있어서(리뷰 11/25)

export type TalkPhase = 'connecting' | 'listening' | 'speaking' | 'ending' | 'ended'

export type CaptionLine = {
  /** 캐릭터는 response id, 학생은 item id */
  id: string
  role: TalkRole
  /** 화면에 보이는 글자(캐릭터는 지금까지 푼 단어) */
  text: string
  /** 받은 글자 전체(캐릭터 — 움직임 줄이기에서 문장 단위로 보일 때 쓴다) */
  full: string
  /** 더 늘지 않는 줄 */
  done: boolean
}

export type TalkSnapshot = {
  phase: TalkPhase
  /** 남은 초(연결 전에는 maxSeconds, 0 아래로 내려가지 않는다) */
  remaining: number
  /** 자막 줄(오래된 것부터). 학생 줄은 글자가 오기 전 text가 빈 채로 자리만 */
  lines: readonly CaptionLine[]
  /** 화면 낭독기에 한 번 알릴 마지막 캐릭터 줄(다 들린 줄, 또는 끼어들기로 멈춘 데까지). 학생 줄은 넣지 않는다 */
  announce: string
  /** 마무리 인사를 보냄 */
  closing: boolean
  result?: TalkSessionResult
  /** 종료 요청이 실패함(요약 없이 끝 화면) */
  endFailed?: boolean
}

export type TalkCallDeps = {
  sessionId: number
  maxSeconds: number
  mic: MediaStream
  /** 남은 시간이 CLOSING_AT_SECONDS일 때 모델에 보낼 마무리 지시(없으면 마무리 인사 없이 시간에 끝) */
  closingInstruction?: string
  connect: (handlers: RealtimeHandlers) => Promise<RealtimeConnection>
  end: (body: TalkEndBody, options: { keepalive: boolean }) => Promise<TalkSessionResult>
  onChange: (snapshot: TalkSnapshot) => void
  /** 화면 꺼짐 방지(지원하는 기기만). 풀 함수를 돌려준다 */
  holdScreen?: () => () => void
  now?: () => number
}

/** 화면이 이만큼 넘게 숨겨지면 끝낸다(left) */
export const HIDDEN_LIMIT_MS = 30_000
/** 마무리 지시를 보낼 남은 시간 */
export const CLOSING_AT_SECONDS = 20
/** 시간이 다 된 뒤 캐릭터 말을 기다리는 최대 시간 */
export const GRACE_SECONDS = 5
/** 자막을 푸는 속도(단어/초) — 시각 정보가 없어 추정. 실기기에서 맞춘다 */
export const WORDS_PER_SECOND = 2.5
/** 연결된 뒤 이벤트 채널이 열리기를 기다리는 최대 시간 — 넘으면 연결 실패 */
export const OPEN_TIMEOUT_MS = 15_000
/** 학생 말이 끝난 뒤 서버 자동 응답이 시작되지 않으면 마무리를 보내기까지 기다리는 시간 */
const CLOSING_AFTER_SPEECH_MS = 1_500
const TICK_MS = 100

type CharacterResponse = {
  received: string
  audioStartAt?: number
  audioEnded: boolean
  textDone: boolean
  frozen: boolean
}

/** 앞에서부터 단어 count개(뒤 공백 제외) */
export function firstWords(text: string, count: number): string {
  if (count <= 0) return ''
  const words = text.match(/\S+\s*/g) ?? []
  return words.slice(0, count).join('').trimEnd()
}

export class TalkCall {
  private snapshot: TalkSnapshot
  private connection: RealtimeConnection | undefined
  private connectedAt: number | undefined
  private finished = false
  private tick: ReturnType<typeof setInterval> | undefined
  private hiddenTimer: ReturnType<typeof setTimeout> | undefined
  private closingTimer: ReturnType<typeof setTimeout> | undefined
  private openTimer: ReturnType<typeof setTimeout> | undefined
  /** 채널이 열렸는지(open) · 열리기 전에 실패했는지(failed) — whenOpen()이 기다리는 값 */
  private openState: { kind: 'waiting' } | { kind: 'open' } | { kind: 'failed'; error: Error } = {
    kind: 'waiting',
  }
  private readonly openWaiters: Array<() => void> = []
  private releaseScreen: (() => void) | undefined
  private readonly now: () => number
  private readonly deps: TalkCallDeps

  private readonly responses = new Map<string, CharacterResponse>()
  /** 소리가 나는 중인 캐릭터 응답 */
  private playing: string | undefined
  /** 서버에서 도는 중인 응답 */
  private activeResponse: string | undefined
  private studentSpeaking = false
  private closingWanted = false
  private closingSent = false
  private closingResponseId: string | undefined

  constructor(deps: TalkCallDeps) {
    this.deps = deps
    this.now = deps.now ?? (() => Date.now())
    this.snapshot = {
      phase: 'connecting',
      remaining: deps.maxSeconds,
      lines: [],
      announce: '',
      closing: false,
    }
  }

  get state(): TalkSnapshot {
    return this.snapshot
  }

  /** 연결을 시작한다. 연결에 실패하면 정리한 뒤 던진다(종료 요청은 보내지 않는다 — 다시 시도에서 같은 세션) */
  async start(): Promise<void> {
    const guard =
      <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        if (!this.finished) fn(...args)
      }
    try {
      const connection = await this.deps.connect({
        onOpen: guard(() => this.opened()),
        // 채널이 열리기 전 끊김은 연결 실패, 열린 뒤 끊김은 대화 종료
        onLost: () =>
          this.connectedAt === undefined
            ? this.failOpen(new Error('채널이 열리기 전에 끊김'))
            : void this.finish('disconnected'),
        onResponseCreated: guard((id) => this.responseCreated(id)),
        onResponseDone: guard((id) => this.responseDone(id)),
        onTextDelta: guard((id, delta) => this.textDelta(id, delta)),
        onTextDone: guard((id, transcript) => this.textDone(id, transcript)),
        onAudioStarted: guard((id) => this.audioStarted(id)),
        onAudioStopped: guard((id) => this.audioStopped(id)),
        onAudioCleared: guard((id) => this.freeze(id)),
        onSpeechStarted: guard(() => this.speechStarted()),
        onSpeechStopped: guard((itemId) => this.speechStopped(itemId)),
        onStudentText: guard((itemId, text) => this.studentText(itemId, text)),
      })
      if (this.finished) {
        connection.close()
        return
      }
      this.connection = connection
      if (this.openState.kind === 'waiting')
        this.openTimer = setTimeout(
          () => this.failOpen(new Error('채널이 열리지 않음')),
          OPEN_TIMEOUT_MS,
        )
    } catch (error) {
      this.stopMic()
      throw error
    }
  }

  /** 이벤트 채널이 열리면 끝나고, 열리기 전에 실패하면(기한 초과·끊김) 던진다 */
  whenOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      const settle = () => {
        if (this.openState.kind === 'open') resolve()
        else if (this.openState.kind === 'failed') reject(this.openState.error)
        else this.openWaiters.push(settle)
      }
      settle()
    })
  }

  /** 연결 단계 실패 — 마이크·연결을 정리하고 종료 요청은 보내지 않는다(같은 세션으로 다시 시도) */
  private failOpen(error: Error) {
    if (this.finished || this.openState.kind !== 'waiting') return
    this.finished = true
    clearTimeout(this.openTimer)
    this.stopMic()
    this.connection?.close()
    this.openState = { kind: 'failed', error }
    this.openWaiters.splice(0).forEach((settle) => settle())
  }

  /** 화면이 숨겨짐/다시 보임 — 30초 넘게 숨겨지면 끝낸다 */
  visibilityChanged(hidden: boolean): void {
    if (this.finished) return
    if (hidden) {
      if (this.hiddenTimer === undefined)
        this.hiddenTimer = setTimeout(
          () => void this.finish('left', { keepalive: true }),
          HIDDEN_LIMIT_MS,
        )
    } else {
      clearTimeout(this.hiddenTimer)
      this.hiddenTimer = undefined
      // 화면이 숨겨지면 화면 꺼짐 방지가 저절로 풀린다 — 다시 건다
      if (this.connectedAt !== undefined && this.deps.holdScreen) {
        this.releaseScreen?.()
        this.releaseScreen = this.deps.holdScreen()
      }
    }
  }

  /** 정리 함수 — 몇 번 불려도 한 번만 돈다 */
  async finish(reason: TalkEndReason, { keepalive = false } = {}): Promise<void> {
    if (this.finished) return
    // 말하던 캐릭터 줄은 들린 데까지만 남긴다
    if (this.playing !== undefined) this.freeze(this.playing)
    this.finished = true
    clearInterval(this.tick)
    clearTimeout(this.hiddenTimer)
    clearTimeout(this.closingTimer)
    clearTimeout(this.openTimer)
    // 연결 단계에서 끝냈으면 whenOpen()을 기다리는 쪽도 풀어 준다(화면은 phase로 연결 실패와 가른다)
    if (this.openState.kind === 'waiting') {
      this.openState = { kind: 'failed', error: new Error('연결 전에 끝냄') }
      this.openWaiters.splice(0).forEach((settle) => settle())
    }
    this.stopMic()
    this.connection?.close()
    this.releaseScreen?.()
    this.releaseScreen = undefined

    const usage = this.connection?.usage()
    const turns: TalkTurn[] = this.snapshot.lines
      .filter((line) => line.text.trim() !== '')
      .map((line) => ({ role: line.role, text: line.text }))
    const body: TalkEndBody = {
      durationSec: this.elapsedSec(),
      endReason: reason,
      turns,
      ...(usage && Object.keys(usage).length > 0 ? { usage } : {}),
    }
    this.update({ phase: 'ending' })
    try {
      const result = await this.deps.end(body, { keepalive })
      this.update({ phase: 'ended', result })
    } catch (error) {
      // 화면은 요약 없는 끝 화면. 대화 시간·사용량 기록이 빠지므로 원인은 남긴다(발화 글자는 찍지 않는다)
      const problem = error as { status?: number; code?: string; requestId?: string; name?: string }
      console.error('[talk] 종료 기록 실패', {
        sessionId: this.deps.sessionId,
        endReason: reason,
        status: problem.status,
        code: problem.code,
        requestId: problem.requestId,
        name: problem.name,
      })
      this.update({ phase: 'ended', endFailed: true })
    }
  }

  // ── 연결·타이머 ──

  private opened() {
    if (this.connectedAt !== undefined || this.openState.kind !== 'waiting') return
    clearTimeout(this.openTimer)
    this.openState = { kind: 'open' }
    this.openWaiters.splice(0).forEach((settle) => settle())
    this.connectedAt = this.now()
    this.releaseScreen = this.deps.holdScreen?.()
    this.update({ phase: 'listening' })
    this.tick = setInterval(() => this.onTick(), TICK_MS)
  }

  private onTick() {
    if (this.finished) return
    const elapsed = this.elapsedRaw()
    const max = this.deps.maxSeconds
    const remaining = Math.max(0, max - Math.floor(elapsed))
    const patch: Partial<TalkSnapshot> = {}
    if (remaining !== this.snapshot.remaining) patch.remaining = remaining
    const lines = this.paced()
    if (lines) patch.lines = lines
    if (Object.keys(patch).length > 0) this.update(patch)

    if (remaining <= CLOSING_AT_SECONDS && !this.closingWanted && this.deps.closingInstruction) {
      this.closingWanted = true
      this.trySendClosing()
    }
    if (elapsed >= max + GRACE_SECONDS) {
      void this.finish('timeout')
    } else if (elapsed >= max && !this.characterTalking()) {
      void this.finish('timeout')
    }
  }

  /** 캐릭터가 말하는 중(소리가 나는 중, 또는 마무리 응답이 만들어지는 중) */
  private characterTalking(): boolean {
    return (
      this.playing !== undefined ||
      (this.closingResponseId !== undefined && this.activeResponse === this.closingResponseId)
    )
  }

  private elapsedRaw(): number {
    if (this.connectedAt === undefined) return 0
    return Math.max(0, (this.now() - this.connectedAt) / 1000)
  }

  private elapsedSec(): number {
    return Math.min(this.deps.maxSeconds, Math.floor(this.elapsedRaw()))
  }

  // ── 캐릭터 말 ──

  private response(id: string): CharacterResponse {
    let response = this.responses.get(id)
    if (!response) {
      response = { received: '', audioEnded: false, textDone: false, frozen: false }
      this.responses.set(id, response)
    }
    return response
  }

  private responseCreated(id: string) {
    this.activeResponse = id
    if (this.closingSent && this.closingResponseId === undefined) this.closingResponseId = id
  }

  private responseDone(id: string) {
    if (this.activeResponse === id) this.activeResponse = undefined
    this.trySendClosing()
  }

  private textDelta(id: string, delta: string) {
    const response = this.response(id)
    if (response.frozen || response.textDone) return
    response.received += delta
    this.refreshLine(id)
  }

  private textDone(id: string, transcript: string) {
    const response = this.response(id)
    if (response.frozen) return
    response.received = transcript
    response.textDone = true
    this.refreshLine(id)
  }

  private audioStarted(id: string) {
    const response = this.response(id)
    if (response.frozen) return
    response.audioStartAt = this.now()
    this.playing = id
    if (!this.snapshot.lines.some((line) => line.id === id)) {
      this.update({
        phase: 'speaking',
        lines: [
          ...this.snapshot.lines,
          { id, role: 'character', text: '', full: response.received, done: false },
        ],
      })
    } else {
      this.update({ phase: 'speaking' })
    }
    this.refreshLine(id)
  }

  private audioStopped(id: string) {
    const response = this.response(id)
    if (this.playing === id) this.playing = undefined
    if (!response.frozen) {
      response.audioEnded = true
      this.refreshLine(id)
    }
    this.update({ phase: 'listening' })
    if (id === this.closingResponseId) {
      void this.finish('timeout')
      return
    }
    this.trySendClosing()
  }

  /** 끼어들기 — 그때까지 보여 준 데서 멈춘다 */
  private freeze(id: string) {
    const response = this.response(id)
    if (this.playing === id) this.playing = undefined
    if (response.frozen) return
    response.frozen = true
    const line = this.snapshot.lines.find((item) => item.id === id)
    if (!line) return
    const lines =
      line.text === ''
        ? this.snapshot.lines.filter((item) => item.id !== id)
        : this.snapshot.lines.map((item) =>
            item.id === id ? { ...item, full: item.text, done: true } : item,
          )
    this.update({
      lines,
      phase: this.finished ? this.snapshot.phase : 'listening',
      announce: line.text === '' ? this.snapshot.announce : line.text,
    })
  }

  /** 소리가 난 시간만큼 단어를 푼 글자 */
  private revealed(response: CharacterResponse): string {
    if (response.audioEnded) return response.received.trim()
    if (response.audioStartAt === undefined) return ''
    const seconds = (this.now() - response.audioStartAt) / 1000
    return firstWords(response.received, Math.floor(seconds * WORDS_PER_SECOND) + 1)
  }

  private lineFor(line: CaptionLine): CaptionLine {
    const response = this.responses.get(line.id)
    if (line.role !== 'character' || !response || response.frozen) return line
    const text = this.revealed(response)
    const done = response.audioEnded && response.textDone
    return { ...line, text, full: response.received.trim(), done }
  }

  private refreshLine(id: string) {
    const index = this.snapshot.lines.findIndex((line) => line.id === id)
    if (index < 0) return
    const before = this.snapshot.lines[index]
    const after = this.lineFor(before)
    if (after.text === before.text && after.full === before.full && after.done === before.done)
      return
    const lines = [...this.snapshot.lines]
    lines[index] = after
    this.update({
      lines,
      announce: after.done && !before.done ? after.text : this.snapshot.announce,
    })
  }

  /** 틱마다: 말하는 중인 줄의 단어를 더 푼다. 바뀐 게 없으면 undefined */
  private paced(): CaptionLine[] | undefined {
    if (this.playing === undefined) return undefined
    const lines = this.snapshot.lines.map((line) =>
      line.id === this.playing ? this.lineFor(line) : line,
    )
    const changed = lines.some((line, i) => line.text !== this.snapshot.lines[i].text)
    return changed ? lines : undefined
  }

  // ── 학생 말 ──

  private speechStarted() {
    this.studentSpeaking = true
    clearTimeout(this.closingTimer)
    // 학생이 끼어들면 캐릭터 소리는 서버가 끊는다(VAD interrupt_response) — 자막도 여기서 멈춘다
    if (this.playing !== undefined) this.freeze(this.playing)
  }

  private speechStopped(itemId: string) {
    this.studentSpeaking = false
    if (itemId !== '' && !this.snapshot.lines.some((line) => line.id === itemId)) {
      this.update({
        lines: [
          ...this.snapshot.lines,
          { id: itemId, role: 'student', text: '', full: '', done: false },
        ],
      })
    }
    // 서버가 곧 자동 응답을 만든다 — 그 응답이 시작되지 않으면 잠시 뒤 마무리를 보낸다
    clearTimeout(this.closingTimer)
    this.closingTimer = setTimeout(() => this.trySendClosing(), CLOSING_AFTER_SPEECH_MS)
  }

  private studentText(itemId: string, transcript: string) {
    const text = transcript.trim()
    const exists = this.snapshot.lines.some((line) => line.id === itemId)
    if (text === '') {
      if (exists) this.update({ lines: this.snapshot.lines.filter((line) => line.id !== itemId) })
      return
    }
    const line: CaptionLine = { id: itemId, role: 'student', text, full: text, done: true }
    this.update({
      lines: exists
        ? this.snapshot.lines.map((item) => (item.id === itemId ? line : item))
        : [...this.snapshot.lines, line],
    })
  }

  // ── 마무리 ──

  private trySendClosing() {
    if (!this.closingWanted || this.closingSent || this.finished) return
    if (this.studentSpeaking || this.activeResponse !== undefined || this.playing !== undefined)
      return
    const instructions = this.deps.closingInstruction
    if (!instructions || !this.connection) return
    clearTimeout(this.closingTimer)
    this.closingSent = true
    this.connection.send({ type: 'response.create', response: { instructions } })
    this.update({ closing: true })
  }

  private stopMic() {
    for (const track of this.deps.mic.getTracks()) track.stop()
  }

  private update(patch: Partial<TalkSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.deps.onChange(this.snapshot)
  }
}
