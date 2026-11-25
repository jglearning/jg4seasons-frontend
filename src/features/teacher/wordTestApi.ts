import { queryOptions } from '@tanstack/react-query'
import { api } from '../../api'
import { unwrap } from '../../api/errors'
import type { components } from '../../api/generated/schema'

// 교사 단어시험 결과 조회(#175, 1단계 시연용) — 반·회차의 학생별 최근 제출과 제출 상세. 조회만(정정 없음).
// 타입은 생성 타입(`BE #75`). 이름은 화면·테스트가 쓰던 그대로 별칭으로 둔다.
// 교사 문항은 unclear에도 answer가 온다(학생 응답은 null — "확인 필요" 판단용).

type Schemas = components['schemas']
export type TeacherWordTestList = Schemas['TeacherWordTestList']
export type TeacherWordTestSummary = Schemas['TeacherWordTestSummary']
export type TeacherWordTestDetail = Schemas['TeacherWordTestDetail']
export type TeacherWordTestItem = Schemas['TeacherWordTestItem']
export type TeacherWordTestSection = TeacherWordTestDetail['section']
export type TeacherWordTestStatus = TeacherWordTestDetail['status']
export type TeacherWordTestResult = TeacherWordTestItem['result']

/** 이번에 만드는 영역(B 철자 쓰기) */
export const SECTION_SPELLING: TeacherWordTestSection = 'B'

// 쿼리 키는 숫자 id와 회차 코드(교재 회차 식별자 — 개인 정보 아님)만
export function classWordTestsQuery(
  classId: number,
  lessonCode: string,
  section: TeacherWordTestSection = SECTION_SPELLING,
) {
  return queryOptions({
    queryKey: ['teacher', 'classes', classId, 'wordTests', lessonCode, section],
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/teacher/classes/{classId}/word-tests', {
          params: { path: { classId }, query: { lessonCode, section } },
        }),
      ),
  })
}

export function wordTestDetailQuery(id: number) {
  return queryOptions({
    queryKey: ['teacher', 'wordTests', id],
    queryFn: () => unwrap(api.GET('/api/v1/teacher/word-tests/{id}', { params: { path: { id } } })),
  })
}
