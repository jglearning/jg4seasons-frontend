import type { components } from '../api/generated/schema'

// 역할별 영역과 첫 화면 — 로그인 뒤 이동·영역 막기(RequireSession)·입장 화면의 "그대로 있기"가 같이 쓴다.
// 화면에서 막는 것은 편의용이다. 진짜 막기는 서버(학원 API는 운영자에게 403, 시스템 API는 운영자만)
type Role = components['schemas']['MeResponse']['role']

/** student = 학생 화면, staff = 학원 교사·관리자 화면, system = 운영자(학원 없음) 화면 */
export type Area = 'student' | 'staff' | 'system'

export function areaFor(role: Role): Area {
  if (role === 'student') return 'student'
  if (role === 'superadmin') return 'system'
  return 'staff'
}

const HOME: Record<Area, string> = {
  student: '/',
  staff: '/teacher',
  system: '/system/academies',
}

export function homePathFor(role: Role): string {
  return HOME[areaFor(role)]
}
