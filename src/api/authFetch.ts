import { CSRF_HEADER, needsCsrf, readCsrfToken } from './csrf'

// openapi-fetch에 넘기는 fetch. 쿠키 인증(같은 출처, httpOnly) 위에서 두 가지를 한다(03 §0.1·0.2):
// 1) 상태 변경 요청에 X-CSRF 헤더
// 2) 401이면 POST /auth/refresh를 한 번 하고 원 요청을 한 번 다시 보낸다.
//    동시에 여러 요청이 401을 받아도 refresh는 한 번만 한다(refresh 토큰은 회전하므로 두 번 쓰면 두 번째가 실패한다).
//
// refresh 결과는 셋으로 나눈다 — 잠깐 끊긴 네트워크나 서버 배포 때문에 학생을 입장 화면으로 보내지 않기 위해서다:
// - 401·403: 세션이 끝났다 → onSessionExpired(refresh 한 번에 한 번), 원래 401을 돌려준다
// - 네트워크 오류: 그대로 던진다(fetch와 같은 TypeError — 쿼리는 1회 재시도, flush는 버퍼를 유지)
// - 그 밖(5xx·429·리다이렉트): 세션은 그대로 두고 refresh 응답을 돌려준다(쿼리 재시도 정책이 판단)
// refresh가 성공했는데 다시 보낸 요청도 401이면(쿠키가 실제로 심어지지 않은 경우) 세션이 끝난 것으로 본다.
//
// 이 fetch(와 이것을 쓰는 클라이언트)는 앱에 하나만 만든다 — refresh 합치기가 인스턴스 안에서만 된다.

const AUTH_PREFIX = '/api/v1/auth/'
export const REFRESH_PATH = `${AUTH_PREFIX}refresh`

export type AuthFetchOptions = {
  fetch?: (input: Request) => Promise<Response>
  /** 세션이 끝났을 때. 여러 번 불려도 안전하게(멱등) 만든다 */
  onSessionExpired?: () => void
}

type RefreshResult =
  { kind: 'ok' } | { kind: 'expired' } | { kind: 'unavailable'; response: Response }

function withCsrf(request: Request): Request {
  if (!needsCsrf(request.method)) return request
  const headers = new Headers(request.headers)
  const token = readCsrfToken()
  // 쿠키가 없으면 예전 값을 싣고 가지 않도록 지운다
  if (token === undefined) headers.delete(CSRF_HEADER)
  else headers.set(CSRF_HEADER, token)
  return new Request(request, { headers })
}

export function createAuthFetch({
  fetch: baseFetch = (input) => globalThis.fetch(input),
  onSessionExpired,
}: AuthFetchOptions = {}): (input: Request) => Promise<Response> {
  let refreshing: Promise<RefreshResult> | null = null

  function refreshOnce(origin: string): Promise<RefreshResult> {
    refreshing ??= (async (): Promise<RefreshResult> => {
      // 리다이렉트를 따라가면 그 끝의 200 HTML을 성공으로 잘못 볼 수 있다
      const response = await baseFetch(
        withCsrf(
          new Request(new URL(REFRESH_PATH, origin), { method: 'POST', redirect: 'manual' }),
        ),
      )
      if (response.ok) return { kind: 'ok' }
      if (response.status === 401 || response.status === 403) {
        onSessionExpired?.()
        return { kind: 'expired' }
      }
      return { kind: 'unavailable', response }
    })().finally(() => {
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

    const result = await refreshOnce(url.origin)
    if (result.kind === 'expired') return response
    // 같은 refresh를 기다린 요청마다 본문을 따로 읽을 수 있게 사본을 준다
    if (result.kind === 'unavailable') return result.response.clone()

    // refresh가 csrf 쿠키도 새로 주므로 헤더를 다시 읽는다
    const retried = await baseFetch(withCsrf(retry))
    if (retried.status === 401) onSessionExpired?.()
    return retried
  }
}
