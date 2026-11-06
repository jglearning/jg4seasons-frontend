import { queryOptions } from '@tanstack/react-query'
import { api } from '.'
import { unwrap } from './errors'
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
