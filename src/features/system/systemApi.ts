import { queryOptions } from '@tanstack/react-query'
import { api } from '../../api'
import { unwrap } from '../../api/errors'
import type { components } from '../../api/generated/schema'

// 운영자 학원·교재 사용권 관리(SYS-07, BE #48 7.1~7.4). 운영자(superadmin)만 — 교사·관리자는 403.
// POST·PUT은 X-CSRF(API 클라이언트가 붙임). 만들기는 useMutation을 쓰지 않는다 —
// 뮤테이션 캐시가 요청 값(첫 관리자 비밀번호)을 들고 있게 되기 때문이다(관리자 교사 추가와 같은 이유)

type Schemas = components['schemas']

export const academiesQuery = queryOptions({
  queryKey: ['system', 'academies'],
  queryFn: () => unwrap(api.GET('/api/v1/system/academies')),
})

export type Academy = Schemas['AcademyResponse']
export type AcademyCreate = Schemas['AcademyCreateRequest']

export function createAcademy(body: AcademyCreate) {
  return unwrap(api.POST('/api/v1/system/academies', { body }))
}
