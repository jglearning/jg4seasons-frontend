import { api } from '../../../api'
import { unwrap } from '../../../api/errors'
import type { components } from '../../../api/generated/schema'
import type { RosterRequest } from './build'

// A-05 명단 가져오기(BE #67, ADR 0036). 둘 다 POST라 X-CSRF는 API 클라이언트가 붙인다.
// useMutation을 쓰지 않는다 — 만들기 응답의 개인 코드 평문이 뮤테이션 캐시에 남지 않게(useSubmit 머리 주석)

type Schemas = components['schemas']
export type RosterIssue = Schemas['RosterImportIssue']
export type RosterCheck = Schemas['RosterImportCheckResponse']
export type RosterResult = Schemas['RosterImportResponse']
export type RosterImportedClass = Schemas['RosterImportedClass']

/** 검사만 — 아무것도 만들지 않는다. 형식 위반(개수·길이)은 400 VALIDATION */
export function checkRoster(body: RosterRequest) {
  return unwrap(api.POST('/api/v1/admin/roster-imports/check', { body }))
}

/** 만들기 — 한 트랜잭션. 4xx면 아무것도 생기지 않음(문구는 "명단을 다시 검사해 주세요" 고정) */
export function createRoster(body: RosterRequest) {
  return unwrap(api.POST('/api/v1/admin/roster-imports', { body }))
}
