import { api } from '../../api'

// 음원(/audio/*)은 운영에서 CloudFront 서명 쿠키가 있어야 받는다(백엔드 ADR-28). 쿠키는 로그인·refresh 때
// access와 같이 새로 오고 2시간 간다. API 호출 없이 오래 연 화면에서 쿠키가 끝나면 음원이 403 → <audio> error.
// 그때 refresh를 한 번 보내 쿠키를 새로 받는다. 성공 여부만 돌려준다(세션 만료 처리는 다음 API 요청의 몫)

export async function renewAudioAccess(): Promise<boolean> {
  try {
    const { response } = await api.POST('/api/v1/auth/refresh')
    return response.ok
  } catch {
    return false
  }
}
