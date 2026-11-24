import { queryOptions } from '@tanstack/react-query'
import { api } from '../../../api'
import { ApiError, fallbackTitle, toApiError, unwrap } from '../../../api/errors'
import type { components } from '../../../api/generated/schema'

// 단어시험 사진 채점 1단계(시연용, #171). 학생 API — 업로드 주소 발급 → S3에 PUT → 제출 → 상태 조회.
// 타입은 생성 타입(BE #71, #179에서 손 선언을 교체). 아래 이름은 화면·목·테스트가 쓰는 별칭

type Schemas = components['schemas']

export type WordTestSubmission = Schemas['WordTestSubmission']
export type WordTestItem = Schemas['WordTestItemResult']
export type UploadTicket = Schemas['WordTestUploadResponse']
export type WordTestSection = WordTestSubmission['section']
/** 1단계에 실제로 오는 값은 pending · grading · graded · failed. confirming · rejected는 2단계 */
export type WordTestStatus = WordTestSubmission['status']
/** unclear: 글자가 흐려 판단 못 한 문항(score에 들어가지 않음, total에는 포함 — BE #71) */
export type WordTestResult = WordTestItem['result']

/** 이번에 만드는 영역(B 철자 쓰기). 값으로 다뤄 나중에 영역을 늘린다 */
export const SECTION_SPELLING: WordTestSection = 'B'

/**
 * 조회를 멈출 상태 — 채점이 도는 중(pending·grading)이 아닌 모든 값.
 * graded·failed는 끝, confirming·rejected(2단계)와 모르는 값은 서버가 혼자 넘어가지 않을 수 있어
 * 주기 조회(POLL_MS)를 계속하면 화면에 갇힌다(#171 안전장치). 다시 들어오면 최근 제출로 이어 간다
 */
export function isSettled(status: WordTestStatus): boolean {
  return status !== 'pending' && status !== 'grading'
}

export function requestUpload(lessonCode: string) {
  return unwrap(
    api.POST('/api/v1/word-tests/uploads', {
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
  return unwrap(api.POST('/api/v1/word-tests/submissions', { body }))
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
      unwrap(api.GET('/api/v1/word-tests/submissions/{id}', { params: { path: { id } } })),
  })
}

/** 회차의 내 최근 제출. 없으면(204) null */
export function latestQuery(lessonCode: string, section: WordTestSection = SECTION_SPELLING) {
  return queryOptions({
    queryKey: ['student', 'wordTest', 'latest', lessonCode, section],
    queryFn: async (): Promise<WordTestSubmission | null> => {
      const { data, error, response } = await api.GET(
        '/api/v1/word-tests/lessons/{lessonCode}/latest',
        { params: { path: { lessonCode }, query: { section } } },
      )
      if (!response.ok) throw toApiError(response, error)
      if (response.status === 204) return null
      return unwrap(Promise.resolve({ data, response }))
    },
  })
}
