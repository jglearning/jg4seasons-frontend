import type { paths } from './generated/schema'
import { createApiClient } from './client'

// 앱의 API 클라이언트는 이것 하나다(refresh 합치기가 인스턴스 안에서만 된다).
// 세션이 끝났을 때 어디로 보낼지는 라우터를 아는 app이 등록한다
let sessionExpiredHandler: () => void = () => {}

/** 등록을 되돌리는 함수를 돌려준다(effect 정리용) */
export function setSessionExpiredHandler(handler: () => void): () => void {
  sessionExpiredHandler = handler
  return () => {
    if (sessionExpiredHandler === handler) sessionExpiredHandler = () => {}
  }
}

/** API 클라이언트 밖에서 세션이 끝난 것을 안 경우(음원 접근 갱신)에 같은 처리로 보낸다 */
export function notifySessionExpired(): void {
  sessionExpiredHandler()
}

export const api = createApiClient<paths>({ onSessionExpired: notifySessionExpired })
