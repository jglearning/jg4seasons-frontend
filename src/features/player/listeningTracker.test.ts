import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ListeningTracker,
  MAX_SEGMENT_MS,
  MAX_SEGMENTS_PER_FLUSH,
  type FlushPayload,
  type FlushResult,
  type MediaLike,
  type TrackerDeps,
} from './listeningTracker'

// 03 §3.1 클라이언트 규칙(TRK-01~03)을 오디오 없이 시험한다. 미디어는 이벤트만 흉내 낸 가짜 —
// 이벤트 순서는 브라우저와 같게: seek은 seeking → timeupdate → seeked, 끝은 pause → ended(ended=true)
class FakeMedia extends EventTarget implements MediaLike {
  currentTime = 0
  playbackRate = 1
  paused = true
  ended = false

  play(at = this.currentTime) {
    this.currentTime = at
    this.paused = false
    this.ended = false
    this.dispatchEvent(new Event('playing'))
  }

  advance(seconds: number) {
    this.currentTime += seconds
    this.dispatchEvent(new Event('timeupdate'))
  }

  seek(to: number) {
    this.dispatchEvent(new Event('seeking'))
    this.currentTime = to
    this.dispatchEvent(new Event('timeupdate'))
    this.dispatchEvent(new Event('seeked'))
  }

  pause() {
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  }

  end() {
    this.paused = true
    this.ended = true
    this.dispatchEvent(new Event('pause'))
    this.dispatchEvent(new Event('ended'))
  }
}

const RESULT: FlushResult = {
  track: { trackId: 9002, coverage: 0.3, completed: false },
  lesson: { code: 'L2-B1-05', status: 'in_progress', requiredDone: 3, requiredTotal: 6 },
  dropped: 0,
}

let media: FakeMedia
let sent: Array<FlushPayload & { keepalive: boolean }>
let beacons: FlushPayload[]
let send: ReturnType<typeof vi.fn<TrackerDeps['send']>>
let beacon: ReturnType<typeof vi.fn<TrackerDeps['beacon']>>
let ids: number
let trackers: ListeningTracker[] = []

function track(options: Partial<TrackerDeps> = {}) {
  const tracker = new ListeningTracker(media, 9002, {
    send,
    beacon,
    newId: () => `session-${++ids}`,
    userAgent: 'test-agent',
    ...options,
  })
  tracker.start()
  trackers.push(tracker)
  return tracker
}

const ranges = (payloads: FlushPayload[]) =>
  payloads.flatMap((p) => p.segments.map((s) => [s.startMs, s.endMs]))

/** 응답을 붙잡아 두는 send — 풀어 줄 함수를 돌려준다 */
function holdNextSend() {
  let release: (result: FlushResult) => void = () => {}
  send.mockImplementationOnce((p, o) => {
    sent.push({ ...structuredClone(p), keepalive: o.keepalive })
    return new Promise((resolve) => (release = resolve))
  })
  return (result = RESULT) => release(result)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-12-19T10:00:00.000Z'))
  media = new FakeMedia()
  sent = []
  beacons = []
  ids = 0
  send = vi.fn((p: FlushPayload, o: { keepalive: boolean }) => {
    sent.push({ ...structuredClone(p), keepalive: o.keepalive })
    return Promise.resolve(RESULT)
  })
  beacon = vi.fn((p: FlushPayload) => {
    beacons.push(structuredClone(p))
    return true
  })
})

afterEach(() => {
  // document·window 리스너가 다음 테스트로 새지 않게
  for (const t of trackers) t.stop()
  trackers = []
  vi.useRealTimers()
})

describe('구간 기록(TRK-01)', () => {
  it('playing에서 시작해 timeupdate로 끝을 늘리고, 10초마다 fetch로 보낸다', async () => {
    track()
    media.play(0)
    media.advance(4)
    media.advance(4)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(sent).toHaveLength(1)
    expect(ranges(sent)).toEqual([[0, 8000]])
    expect(sent[0]).toMatchObject({
      clientSessionId: 'session-1',
      trackId: 9002,
      startedAt: '2026-12-19T10:00:00.000Z',
      userAgent: 'test-agent',
      final: false,
      keepalive: false,
    })
  })

  it('계속 듣는 중이면 10초마다 이어진 구간으로 잘라 보낸다(userAgent는 첫 전송만)', async () => {
    track()
    media.play(0)
    media.advance(9)
    await vi.advanceTimersByTimeAsync(10_000)
    media.advance(9)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(ranges(sent)).toEqual([
      [0, 9000],
      [9000, 18000],
    ])
    expect(sent[0].userAgent).toBe('test-agent')
    expect(sent[1].userAgent).toBeUndefined()
    expect(sent[1].clientSessionId).toBe('session-1')
  })

  it('보낼 것이 없으면 타이머가 돌아도 보내지 않는다', async () => {
    track()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(send).not.toHaveBeenCalled()
  })

  it('구간이 5개 쌓이면 10초를 기다리지 않고 보낸다', async () => {
    track()
    media.play(0)
    for (let i = 0; i < 5; i++) {
      media.advance(1)
      media.seek(i * 10 + 10)
    }
    await vi.advanceTimersByTimeAsync(0)

    expect(sent).toHaveLength(1)
    expect(sent[0].segments).toHaveLength(5)
  })

  it('한 구간은 60초를 넘지 않게 나눈다(백그라운드에서 타이머가 늦어져도 서버가 버리지 않게)', () => {
    track()
    media.play(0)
    media.advance(150)
    media.pause()

    const segments = ranges(beacons)
    expect(segments).toEqual([
      [0, MAX_SEGMENT_MS],
      [MAX_SEGMENT_MS, MAX_SEGMENT_MS * 2],
      [MAX_SEGMENT_MS * 2, 150_000],
    ])
    for (const [start, end] of segments) expect(end - start).toBeLessThanOrEqual(60_000)
  })

  it('일시정지 상태에서 위치를 옮긴 뒤 재생하면 새 위치부터 기록한다', async () => {
    track()
    media.play(0)
    media.advance(3)
    media.pause()
    media.seek(20)
    media.play()
    media.advance(2)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(ranges(beacons)).toEqual([[0, 3000]])
    // [0, 3000]은 beacon으로 보낸 것을 다시 실은 것
    expect(ranges(sent)).toEqual([
      [0, 3000],
      [20000, 22000],
    ])
  })
})

describe('건너뛰기(TRK-03)', () => {
  it('seeking이면 구간을 닫고 새 위치에서 새로 시작한다 — 건너뛴 부분은 들은 것이 아니다', async () => {
    track()
    media.play(0)
    media.advance(5)
    media.seek(40)
    media.advance(3)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(ranges(sent)).toEqual([
      [0, 5000],
      [40000, 43000],
    ])
  })

  it('뒤로 돌려 다시 들은 것도 기록한다', async () => {
    track()
    media.play(0)
    media.advance(10)
    media.seek(2)
    media.advance(3)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(ranges(sent)).toEqual([
      [0, 10000],
      [2000, 5000],
    ])
  })

  it('맞닿은 구간(멈춤 뒤 같은 자리에서 다시 재생)은 하나로 합친다', () => {
    const tracker = track()
    media.play(0)
    media.advance(3)
    media.pause()
    media.play()
    media.advance(3)

    expect(tracker.listenedRanges()).toEqual([[0, 6000]])
  })

  it('들은 구간 합치기(진행 바용) — 건너뛴 곳은 비운다', () => {
    const tracker = track()
    media.play(0)
    media.advance(5)
    media.seek(40)
    media.advance(3)
    media.seek(3)
    media.advance(4)

    expect(tracker.listenedRanges()).toEqual([
      [0, 7000],
      [40000, 43000],
    ])
  })
})

describe('이탈 시 전송(TRK-02) — 명세 기본(sendBeacon)', () => {
  it('pause면 구간을 닫고 final:true를 sendBeacon으로 보낸다', () => {
    track()
    media.play(0)
    media.advance(6)
    media.pause()

    expect(beacon).toHaveBeenCalledTimes(1)
    expect(beacons[0]).toMatchObject({ final: true, clientSessionId: 'session-1' })
    expect(ranges(beacons)).toEqual([[0, 6000]])
    expect(send).not.toHaveBeenCalled()
  })

  it('ended면 final로 한 번만 보내고(앞의 pause는 건너뜀), 다시 재생하면 새 clientSessionId', () => {
    track()
    media.play(0)
    media.advance(5)
    media.end()
    media.play(0)
    media.advance(2)
    media.pause()

    expect(beacons.map((b) => b.clientSessionId)).toEqual(['session-1', 'session-2'])
    expect(beacons[1].userAgent).toBe('test-agent')
  })

  it('pause 뒤 다시 재생은 같은 세션', () => {
    track()
    media.play(0)
    media.advance(3)
    media.pause()
    media.play()
    media.advance(3)
    media.pause()

    expect(beacons.map((b) => b.clientSessionId)).toEqual(['session-1', 'session-1'])
    expect(ranges(beacons)).toEqual([
      [0, 3000],
      [3000, 6000],
    ])
  })

  it('화면이 숨으면(visibilitychange hidden) final로 보내고, 계속 재생되면 이어서 기록한다', async () => {
    track()
    media.play(0)
    media.advance(4)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    media.advance(4)
    await vi.advanceTimersByTimeAsync(10_000)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })

    expect(ranges(beacons)).toEqual([[0, 4000]])
    expect(beacons[0].final).toBe(true)
    // beacon으로 보낸 [0, 4000]도 다시 싣는다(서버에 닿았는지 모른다)
    expect(ranges(sent)).toEqual([
      [0, 4000],
      [4000, 8000],
    ])
    expect(sent[0].clientSessionId).toBe('session-1')
  })

  it('pagehide면 final로 보낸다', () => {
    track()
    media.play(0)
    media.advance(2)
    window.dispatchEvent(new Event('pagehide'))

    expect(ranges(beacons)).toEqual([[0, 2000]])
  })

  it('보내는 중(fetch)이던 구간도 final에 함께 싣는다(같은 구간이 두 번 가도 서버가 병합)', async () => {
    const release = holdNextSend()
    track()
    media.play(0)
    media.advance(8)
    await vi.advanceTimersByTimeAsync(10_000)
    media.advance(1)
    media.pause()
    release()

    expect(ranges(beacons)).toEqual([
      [0, 8000],
      [8000, 9000],
    ])
  })

  it('sendBeacon이 거절하면(false) 버리지 않고 다음 fetch에 싣는다', async () => {
    beacon.mockReturnValueOnce(false)
    track()
    media.play(0)
    media.advance(3)
    media.pause()
    media.play()
    media.advance(2)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(ranges(sent)).toEqual([
      [0, 3000],
      [3000, 5000],
    ])
  })

  it('sendBeacon으로 보낸 구간도 다음 fetch에 다시 싣고, 그 fetch가 성공하면 더 보내지 않는다', async () => {
    track()
    media.play(0)
    media.advance(3)
    media.pause()
    await vi.advanceTimersByTimeAsync(10_000)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(ranges(beacons)).toEqual([[0, 3000]])
    expect(ranges(sent)).toEqual([[0, 3000]])
    expect(sent[0].clientSessionId).toBe('session-1')
  })

  it('다시 싣은 fetch가 실패하면(네트워크) 남겨 두었다가 또 보낸다', async () => {
    send.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    track()
    media.play(0)
    media.advance(3)
    media.pause()
    await vi.advanceTimersByTimeAsync(10_000)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(send).toHaveBeenCalledTimes(2)
    expect(ranges(sent)).toEqual([[0, 3000]])
  })

  it('다시 싣은 fetch가 같은 실패(예: 400)면 버리고 더 보내지 않는다', async () => {
    const onDiscard = vi.fn()
    send.mockRejectedValueOnce(new Error('400'))
    track({ isPermanent: () => true, onDiscard })
    media.play(0)
    media.advance(3)
    media.pause()
    await vi.advanceTimersByTimeAsync(10_000)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(send).toHaveBeenCalledTimes(1)
    expect(onDiscard).toHaveBeenCalledWith(expect.any(Error), 1)
  })

  it('stop()이면 리스너·타이머를 떼고 남은 것을 final로 보낸다', async () => {
    const tracker = track()
    media.play(0)
    media.advance(3)
    tracker.stop()
    media.advance(5)
    media.advance(5)
    media.seek(30)
    media.pause()
    await vi.advanceTimersByTimeAsync(20_000)

    expect(ranges(beacons)).toEqual([[0, 3000]])
    expect(send).not.toHaveBeenCalled()
    // 뗀 뒤의 재생은 기록하지 않는다
    expect(tracker.listenedRanges()).toEqual([[0, 3000]])
  })

  it('stop() 때 sendBeacon이 거절하면 버리면서 기록을 남긴다(다시 보낼 기회가 없다)', () => {
    const onDiscard = vi.fn()
    beacon.mockReturnValue(false)
    const tracker = track({ onDiscard })
    media.play(0)
    media.advance(3)
    tracker.stop()

    expect(onDiscard).toHaveBeenCalledWith('beacon-rejected', 1)
  })
})

describe('앱 설정(finalVia fetch): 화면이 보이는 끝은 fetch로 응답을 받는다', () => {
  it('pause면 keepalive fetch(final:true), sendBeacon은 쓰지 않는다', async () => {
    track({ finalVia: 'fetch' })
    media.play(0)
    media.advance(6)
    media.pause()
    await vi.advanceTimersByTimeAsync(0)

    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ final: true, keepalive: true })
    expect(ranges(sent)).toEqual([[0, 6000]])
    expect(beacon).not.toHaveBeenCalled()
  })

  it('화면이 숨어 beacon으로 보낸 구간도, 다시 보일 때의 pause fetch에 함께 싣는다', async () => {
    track({ finalVia: 'fetch' })
    media.play(0)
    media.advance(4)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    media.advance(2)
    media.pause()
    await vi.advanceTimersByTimeAsync(0)

    expect(ranges(beacons)).toEqual([[0, 4000]])
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ final: true, keepalive: true })
    expect(ranges(sent)).toEqual([
      [0, 4000],
      [4000, 6000],
    ])
  })

  it('그 fetch가 실패하면(네트워크) 남겨 두었다가 다음에 다시 보낸다', async () => {
    send.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')))
    track({ finalVia: 'fetch' })
    media.play(0)
    media.advance(6)
    media.pause()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(send).toHaveBeenCalledTimes(2)
    expect(ranges(sent.slice(-1))).toEqual([[0, 6000]])
    expect(sent.at(-1)?.clientSessionId).toBe('session-1')
  })

  it('ended면 fetch(final:true)로 보내 응답(완료)을 받는다 — sendBeacon이 아니다', async () => {
    track({ finalVia: 'fetch' })
    media.play(0)
    media.advance(5)
    media.end()
    await vi.advanceTimersByTimeAsync(0)

    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ final: true, keepalive: true })
    expect(ranges(sent)).toEqual([[0, 5000]])
    expect(beacon).not.toHaveBeenCalled()
  })

  it('ended의 fetch가 실패하면 구간은 그 세션으로 남겨 다시 보낸다', async () => {
    send.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')))
    track({ finalVia: 'fetch' })
    media.play(0)
    media.advance(5)
    media.end()
    await vi.advanceTimersByTimeAsync(0)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][1]).toEqual({ keepalive: true })

    // 그사이 새로 재생해도 옛 구간은 옛 세션으로 간다
    media.play(0)
    media.advance(2)
    await vi.advanceTimersByTimeAsync(10_000)

    const retried = sent.filter((p) => p.clientSessionId === 'session-1')
    expect(ranges(retried.slice(-1))).toEqual([[0, 5000]])
    const fresh = sent.filter((p) => p.clientSessionId === 'session-2')
    expect(ranges(fresh)).toEqual([[0, 2000]])
  })

  it('ended 응답을 기다리는 사이 다시 재생하면 새 세션으로 기록한다(한 번 재생 = 세션 하나)', async () => {
    const release = holdNextSend()
    track({ finalVia: 'fetch' })
    media.play(0)
    media.advance(5)
    media.end()
    media.play(0) // 응답 전에 ▶
    media.advance(2)
    release()
    await vi.advanceTimersByTimeAsync(0)
    media.pause()
    await vi.advanceTimersByTimeAsync(0)

    expect(sent.map((p) => p.clientSessionId)).toEqual(['session-1', 'session-2'])
    expect(ranges(sent.slice(-1))).toEqual([[0, 2000]])
  })
})

describe('실패한 전송', () => {
  it('fetch가 실패하면(네트워크) 구간을 버리지 않고 다음 전송에 합친다', async () => {
    send.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')))
    track()
    media.play(0)
    media.advance(5)
    await vi.advanceTimersByTimeAsync(10_000)
    media.advance(5)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(send).toHaveBeenCalledTimes(2)
    expect(ranges(sent.slice(-1))).toEqual([
      [0, 5000],
      [5000, 10000],
    ])
  })

  it('다시 보내도 같은 실패(예: 400)면 그 구간을 버리고 기록한다 — 영원히 재전송하지 않게', async () => {
    const permanent = new Error('400')
    const onDiscard = vi.fn()
    send.mockImplementationOnce(() => Promise.reject(permanent))
    track({ isPermanent: (error) => error === permanent, onDiscard })
    media.play(0)
    media.advance(5)
    await vi.advanceTimersByTimeAsync(10_000)
    media.advance(5)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(onDiscard).toHaveBeenCalledWith(permanent, 1)
    expect(ranges(sent.slice(-1))).toEqual([[5000, 10000]])
  })

  it('오래 끊겨 쌓여도 한 요청에 MAX_SEGMENTS_PER_FLUSH개까지만, 나머지는 이어서 — 빠지는 구간 없음', async () => {
    send.mockImplementation((p, o) => {
      sent.push({ ...structuredClone(p), keepalive: o.keepalive })
      return Promise.reject(new TypeError('offline'))
    })
    track()
    media.play(0)
    for (let i = 0; i < 60; i++) {
      media.advance(10)
      await vi.advanceTimersByTimeAsync(10_000)
    }
    sent = []
    send.mockImplementation((p, o) => {
      sent.push({ ...structuredClone(p), keepalive: o.keepalive })
      return Promise.resolve(RESULT)
    })
    media.pause()
    await vi.advanceTimersByTimeAsync(10_000)

    // 끝(pause)은 명세 기본대로 sendBeacon — 그것도 묶음마다 상한을 지킨다
    expect(sent.length + beacons.length).toBeGreaterThan(1)
    for (const payload of [...sent, ...beacons]) {
      expect(payload.segments.length).toBeLessThanOrEqual(MAX_SEGMENTS_PER_FLUSH)
    }
    const covered = [...sent, ...beacons]
      .flatMap((p) => p.segments)
      .reduce((sum, s) => sum + (s.endMs - s.startMs), 0)
    expect(covered).toBeGreaterThanOrEqual(600_000)
  })

  it('응답 처리(onResult)가 던져도 전송 실패로 보지 않고, 다음 전송도 막지 않는다', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    track({
      onResult: () => {
        throw new Error('cache bug')
      },
    })
    media.play(0)
    media.advance(5)
    await vi.advanceTimersByTimeAsync(10_000)
    media.advance(1)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(log).toHaveBeenCalledWith('[flush] 응답 처리 오류', expect.any(Error))
    expect(ranges(sent)).toEqual([
      [0, 5000],
      [5000, 6000],
    ])
  })

  it('보내는 중에는 겹쳐 보내지 않는다', async () => {
    const release = holdNextSend()
    track()
    media.play(0)
    media.advance(5)
    await vi.advanceTimersByTimeAsync(10_000)
    media.advance(5)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(send).toHaveBeenCalledTimes(1)

    release()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(send).toHaveBeenCalledTimes(2)
    expect(ranges(sent.slice(-1))).toEqual([[5000, 10000]])
  })
})

describe('서버 응답·속도', () => {
  it('응답(track.completed 등)을 onResult로 넘긴다 — 완료 표시는 서버 값으로만', async () => {
    const onResult = vi.fn()
    track({ onResult })
    media.play(0)
    media.advance(5)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(onResult).toHaveBeenCalledWith(RESULT)
  })

  it('ratechange로 배속이 바뀌면 1.0으로 되돌린다(배속 금지)', () => {
    track()
    media.playbackRate = 2
    media.dispatchEvent(new Event('ratechange'))
    expect(media.playbackRate).toBe(1)
  })
})
