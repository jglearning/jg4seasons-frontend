import createClient from 'openapi-fetch'
import { createAuthFetch, type AuthFetchOptions } from './authFetch'

// openapi-fetch 클라이언트에 authFetch(X-CSRF, 401 → refresh 1회 후 재시도)를 꽂는다.
// Paths는 src/api/generated의 생성 타입만 넣는다(손으로 쓴 타입 금지).
// 실제 인스턴스는 백엔드 경로가 생긴 뒤 만든다: createApiClient<paths>({ onSessionExpired })
export function createApiClient<Paths extends object>({
  baseUrl = '',
  ...authOptions
}: AuthFetchOptions & { baseUrl?: string } = {}) {
  return createClient<Paths>({ baseUrl, fetch: createAuthFetch(authOptions) })
}
