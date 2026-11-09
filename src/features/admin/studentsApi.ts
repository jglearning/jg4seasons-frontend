import { queryOptions } from '@tanstack/react-query'
import { api } from '../../api'
import { unwrap } from '../../api/errors'
import type { components } from '../../api/generated/schema'

// 관리자 학생 관리(03 §5.2)·학원 현황(§5.4), BE #27.
// 개인 코드 평문은 만들기·재발급 응답에만 온다(ADR-22). 그래서 이 응답들은 쿼리 캐시에 넣지 않고,
// useMutation도 쓰지 않는다(뮤테이션 캐시가 응답을 들고 있게 되기 때문) — 받은 화면의 지역 state에만 둔다

type Schemas = components['schemas']

export type AdminStudent = Schemas['StudentResponse']
export type StudentStatus = AdminStudent['status']
export type NewStudent = Schemas['StudentCreateItem']
export type PersonalCodeItem = Schemas['PersonalCodeItem']
export type Dashboard = Schemas['DashboardResponse']

/** 쿼리 키는 숫자 id만(학생 이름·코드를 넣지 않는다) */
export function studentsQuery(classId: number) {
  return queryOptions({
    queryKey: ['admin', 'classes', classId, 'students'],
    queryFn: () =>
      unwrap(api.GET('/api/v1/admin/classes/{id}/students', { params: { path: { id: classId } } })),
  })
}

export async function createStudents(
  classId: number,
  students: NewStudent[],
): Promise<PersonalCodeItem[]> {
  const result = await unwrap(
    api.POST('/api/v1/admin/classes/{id}/students', {
      params: { path: { id: classId } },
      body: { students },
    }),
  )
  return result.created
}

export async function regeneratePersonalCodes(
  classId: number,
  studentIds: number[],
): Promise<PersonalCodeItem[]> {
  const result = await unwrap(
    api.POST('/api/v1/admin/classes/{id}/students/personal-codes/regenerate', {
      params: { path: { id: classId } },
      body: { studentIds },
    }),
  )
  return result.items
}

export function setStudentStatus(id: number, status: StudentStatus) {
  return unwrap(
    api.PATCH('/api/v1/admin/students/{id}', { params: { path: { id } }, body: { status } }),
  )
}

export function moveStudent(id: number, toClassId: number) {
  return unwrap(
    api.POST('/api/v1/admin/students/{id}/move', { params: { path: { id } }, body: { toClassId } }),
  )
}

export const dashboardQuery = queryOptions({
  queryKey: ['admin', 'dashboard'],
  queryFn: () => unwrap(api.GET('/api/v1/admin/dashboard')),
})
