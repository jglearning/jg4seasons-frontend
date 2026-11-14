import { queryOptions } from '@tanstack/react-query'
import { api } from '../../api'
import { unwrap } from '../../api/errors'
import type { components } from '../../api/generated/schema'

// 관리자 반 관리(03 §5.1, BE #14)·교사 관리(§5.3, BE #12). 관리자만, POST·PATCH는 X-CSRF(API 클라이언트가 붙임).
// 만들기·수정은 일부러 useMutation을 쓰지 않는다 — 뮤테이션 캐시가 요청 값(교사 비밀번호)을 들고 있게 되기 때문이다(로그인과 같은 이유)

type Schemas = components['schemas']

// ── 반 ──

export const classesQuery = queryOptions({
  queryKey: ['admin', 'classes'],
  queryFn: () => unwrap(api.GET('/api/v1/admin/classes')),
})

export function classQuery(id: number) {
  return queryOptions({
    queryKey: ['admin', 'classes', id],
    queryFn: () => unwrap(api.GET('/api/v1/admin/classes/{id}', { params: { path: { id } } })),
  })
}

export type ClassCreate = Schemas['ClassCreateRequest']
export type ClassUpdate = Schemas['ClassUpdateRequest']

export function createClass(body: ClassCreate) {
  return unwrap(api.POST('/api/v1/admin/classes', { body }))
}

export function updateClass(id: number, body: ClassUpdate) {
  return unwrap(api.PATCH('/api/v1/admin/classes/{id}', { params: { path: { id } }, body }))
}

export function regenerateAccessCode(id: number) {
  return unwrap(
    api.POST('/api/v1/admin/classes/{id}/access-code/regenerate', { params: { path: { id } } }),
  )
}

export type AdminClass = Awaited<ReturnType<typeof createClass>>
export type ClassStatus = AdminClass['status']

// ── 교재 사용권(7.5, BE #48) — 보기만. 바꾸기는 운영자(O-03) ──

export const licensesQuery = queryOptions({
  queryKey: ['admin', 'licenses'],
  queryFn: () => unwrap(api.GET('/api/v1/admin/licenses')),
})

export type AdminLicense = Schemas['AcademyLicenseItem']

// ── 교사 ──

export const teachersQuery = queryOptions({
  queryKey: ['admin', 'teachers'],
  queryFn: () => unwrap(api.GET('/api/v1/admin/teachers')),
})

export type TeacherCreate = Schemas['TeacherCreateRequest']
export type TeacherUpdate = Schemas['TeacherUpdateRequest']

export function createTeacher(body: TeacherCreate) {
  return unwrap(api.POST('/api/v1/admin/teachers', { body }))
}

export function updateTeacher(id: number, body: TeacherUpdate) {
  return unwrap(api.PATCH('/api/v1/admin/teachers/{id}', { params: { path: { id } }, body }))
}

export type AdminTeacher = Awaited<ReturnType<typeof createTeacher>>
