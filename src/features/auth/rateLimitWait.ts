import { ApiError } from '../../api/errors'

// 들어가기의 한도 대기(#133, BE #57). 한도가 찬 IP는 반 확인·학생 로그인이 429이고, 응답의 until(ISO-8601 UTC)이
// 풀리는 시각이다 — 길어야 1분 뒤, 드물게 없다. 기기 시계가 틀리면 until과의 차이가 엉뚱해지므로 60초로 자른다

/** 대기 시간의 위 끝 — 서버 한도 창이 1분이다 */
export const MAX_WAIT_MS = 60_000

/**
 * 429의 until까지 기다릴 끝 시각(epoch ms). 429가 아니거나 until이 없거나 읽을 수 없거나 이미 지났으면 undefined
 * — 그때는 기다리지 않고 바로 다시 시도할 수 있다
 */
export function rateLimitDeadline(error: unknown, now: number): number | undefined {
  if (!(error instanceof ApiError) || error.status !== 429 || error.until === undefined) {
    return undefined
  }
  const until = Date.parse(error.until)
  if (Number.isNaN(until) || until <= now) return undefined
  return Math.min(until, now + MAX_WAIT_MS)
}

/** 끝 시각까지 남은 초(올림). 지났으면 0 */
export function secondsLeft(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}
