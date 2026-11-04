import { queryOptions } from '@tanstack/react-query'
import { api } from '../../api'
import { unwrap } from '../../api/errors'

// 인증 API 호출은 이 파일에만 둔다(03 §1). 응답 타입은 src/api/generated의 경로 타입에서 나온다.
// 로그인은 일부러 useMutation을 쓰지 않는다 — 뮤테이션 캐시가 요청 값(개인 코드·비밀번호)을 들고 있게 되기 때문이다

export function verifyJoinCode(code: string) {
  return unwrap(api.POST('/api/v1/auth/code/verify', { body: { code } }))
}

export function loginStudent(code: string, personalCode: string) {
  return unwrap(api.POST('/api/v1/auth/student/login', { body: { code, personalCode } }))
}

export function loginStaff(loginId: string, password: string) {
  return unwrap(api.POST('/api/v1/auth/staff/login', { body: { loginId, password } }))
}

// 쿼리 키에는 이름·코드를 넣지 않는다(개발 콘솔에 찍힐 수 있다)
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: () => unwrap(api.GET('/api/v1/me')),
})

export function isStaffRole(role: string): boolean {
  return role === 'teacher' || role === 'admin' || role === 'superadmin'
}
