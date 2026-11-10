import type { FlushPayload, FlushResult, FlushSegment } from './flushApi'

// 청취 추적(03 §3.1 클라이언트 규칙, TRK-01~03) — 이 앱의 핵심.
// React와 떼어 둔 클래스: 미디어 이벤트·타이머·전송 함수만 알고, 화면은 모른다(useListeningTracker가 붙인다).
//
// - playing에서 구간 시작, timeupdate로 끝 갱신
// - seeking이 없었으면 재생은 이어진 것: 멈춘 자리(또는 play를 누른 자리)보다 RESUME_SLACK_MS 안쪽 앞에서 playing이
//   오면 그 자리부터 연다. 브라우저는 다시 재생할 때 play·playing의 currentTime이 멈춘 자리보다 40~110ms 앞서 있어
//   (Chrome 11/9 실측) 그대로 열면 멈출 때마다 진행 바·서버 기록에 틈이 남는다
// - seeking → 지금 구간을 닫고, 새 위치에서 새 구간(건너뛴 곳은 들은 것이 아니다)
// - 10초마다 또는 닫힌 구간 5개 → fetch flush(헤더 X-CSRF). 한 요청에 최대 MAX_SEGMENTS_PER_FLUSH개(서버는 50개 넘게 받으면 버린다)
// - 실패: 다시 보내도 같은 것(400·403·404 등)은 버리고 기록, 네트워크·5xx·429는 남겨 다음에 다시
// - 화면이 보이는 끝(pause·ended): finalVia 'fetch'면 fetch(keepalive, final:true)로 보내 응답을 받는다(실패하면 남겨 다시).
//   화면 숨김·pagehide·떼기(stop): sendBeacon(final:true, 바디 csrf) — 응답은 못 받는다
// - beacon으로 보낸 구간은 메모리에 남겼다가 다음 fetch에 다시 싣는다 — 화면이 꺼진 채 오래 들으면
//   access가 만료돼 beacon이 401로 버려질 수 있다(BE #20 권장). 같은 구간은 서버가 거른다. 저장소에는 두지 않는다
// - ratechange → 0.8·1.0·1.2(PLAYBACK_RATES)만 허용, 그 밖이면 마지막 허용 속도로 되돌린다(ADR-27, docs/adr/0001).
//   currentTime은 음원 시간이라 속도와 무관 — 구간·서버 기록은 그대로
// - clientSessionId는 재생을 시작할 때 발급하고, ended 순간 끝낸다 — 다시 재생하면 새 세션(한 번 재생 = 세션 하나)
// - 구간은 자기 세션과 함께 쌓는다: 세션이 바뀌어도 늦게 보내는 구간이 엉뚱한 세션으로 가지 않는다
// 같은 구간이 두 번 가도 서버가 병합하므로(멱등) 잃어버리는 쪽보다 겹쳐 보내는 쪽을 고른다

export type { FlushPayload, FlushResult, FlushSegment }

export interface MediaLike extends EventTarget {
  currentTime: number
  playbackRate: number
  paused: boolean
  readonly ended: boolean
}

export type TrackerDeps = {
  /** fetch flush(X-CSRF 헤더). 실패하면 reject */
  send: (payload: FlushPayload, options: { keepalive: boolean }) => Promise<FlushResult>
  /** navigator.sendBeacon(바디 csrf). 브라우저가 큐에 넣지 못하면 false */
  beacon: (payload: FlushPayload) => boolean
  onResult?: (result: FlushResult) => void
  /** 화면이 보이는 끝(pause·ended)을 무엇으로 보낼지. 기본 'beacon'(명세), 앱은 'fetch' */
  finalVia?: 'beacon' | 'fetch'
  /** 다시 보내도 같은 실패인지(그러면 버린다). 기본: 모두 다시 보낸다 */
  isPermanent?: (error: unknown) => boolean
  /** 구간을 보내지 못하고 버릴 때(기록용) */
  onDiscard?: (reason: unknown, segments: number) => void
  newId?: () => string
  now?: () => Date
  userAgent?: string
}

/** 재생 속도(playbackRate) — 이 셋만 허용. 몇 배속이든 다 들으면 완료(서버, ADR-27) */
export const PLAYBACK_RATES = [0.8, 1, 1.2] as const
export type PlaybackRate = (typeof PLAYBACK_RATES)[number]

export function isPlaybackRate(value: number): value is PlaybackRate {
  return (PLAYBACK_RATES as readonly number[]).includes(value)
}

/** 서버는 60초보다 긴 구간을 버린다(03 §3.1) — 백그라운드에서 타이머가 늦어져도 이보다 길게 보내지 않는다 */
export const MAX_SEGMENT_MS = 60_000
/** 서버는 한 요청에 50개까지 받는다(03 §3.1) — 여유를 두고 40개씩 */
export const MAX_SEGMENTS_PER_FLUSH = 40
/** seeking 없이 다시 재생할 때 멈춘 자리부터 이어 붙이는 최대 차이 — 실측 40~110ms의 넉넉한 위쪽 */
const RESUME_SLACK_MS = 1_000
const FLUSH_INTERVAL_MS = 10_000
const FLUSH_AT_SEGMENTS = 5

type Session = { id: string; startedAt: string; userAgentSent: boolean }
type Queued = { session: Session; segment: FlushSegment }
type Open = { startMs: number; endMs: number }

export class ListeningTracker {
  private readonly media: MediaLike
  private readonly trackId: number
  private readonly deps: TrackerDeps
  private session: Session | null = null
  private open: Open | null = null
  private buffer: Queued[] = []
  private inFlight: Queued[] = []
  /** beacon으로 보냈지만 서버에 닿았는지 모르는 구간 — 다음 fetch에 다시 싣는다 */
  private unconfirmed: Queued[] = []
  private listened: Array<[number, number]> = []
  private timer: ReturnType<typeof setInterval> | undefined
  private started = false
  /** seeking 없이 다시 재생하면 이어 붙일 자리(멈춘 자리·play를 누른 자리). seeking·ended면 버린다 */
  private resumeAtMs: number | null = null
  /** 마지막으로 허용한 재생 속도 — 허용 밖으로 바뀌면 여기로 되돌린다 */
  private rate: PlaybackRate = 1

  constructor(media: MediaLike, trackId: number, deps: TrackerDeps) {
    this.media = media
    this.trackId = trackId
    this.deps = deps
  }

  start(): void {
    if (this.started) return
    this.started = true
    if (isPlaybackRate(this.media.playbackRate)) this.rate = this.media.playbackRate
    this.media.addEventListener('play', this.onPlay)
    this.media.addEventListener('playing', this.onPlaying)
    this.media.addEventListener('timeupdate', this.onTimeUpdate)
    this.media.addEventListener('seeking', this.onSeeking)
    this.media.addEventListener('pause', this.onPause)
    this.media.addEventListener('ended', this.onEnded)
    this.media.addEventListener('ratechange', this.onRateChange)
    document.addEventListener('visibilitychange', this.onVisibility)
    window.addEventListener('pagehide', this.onPageHide)
    this.timer = setInterval(this.onTick, FLUSH_INTERVAL_MS)
  }

  /** 리스너·타이머를 떼고 남은 구간을 sendBeacon으로 보낸다(트랙이 바뀌거나 화면을 떠날 때) */
  stop(): void {
    if (!this.started) return
    this.started = false
    this.media.removeEventListener('play', this.onPlay)
    this.media.removeEventListener('playing', this.onPlaying)
    this.media.removeEventListener('timeupdate', this.onTimeUpdate)
    this.media.removeEventListener('seeking', this.onSeeking)
    this.media.removeEventListener('pause', this.onPause)
    this.media.removeEventListener('ended', this.onEnded)
    this.media.removeEventListener('ratechange', this.onRateChange)
    document.removeEventListener('visibilitychange', this.onVisibility)
    window.removeEventListener('pagehide', this.onPageHide)
    clearInterval(this.timer)
    this.close()
    // 떼어 낸 뒤에는 다시 보낼 기회가 없다 — 큐에 못 넣으면 기록만 남긴다
    const left = this.beaconAll()
    if (left > 0) {
      this.buffer = []
      this.deps.onDiscard?.('beacon-rejected', left)
    }
  }

  /** 이 화면에서 들은 구간(합친 것) — 진행 바는 이것만 채운다 */
  listenedRanges(): Array<[number, number]> {
    const all = [...this.listened]
    if (this.open && this.open.endMs > this.open.startMs)
      all.push([this.open.startMs, this.open.endMs])
    return mergeRanges(all)
  }

  // ── 미디어 이벤트 ──

  private onPlay = () => {
    if (this.resumeAtMs === null) this.resumeAtMs = this.positionMs()
  }

  private onPlaying = () => {
    if (this.session === null) {
      this.session = {
        id: this.newId(),
        startedAt: this.now().toISOString(),
        userAgentSent: false,
      }
    }
    const at = this.positionMs()
    const from = this.resumeAtMs
    this.resumeAtMs = null
    // 뒤로 갔거나 많이 앞서 있으면 이어진 재생이 아니다 — 지금 자리부터
    const continued = from !== null && at >= from && at - from <= RESUME_SLACK_MS
    if (this.open === null) this.openAt(continued ? from : at)
  }

  private onTimeUpdate = () => {
    const at = this.positionMs()
    if (this.open === null) {
      // seek 뒤·화면 숨김 뒤 계속 재생 중이면 새 위치에서 이어 기록
      if (!this.media.paused && this.session !== null) this.openAt(at)
      return
    }
    if (at > this.open.endMs) this.open.endMs = at
  }

  private onSeeking = () => {
    this.resumeAtMs = null
    this.close()
    this.flushIfFull()
  }

  private onPause = () => {
    // 끝까지 들으면 pause가 ended보다 먼저 온다 — ended가 처리하도록 둔다
    if (this.media.ended) return
    this.resumeAtMs = this.positionMs()
    this.close()
    if (this.deps.finalVia === 'fetch') void this.sendFinal()
    else this.beaconAll()
  }

  private onEnded = () => {
    this.resumeAtMs = null
    this.close()
    // 세션은 지금 끝낸다 — 전송 응답을 기다리는 사이 다시 재생하면 새 세션이어야 한다(한 번 재생 = 세션 하나)
    this.session = null
    if (this.deps.finalVia === 'fetch') void this.sendFinal()
    else this.beaconAll()
  }

  private onRateChange = () => {
    const next = this.media.playbackRate
    if (isPlaybackRate(next)) this.rate = next
    else this.media.playbackRate = this.rate
  }

  private onVisibility = () => {
    if (document.visibilityState !== 'hidden') return
    this.cutKeepingOpen()
    this.beaconAll()
  }

  private onPageHide = () => {
    this.cutKeepingOpen()
    this.beaconAll()
  }

  private onTick = () => {
    this.cutKeepingOpen()
    void this.flush()
  }

  // ── 구간 ──

  private openAt(ms: number) {
    this.open = { startMs: ms, endMs: ms }
  }

  /** 지금 구간을 닫는다(seek·pause·ended) */
  private close() {
    if (this.open === null) return
    this.pushSegment(this.open)
    this.open = null
  }

  /** 지금 구간을 잘라 보내되, 재생 중이면 같은 자리에서 이어 기록한다(타이머·화면 숨김) */
  private cutKeepingOpen() {
    if (this.open === null) return
    const { endMs } = this.open
    this.pushSegment(this.open)
    this.open = this.media.paused ? null : { startMs: endMs, endMs }
  }

  private pushSegment({ startMs, endMs }: Open) {
    const session = this.session
    if (endMs <= startMs || session === null) return
    this.listened.push([startMs, endMs])
    const recordedAt = this.now().toISOString()
    for (let from = startMs; from < endMs; from += MAX_SEGMENT_MS) {
      this.buffer.push({
        session,
        segment: { startMs: from, endMs: Math.min(from + MAX_SEGMENT_MS, endMs), recordedAt },
      })
    }
  }

  private flushIfFull() {
    if (this.buffer.length >= FLUSH_AT_SEGMENTS) void this.flush()
  }

  // ── 전송 ──

  /** 앞에서부터 같은 세션 구간을 최대 MAX_SEGMENTS_PER_FLUSH개 떼어 낸다 */
  private takeBatch(from: Queued[]): Queued[] {
    const first = from[0]
    if (first === undefined) return []
    let count = 0
    while (
      count < from.length &&
      count < MAX_SEGMENTS_PER_FLUSH &&
      from[count].session === first.session
    ) {
      count++
    }
    return from.splice(0, count)
  }

  private payload(items: Queued[], final: boolean): FlushPayload {
    const session = items[0].session
    const payload: FlushPayload = {
      clientSessionId: session.id,
      trackId: this.trackId,
      startedAt: session.startedAt,
      segments: items.map((item) => item.segment),
      final,
    }
    if (!session.userAgentSent && this.deps.userAgent !== undefined) {
      payload.userAgent = this.deps.userAgent
      session.userAgentSent = true
    }
    return payload
  }

  /** 주기 전송: 한 번에 한 묶음씩, 성공하면 남은 것을 이어서 */
  private async flush(): Promise<void> {
    if (this.inFlight.length > 0) return
    this.requeueUnconfirmed()
    const items = this.takeBatch(this.buffer)
    if (items.length === 0) return
    this.inFlight = items
    const kept = await this.trySend(items, false, false)
    this.inFlight = []
    if (kept) this.buffer.unshift(...items)
    else if (this.buffer.length > 0) await this.flush()
  }

  /** 화면이 보이는 끝: 남은 구간을 모두 keepalive fetch(final)로. 실패한 것은 남겨 다음에 다시 */
  private async sendFinal(): Promise<void> {
    this.requeueUnconfirmed()
    const queue = this.buffer.splice(0)
    const failed: Queued[] = []
    while (queue.length > 0) {
      const items = this.takeBatch(queue)
      if (await this.trySend(items, true, true)) failed.push(...items)
    }
    this.buffer.unshift(...failed)
  }

  /** 보낸다. 다시 보내야 하면 true(호출한 쪽이 남긴다), 성공했거나 버렸으면 false */
  private async trySend(items: Queued[], final: boolean, keepalive: boolean): Promise<boolean> {
    let result: FlushResult
    try {
      result = await this.deps.send(this.payload(items, final), { keepalive })
    } catch (error) {
      if (this.deps.isPermanent?.(error)) {
        this.deps.onDiscard?.(error, items.length)
        return false
      }
      return true
    }
    // 응답 처리(캐시 반영)의 오류는 전송 실패가 아니다 — 다시 보내지 않고, 다음 전송도 막지 않게 기록만
    try {
      this.deps.onResult?.(result)
    } catch (error) {
      console.error('[flush] 응답 처리 오류', error)
    }
    return false
  }

  /** 보내는 중인 것까지 실어 sendBeacon(final). 큐에 못 넣은 구간은 남기고 그 수를 돌려준다 */
  private beaconAll(): number {
    const pending = this.buffer.splice(0)
    const queue = [...this.inFlight, ...pending]
    let rejected = 0
    while (queue.length > 0) {
      const batch = this.takeBatch(queue)
      // 보내는 중이던 것은 그 fetch가 결과를 처리한다(실패하면 flush가 되돌린다)
      const own = batch.filter((item) => pending.includes(item))
      if (this.deps.beacon(this.payload(batch, true))) {
        this.unconfirmed.push(...own)
      } else {
        this.buffer.push(...own)
        rejected += own.length
      }
    }
    return rejected
  }

  /** beacon으로 보낸 구간을 fetch 큐 앞에 되돌린다(먼저 들은 것이 먼저) */
  private requeueUnconfirmed() {
    if (this.unconfirmed.length === 0) return
    this.buffer.unshift(...this.unconfirmed)
    this.unconfirmed = []
  }

  // ── 그 밖 ──

  private positionMs() {
    return Math.round(this.media.currentTime * 1000)
  }

  private now() {
    return this.deps.now?.() ?? new Date()
  }

  private newId() {
    return this.deps.newId?.() ?? crypto.randomUUID()
  }
}

/** 겹치거나 맞닿은 구간을 합친다 */
export function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }
  return merged
}
