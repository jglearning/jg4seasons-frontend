// 서버가 내려 준 csrf 쿠키(HttpOnly 아님)를 읽어 상태 변경 요청의 X-CSRF 헤더로 보낸다(03 §0.2).
// access·refresh 쿠키는 HttpOnly라 여기서 읽을 수 없고, 읽지도 않는다.
const CSRF_COOKIE = 'csrf'
export const CSRF_HEADER = 'X-CSRF'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function readCsrfToken(cookie: string = document.cookie): string | undefined {
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === CSRF_COOKIE) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

export function needsCsrf(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase())
}
