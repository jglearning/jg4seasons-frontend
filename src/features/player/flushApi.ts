import { api } from '../../api'
import { readCsrfToken } from '../../api/csrf'
import { ApiError, unwrap } from '../../api/errors'
import type { paths } from '../../api/generated/schema'

// 청취 구간 전송(03 §3.1). 같은 출처라 쿠키는 자동으로 간다.
// 요청·응답 모양은 생성 타입에서 유도한다(손으로 쓰지 않는다). 추적기는 이 타입만 가져가고 API는 모른다
export const FLUSH_PATH = '/api/v1/listening/flush'

type FlushOperation = paths['/api/v1/listening/flush']['post']
type FlushRequestBody = FlushOperation['requestBody']['content']['application/json']

/** 추적기가 만드는 요청(csrf는 sendBeacon 때만 여기서 붙인다) */
export type FlushPayload = Omit<FlushRequestBody, 'csrf'>
export type FlushSegment = FlushPayload['segments'][number]
export type FlushResult = Awaited<ReturnType<typeof sendFlush>>

/** fetch flush — 앱 API 클라이언트(X-CSRF 헤더, 401 → refresh 1회). keepalive면 화면을 떠나도 끝까지 간다 */
export function sendFlush(payload: FlushPayload, { keepalive = false } = {}) {
  return unwrap(api.POST(FLUSH_PATH, { body: payload, keepalive }))
}

/**
 * 화면을 떠날 때의 final flush — navigator.sendBeacon(응답은 받지 못한다).
 * sendBeacon은 헤더를 못 붙이므로 CSRF는 바디 csrf, Content-Type은 text/plain(서버가 둘 다 받는다)
 */
export function beaconFlush(payload: FlushPayload): boolean {
  if (typeof navigator.sendBeacon !== 'function') return false
  const csrf = readCsrfToken()
  if (csrf === undefined) console.error('[flush] csrf 쿠키 없음 — sendBeacon이 403을 받는다')
  const body: FlushRequestBody = { ...payload, csrf }
  const url = new URL(FLUSH_PATH, globalThis.location.origin).toString()
  return navigator.sendBeacon(
    url,
    new Blob([JSON.stringify(body)], { type: 'text/plain;charset=UTF-8' }),
  )
}

/**
 * 다시 보내도 같은 결과인 실패인가 — 그러면 그 구간은 버린다(영원히 재전송하지 않게).
 * 400 형식·세션 불일치, 403 CSRF·권한, 404 내 진도표에 없는 트랙, 415 Content-Type, 423 LESSON_LOCKED(수업일 전·휴강만), 409, 422.
 * 네트워크 오류·5xx·429는 다시 보낸다. 401은 API 클라이언트가 refresh를 한 뒤에도 401이면 세션 만료로 화면을 옮긴다(이 구간은 알려진 손실)
 */
const PERMANENT_STATUSES = [400, 403, 404, 409, 415, 422, 423]

export function isPermanentFlushError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return PERMANENT_STATUSES.includes(error.status)
}

/** 기록용 요약(개인정보 없음) */
export function describeFlushError(error: unknown) {
  return error instanceof ApiError
    ? { status: error.status, code: error.code, requestId: error.requestId }
    : { error: error instanceof Error ? error.name : String(error) }
}
