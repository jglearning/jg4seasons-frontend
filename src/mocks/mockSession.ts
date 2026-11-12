import { setMockSession } from './handlers'

// dev:mock 전용 — 로그인한 상태로 시작하기(Impeccable detector·스크린샷 도구용).
// 목의 로그인 상태는 메모리에만 있어 새로 연 브라우저는 늘 S-01로 간다. 주소에 ?as=student|teacher|admin|superadmin을
// 붙이면 그 탭(sessionStorage)에서는 새로 고쳐도 그 역할로 로그인한 상태로 시작한다. ?as=none이면 끈다.
// 앱 코드는 이 값을 모른다 — 목 핸들러의 세션만 바뀐다
const ROLES = ['student', 'teacher', 'admin', 'superadmin'] as const
type Role = (typeof ROLES)[number]

const KEY = 'jg4s.mock.as'

function isRole(value: string | null): value is Role {
  return value !== null && (ROLES as readonly string[]).includes(value)
}

export function applyMockSession() {
  const param = new URLSearchParams(window.location.search).get('as')
  let role: string | null = param
  try {
    if (param === 'none') sessionStorage.removeItem(KEY)
    else if (isRole(param)) sessionStorage.setItem(KEY, param)
    else role = sessionStorage.getItem(KEY)
  } catch {
    // 저장소를 못 쓰면 주소 값만 쓴다
  }
  if (isRole(role)) setMockSession(role)
}
