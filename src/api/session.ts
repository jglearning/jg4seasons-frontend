import { queryOptions } from '@tanstack/react-query'
import { api } from '.'
import { ApiError, unwrap, unwrapVoid } from './errors'
import type { components } from './generated/schema'

// 지금 로그인한 사람(03 §1.7 GET /me) — 가드·세션 만료 처리·화면(이름 표시)이 같이 쓴다.
// 쿼리 키에는 이름·코드를 넣지 않는다(개발 콘솔에 찍힐 수 있다)
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: () => unwrap(api.GET('/api/v1/me')),
})

type Role = components['schemas']['MeResponse']['role']

export function isStaffRole(role: Role): boolean {
  return role === 'teacher' || role === 'admin' || role === 'superadmin'
}

/**
 * 로그아웃(03 §1.6) — 서버가 refresh를 끊고 쿠키 3개를 만료시킨다(학생·교사 같은 경로).
 * 쿠키는 httpOnly라 JS가 지울 수 없으므로 실패하면 던진다(화면은 그대로 두고 다시 누르게).
 * 이미 세션이 없으면(401 — auth 경로는 refresh를 다시 시도하지 않는다) 로그아웃된 것으로 본다.
 * 부르는 쪽은 입장 화면으로 옮기고 쿼리 캐시를 비운다(다음에 들어오는 사람에게 이 사람 데이터가 남지 않게)
 */
export async function logout(): Promise<void> {
  try {
    await unwrapVoid(api.POST('/api/v1/auth/logout'))
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return
    throw error
  }
}
