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

// ── 학원 상세·교재 사용권(7.3·7.4) ──

export function academyQuery(id: number) {
  return queryOptions({
    queryKey: ['system', 'academies', id],
    queryFn: () => unwrap(api.GET('/api/v1/system/academies/{id}', { params: { path: { id } } })),
  })
}

export type AcademyDetail = Schemas['AcademyDetailResponse']
export type License = Schemas['LicenseItem']
export type LicenseSet = Schemas['LicenseSetRequest']

// ── 학생별 프리토킹 허용(O-04, BE #97) ──
// 재원생 전체가 한 번에 온다(페이지 없음, 반 이름 → 이름 순, 반 없는 학생은 맨 뒤).
// 학원 스위치(features.talk)는 이 응답에 없다 — 켜 둔 학생도 학원 스위치가 꺼져 있으면 못 쓴다

export function talkStudentsQuery(id: number) {
  return queryOptions({
    queryKey: ['system', 'academies', id, 'talk'],
    queryFn: () =>
      unwrap(api.GET('/api/v1/system/academies/{id}/talk/students', { params: { path: { id } } })),
  })
}

export type TalkStudent = Schemas['TalkStudentItem']
export type TalkStudentListResponse = Schemas['TalkStudentListResponse']
export type TalkStudentsSet = Schemas['TalkStudentsSetRequest']

/** 한 명·여러 명 한 번에. 응답은 요청한 학생만(목록과 같은 모양). 재원생이 아닌 id가 섞이면 404, 아무것도 안 바뀜 */
export function setTalkStudents(id: number, body: TalkStudentsSet) {
  return unwrap(
    api.PUT('/api/v1/system/academies/{id}/talk/students', { params: { path: { id } }, body }),
  )
}

/** 없으면 만들고 있으면 고친다. 응답은 바뀐 줄 하나 */
export function setLicense(id: number, bookCode: string, body: LicenseSet) {
  return unwrap(
    api.PUT('/api/v1/system/academies/{id}/licenses/{bookCode}', {
      params: { path: { id, bookCode } },
      body,
    }),
  )
}
