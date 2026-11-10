import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/errors'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { LESSON_MOCK, resetLessonMock } from '../../mocks/lessonData'
import {
  beaconFlush,
  FLUSH_PATH,
  isPermanentFlushError,
  sendFlush,
  type FlushPayload,
} from './flushApi'

const PAYLOAD: FlushPayload = {
  clientSessionId: 'session-1',
  trackId: 9002,
  startedAt: '2026-12-19T10:00:00.000Z',
  segments: [{ startMs: 0, endMs: 5000, recordedAt: '2026-12-19T10:00:05.000Z' }],
  final: true,
}

// jsdom 30에는 sendBeacon이 없다 — 프로토타입에 붙이고 spy(CLAUDE.md 테스트 설정)
beforeEach(() => {
  Object.defineProperty(Navigator.prototype, 'sendBeacon', {
    value: () => true,
    configurable: true,
    writable: true,
  })
  document.cookie = 'csrf=tok%2Fen; path=/'
})

afterEach(() => {
  document.cookie = 'csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  delete (Navigator.prototype as { sendBeacon?: unknown }).sendBeacon
})

describe('beaconFlush', () => {
  it('같은 출처 flush 주소로, text/plain 바디에 csrf를 넣어 보낸다(헤더를 못 붙이므로)', async () => {
    const spy = vi.spyOn(navigator, 'sendBeacon').mockReturnValue(true)

    expect(beaconFlush(PAYLOAD)).toBe(true)

    const [url, blob] = spy.mock.calls[0] as [string, Blob]
    expect(url).toBe(`${location.origin}${FLUSH_PATH}`)
    expect(blob.type).toBe('text/plain;charset=utf-8')
    expect(JSON.parse(await blob.text())).toEqual({ ...PAYLOAD, csrf: 'tok/en' })
  })

  it('브라우저가 큐에 넣지 못하면 false를 그대로 돌려준다(추적기가 다음 fetch에 남긴다)', () => {
    vi.spyOn(navigator, 'sendBeacon').mockReturnValue(false)
    expect(beaconFlush(PAYLOAD)).toBe(false)
  })

  it('sendBeacon이 없는 브라우저면 false', () => {
    delete (Navigator.prototype as { sendBeacon?: unknown }).sendBeacon
    expect(beaconFlush(PAYLOAD)).toBe(false)
  })
})

describe('sendFlush · 실패 구분', () => {
  it('keepalive를 요청에 싣고 X-CSRF 헤더를 붙인다(MSW가 다시 만들기 전 fetch 호출에서 본다)', async () => {
    setMockSession('student')
    resetLessonMock()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const body = { ...PAYLOAD, trackId: LESSON_MOCK.passageTrackId(1, 'us_w') }

    await sendFlush(body, { keepalive: true })

    const request = fetchSpy.mock.calls[0][0] as Request
    expect(request.keepalive).toBe(true)
    expect(request.headers.get('X-CSRF')).toBe('tok/en')
    resetAuthMock()
  })

  it.each([
    [400, true],
    [403, true],
    [404, true],
    [409, true],
    [415, true],
    [422, true],
    [423, true],
    [401, false],
    [429, false],
    [500, false],
    [503, false],
  ])('%i이면 버림=%s(다시 보내도 같은 실패만 버린다)', (status, permanent) => {
    expect(isPermanentFlushError(new ApiError({ status, title: 'x' }))).toBe(permanent)
  })

  it('네트워크 오류(TypeError)는 다시 보낸다', () => {
    expect(isPermanentFlushError(new TypeError('Failed to fetch'))).toBe(false)
  })
})
