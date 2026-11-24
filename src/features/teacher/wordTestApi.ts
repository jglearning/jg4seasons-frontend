import { queryOptions } from '@tanstack/react-query'
import type { Client } from 'openapi-fetch'
import { api } from '../../api'
import { unwrap } from '../../api/errors'

// 교사 단어시험 결과 조회(#175, 1단계 시연용) — 반·회차의 학생별 최근 제출과 제출 상세. 조회만(정정 없음).
//
// [임시] 경로 타입을 손으로 선언했다. 백엔드 API가 아직 openapi.json에 없어서(11/24) 백엔드와 합의한 계약대로
// 적었다. 백엔드가 머지되면 `npm run api:sync`의 생성 타입으로 바꾸고 이 선언과 아래 캐스팅을 지운다.
// 학생 단어시험 모듈(features/student/wordtest)과 타입이 겹치지만 기능 폴더끼리 import하지 않아 따로 둔다 —
// 생성 타입으로 바꾸면 둘 다 같은 생성 타입을 쓴다.
// 앱의 API 인스턴스는 하나라야 refresh 합치기가 된다 — 새 클라이언트 없이 같은 인스턴스를 넓혀 쓴다

export type TeacherWordTestSection = 'A' | 'B' | 'C' | 'D'
export type TeacherWordTestStatus =
  'pending' | 'grading' | 'confirming' | 'graded' | 'rejected' | 'failed'
/** unclear: 글자가 흐려 서버가 판정하지 못한 문항 — 프론트가 제안한 값으로 백엔드 확정 전 */
export type TeacherWordTestResult = 'correct' | 'wrong' | 'blank' | 'unclear'

/** 목록의 학생별 최근 제출(문항 없음) */
export type TeacherWordTestSummary = {
  id: number
  status: TeacherWordTestStatus
  /** graded가 아니면 null */
  score: number | null
  total: number
  attemptNo: number
  submittedAt: string
}

export type TeacherWordTestList = {
  lessonCode: string
  students: Array<{ studentId: number; name: string; submission: TeacherWordTestSummary | null }>
}

export type TeacherWordTestItem = {
  no: number
  /** 문제로 준 쪽 — B 철자 쓰기는 우리말 뜻 */
  prompt: string
  /** 서버가 읽은 글자(빈칸이면 "") */
  written: string
  result: TeacherWordTestResult
  answer: string
}

export type TeacherWordTestDetail = {
  id: number
  lessonCode: string
  section: TeacherWordTestSection
  attemptNo: number
  status: TeacherWordTestStatus
  score: number | null
  total: number
  submittedAt: string
  gradedAt: string | null
  /** graded일 때만 */
  items?: TeacherWordTestItem[]
  student: { id: number; name: string }
  /** 짧은 유효 시간의 서명 주소. 사진이 지워졌으면 null */
  imageUrl: string | null
}

type Problem = { 'application/problem+json': Record<string, unknown> }
type Responses<Ok> = { 200: { content: { 'application/json': Ok } }; default: { content: Problem } }
type GetOp<Params, Ok> = { parameters: Params; requestBody?: never; responses: Responses<Ok> }
type NoParams = { query?: never; header?: never; path?: never; cookie?: never }

type TeacherWordTestPaths = {
  '/api/v1/teacher/classes/{classId}/word-tests': {
    parameters: NoParams
    get: GetOp<
      {
        query: { lessonCode: string; section: TeacherWordTestSection }
        header?: never
        path: { classId: number }
        cookie?: never
      },
      TeacherWordTestList
    >
  }
  '/api/v1/teacher/word-tests/{id}': {
    parameters: NoParams
    get: GetOp<
      { query?: never; header?: never; path: { id: number }; cookie?: never },
      TeacherWordTestDetail
    >
  }
}

const wordTestApi = api as unknown as Client<TeacherWordTestPaths>

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
        wordTestApi.GET('/api/v1/teacher/classes/{classId}/word-tests', {
          params: { path: { classId }, query: { lessonCode, section } },
        }),
      ),
  })
}

export function wordTestDetailQuery(id: number) {
  return queryOptions({
    queryKey: ['teacher', 'wordTests', id],
    queryFn: () =>
      unwrap(wordTestApi.GET('/api/v1/teacher/word-tests/{id}', { params: { path: { id } } })),
  })
}
