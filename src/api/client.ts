import createClient from 'openapi-fetch'
import { createAuthFetch, type AuthFetchOptions } from './authFetch'
import { badResponseError } from './errors'

// openapi-fetch 클라이언트에 authFetch(X-CSRF, 401 → refresh 1회 후 재시도)를 꽂는다.
// Paths는 src/api/generated의 생성 타입만 넣는다(손으로 쓴 타입 금지). 앱 인스턴스는 src/api/index.ts의 api 하나다
// baseUrl 기본값은 현재 주소의 origin — 브라우저에서는 상대 주소와 같고, 테스트(jsdom + Node Request)에서도 절대 주소가 된다
export function createApiClient<Paths extends object>({
  baseUrl = globalThis.location?.origin ?? '',
  ...authOptions
}: Omit<AuthFetchOptions, 'onSessionExpired'> & {
  onSessionExpired: () => void
  baseUrl?: string
}) {
  const client = createClient<Paths>({ baseUrl, fetch: createAuthFetch(authOptions) })
  client.use({
    onResponse({ response }) {
      if (!response.ok || response.status === 204) return undefined
      const type = response.headers.get('Content-Type')
      // 성공인데 JSON이 아니면(예: /api/*가 index.html로 떨어짐) 파싱 오류 대신 상태를 담은 오류로
      if (type && !type.includes('json')) throw badResponseError(response)
      return undefined
    },
  })
  return client
}
