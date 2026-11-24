import { queryOptions } from '@tanstack/react-query'
import type { Client } from 'openapi-fetch'
import { api } from '../../api'
import { ApiError, fallbackTitle, toApiError, unwrap } from '../../api/errors'

// 단어시험 사진 채점 1단계(시연용, #171). 학생 API — 업로드 주소 발급 → S3에 PUT → 제출 → 상태 조회.
//
// [임시] 경로 타입을 손으로 선언했다. 백엔드 API가 아직 openapi.json에 없어서(11/24) 프론트·백엔드가 같이 정한
// 계약(동섭 지시서 §D + 11/24 답의 변경)대로 적었다. 백엔드가 머지되면 `npm run api:sync`의 생성 타입으로
// 바꾸고 이 선언과 아래 캐스팅을 지운다(PR 4). 그 전까지는 계약과 다르게 써도 타입 검사가 잡지 못한다.
// 앱의 API 인스턴스는 하나라야 refresh 합치기가 된다 — 새 클라이언트를 만들지 않고 같은 인스턴스를 넓혀 쓴다

export type WordTestSection = 'A' | 'B' | 'C' | 'D'
/** 이번에 실제로 오는 값은 pending · grading · graded · failed. confirming · rejected는 2단계 */
export type WordTestStatus = 'pending' | 'grading' | 'confirming' | 'graded' | 'rejected' | 'failed'
/**
 * unclear: 글자가 흐려 서버가 맞음·틀림을 판단하지 못한 문항 — 프론트가 제안한 계약 변경(11/24 동섭 승인,
 * 백엔드 답 대기 — handoff "프론트 → 백엔드 질문"). 답이 오기 전까지 목에서만 나온다
 */
export type WordTestResult = 'correct' | 'wrong' | 'blank' | 'unclear'

export type WordTestItem = {
  no: number
  /** 문제로 준 쪽 — B 철자 쓰기는 우리말 뜻 */
  prompt: string
  /** 학생이 쓴 영어(빈칸이면 "") */
  written: string
  result: WordTestResult
  /** 정답 철자 */
  answer: string
}

export type WordTestSubmission = {
  id: number
  lessonCode: string
  section: WordTestSection
  attemptNo: number
  status: WordTestStatus
  /** graded가 아니면 null */
  score: number | null
  total: number
  submittedAt: string
  gradedAt: string | null
  /** graded일 때만 있다(정답이 새지 않게 그 밖에는 필드 자체가 없음) */
  items?: WordTestItem[]
}

export type UploadTicket = {
  uploadUrl: string
  imageKey: string
  /** PUT 요청 헤더에 그대로 넣는다 */
  headers: Record<string, string>
  expiresAt: string
}

type Problem = { 'application/problem+json': Record<string, unknown> }
type Json<T> = { 'application/json': T }
type Responses<Ok> = { 200: { content: Json<Ok> }; default: { content: Problem } }
type Op<Params, Body, Ok> = {
  parameters: Params
  requestBody: { content: Json<Body> }
  responses: Responses<Ok>
}
type GetOp<Params, Ok> = { parameters: Params; requestBody?: never; responses: Responses<Ok> }
type NoParams = { query?: never; header?: never; path?: never; cookie?: never }
type Path<Ops> = { parameters: NoParams } & Ops

type WordTestPaths = {
  '/api/v1/word-tests/uploads': Path<{
    post: Op<NoParams, { lessonCode: string; contentType: string }, UploadTicket>
  }>
  '/api/v1/word-tests/submissions': Path<{
    post: Op<
      NoParams,
      {
        clientSubmissionId: string
        lessonCode: string
        section: WordTestSection
        imageKey: string
      },
      Pick<WordTestSubmission, 'id' | 'status'>
    >
  }>
  '/api/v1/word-tests/submissions/{id}': Path<{
    get: GetOp<
      { query?: never; header?: never; path: { id: number }; cookie?: never },
      WordTestSubmission
    >
  }>
  '/api/v1/word-tests/lessons/{lessonCode}/latest': Path<{
    get: GetOp<
      {
        query: { section: WordTestSection }
        header?: never
        path: { lessonCode: string }
        cookie?: never
      },
      WordTestSubmission
    >
  }>
}

const wordTestApi = api as unknown as Client<WordTestPaths>

/** 이번에 만드는 영역(B 철자 쓰기). 값으로 다뤄 나중에 영역을 늘린다 */
export const SECTION_SPELLING: WordTestSection = 'B'

/**
 * 조회를 멈출 상태 — 채점이 도는 중(pending·grading)이 아닌 모든 값.
 * graded·failed는 끝, confirming·rejected(2단계)와 모르는 값은 서버가 혼자 넘어가지 않을 수 있어
 * 2초 조회를 계속하면 화면에 갇힌다(#171 안전장치). 다시 들어오면 최근 제출을 새로 받는다
 */
export function isSettled(status: WordTestStatus): boolean {
  return status !== 'pending' && status !== 'grading'
}

export function requestUpload(lessonCode: string) {
  return unwrap(
    wordTestApi.POST('/api/v1/word-tests/uploads', {
      body: { lessonCode, contentType: 'image/jpeg' },
    }),
  )
}

/**
 * 발급받은 주소로 사진을 올린다. S3 서명 주소라 API 클라이언트(쿠키·X-CSRF·refresh)를 거치지 않고,
 * 쿠키도 보내지 않는다. 응답의 headers를 그대로 요청 헤더로(서명에 들어간 값)
 */
export async function putPhoto(ticket: UploadTicket, photo: Blob): Promise<void> {
  const response = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    headers: ticket.headers,
    body: photo,
    credentials: 'omit',
  })
  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: 'UPLOAD_FAILED',
      title: fallbackTitle(500),
    })
  }
}

export function submitPhoto(body: {
  clientSubmissionId: string
  lessonCode: string
  section: WordTestSection
  imageKey: string
}) {
  return unwrap(wordTestApi.POST('/api/v1/word-tests/submissions', { body }))
}

/**
 * 제출 하나의 멱등 키. 같은 사진으로 다시 시도할 때는 같은 값을 쓴다(서버가 같은 제출을 200으로 돌려준다).
 * randomUUID는 보안 출처(https·localhost)에서만 있다 — 폰에서 http://LAN 주소로 개발 서버를 열 때를 위해 대체 경로
 */
export function newSubmissionId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** 올리기 순서(#171): 업로드 주소 발급 → 서명 주소로 PUT → 제출 등록. 어느 단계든 실패하면 그 오류를 던진다 */
export async function sendPhoto(input: {
  lessonCode: string
  section: WordTestSection
  photo: Blob
  clientSubmissionId: string
}) {
  const ticket = await requestUpload(input.lessonCode)
  await putPhoto(ticket, input.photo)
  return submitPhoto({
    clientSubmissionId: input.clientSubmissionId,
    lessonCode: input.lessonCode,
    section: input.section,
    imageKey: ticket.imageKey,
  })
}

// 쿼리 키의 회차 코드는 교재 회차 식별자라 개인 정보가 아니다(wordsApi.ts와 같음). 제출은 숫자 id
export function submissionQuery(id: number) {
  return queryOptions({
    queryKey: ['student', 'wordTest', 'submission', id],
    queryFn: () =>
      unwrap(wordTestApi.GET('/api/v1/word-tests/submissions/{id}', { params: { path: { id } } })),
  })
}

/** 회차의 내 최근 제출. 없으면(204) null */
export function latestQuery(lessonCode: string, section: WordTestSection = SECTION_SPELLING) {
  return queryOptions({
    queryKey: ['student', 'wordTest', 'latest', lessonCode, section],
    queryFn: async (): Promise<WordTestSubmission | null> => {
      const { data, error, response } = await wordTestApi.GET(
        '/api/v1/word-tests/lessons/{lessonCode}/latest',
        { params: { path: { lessonCode }, query: { section } } },
      )
      if (!response.ok) throw toApiError(response, error)
      if (response.status === 204) return null
      return unwrap(Promise.resolve({ data, response }))
    },
  })
}
