import { api, notifySessionExpired } from '../../api'

// 음원(/audio/*)은 운영에서 CloudFront 서명 쿠키가 있어야 받는다(백엔드 ADR-28). 쿠키는 로그인·refresh 때
// access와 같이 새로 오고 2시간 간다. API 호출 없이 오래 연 화면에서 쿠키가 끝나면 음원이 403 → <audio> error.
// 그때 refresh를 한 번 보내 쿠키를 새로 받는다.
// 결과는 authFetch의 refresh 판정과 같게 나눈다(/auth/ 경로의 401은 authFetch가 그대로 돌려주므로 여기서 직접):
// - ok: 쿠키를 새로 받았다
// - expired: 401·403 — 세션이 끝났다. 앱의 세션 만료 처리(입장 화면)로 보낸다
// - failed: 네트워크·5xx·리다이렉트 — 세션은 두고 실패만(리다이렉트 끝의 200 HTML을 성공으로 보지 않게 따라가지 않는다)

export type AudioAccess = 'ok' | 'expired' | 'failed'

type Failure =
  { reason: 'expired' } | { reason: 'network'; name: string } | { reason: 'status'; status: number }

export async function renewAudioAccess(): Promise<AudioAccess> {
  let response: Response
  try {
    ;({ response } = await api.POST('/api/v1/auth/refresh', { redirect: 'manual' }))
  } catch (error) {
    // 메시지에는 주소가 들어갈 수 있다 — 이름만
    return fail({ reason: 'network', name: error instanceof Error ? error.name : typeof error })
  }
  if (response.ok) return 'ok'
  if (response.status === 401 || response.status === 403) {
    fail({ reason: 'expired' })
    notifySessionExpired()
    return 'expired'
  }
  return fail({ reason: 'status', status: response.status })
}

function fail(failure: Failure): Exclude<AudioAccess, 'ok'> {
  console.error('[audio] 음원 접근 갱신 실패', failure)
  return failure.reason === 'expired' ? 'expired' : 'failed'
}
