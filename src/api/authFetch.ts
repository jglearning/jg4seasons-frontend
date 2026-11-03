import { CSRF_HEADER, needsCsrf, readCsrfToken } from './csrf'

// openapi-fetch에 넘기는 fetch. 쿠키 인증(같은 출처, httpOnly) 위에서 두 가지를 한다(03 §0.1·0.2):
// 1) 상태 변경 요청에 X-CSRF 헤더
// 2) 401이면 POST /auth/refresh를 한 번 하고 원 요청을 한 번 다시 보낸다.
//    동시에 여러 요청이 401을 받아도 refresh는 한 번만 한다(refresh 토큰은 회전하므로 두 번 쓰면 두 번째가 실패한다).
//    refresh가 실패하면 onSessionExpired를 부르고 원래 401 응답을 돌려준다(화면이 입장·로그인으로 보낸다).

const AUTH_PREFIX = '/api/v1/auth/'
export const REFRESH_PATH = `${AUTH_PREFIX}refresh`

export type AuthFetchOptions = {
  fetch?: (input: Request) => Promise<Response>
  onSessionExpired?: () => void
}

function withCsrf(request: Request): Request {
  if (!needsCsrf(request.method)) return request
  const token = readCsrfToken()
  if (token === undefined) return request
  const headers = new Headers(request.headers)
  headers.set(CSRF_HEADER, token)
  return new Request(request, { headers })
}

export function createAuthFetch({
  fetch: baseFetch = (input) => globalThis.fetch(input),
  onSessionExpired,
}: AuthFetchOptions = {}): (input: Request) => Promise<Response> {
  let refreshing: Promise<boolean> | null = null

  function refreshOnce(origin: string): Promise<boolean> {
    refreshing ??= baseFetch(
      withCsrf(new Request(new URL(REFRESH_PATH, origin), { method: 'POST' })),
    )
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  return async function authFetch(input: Request): Promise<Response> {
    const request = withCsrf(input)
    // 본문은 한 번만 읽히므로 보내기 전에 다시 보낼 사본을 떠 둔다
    const retry = request.clone()
    const response = await baseFetch(request)

    const url = new URL(request.url)
    if (response.status !== 401 || url.pathname.startsWith(AUTH_PREFIX)) return response

    const refreshed = await refreshOnce(url.origin)
    if (!refreshed) {
      onSessionExpired?.()
      return response
    }
    // refresh가 csrf 쿠키도 새로 주므로 헤더를 다시 읽는다
    return baseFetch(withCsrf(retry))
  }
}
