// 서버 오류는 RFC 9457 Problem Details(03 §0.4). 화면은 code로 분기하고 title·detail을 그대로 보여 준다.
// 응답 모양은 생성 타입이 생기면 그 타입으로 좁힌다. 지금은 필요한 필드만 실행 중에 확인해서 꺼낸다.
// code가 없는 응답(게이트웨이 HTML, 프레임워크 기본 오류의 영어 title 등)은 상태별 한국어 문구를 쓴다.

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly title: string
  readonly detail?: string
  readonly requestId?: string
  readonly until?: string
  readonly fieldErrors: ReadonlyArray<{ field: string; message: string }>
  /** 본문이 우리 Problem Details(code 있음)였는지 — 화면에는 쓰지 않고 원인을 가를 때 본다 */
  readonly isProblem: boolean

  constructor(init: {
    status: number
    title: string
    code?: string
    detail?: string
    requestId?: string
    until?: string
    fieldErrors?: ReadonlyArray<{ field: string; message: string }>
    isProblem?: boolean
  }) {
    super(init.detail ?? init.title)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.title = init.title
    this.detail = init.detail
    this.requestId = init.requestId
    this.until = init.until
    this.fieldErrors = init.fieldErrors ?? []
    this.isProblem = init.isProblem ?? false
  }
}

export function fallbackTitle(status: number): string {
  if (status === 401) return '다시 들어와 주세요'
  if (status === 403) return '이 화면을 볼 수 없어요'
  if (status === 404) return '찾을 수 없어요'
  if (status >= 400 && status < 500) return '요청을 처리하지 못했어요'
  return '잠시 후 다시 시도해 주세요'
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function readFieldErrors(value: unknown): Array<{ field: string; message: string }> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return []
    const field = str((item as Record<string, unknown>).field)
    const message = str((item as Record<string, unknown>).message)
    return field && message ? [{ field, message }] : []
  })
}

function requestIdOf(
  response: Response,
  problem: Record<string, unknown> = {},
): string | undefined {
  return str(problem.requestId) ?? response.headers.get('X-Request-Id') ?? undefined
}

/** 시간 제한으로 끊은 요청인지(fetch는 abort 이유를 그대로 던진다 — authFetch의 GET 제한, 들어가기 화면의 제한) */
export function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError'
}

/**
 * 다시 보내도 같은 결과인 오류인가 — 쿼리 재시도 정책과 화면의 "다시 시도" 여부가 이 함수 하나로 정한다.
 * 우리 서버는 모든 오류를 code 있는 Problem Details로 답한다(백엔드 ADR-17). 그래서 code 없는 4xx는
 * 앞단(CloudFront·WAF)의 답으로 보고 다시 해 볼 수 있는 쪽에 둔다. 408·429는 기다리면 풀린다.
 * 401은 세션 흐름(authFetch refresh → 입장 화면)이 맡으므로 본문과 상관없이 여기서 멈춘다
 */
export function isPermanentError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  if (error.status === 401) return true
  if (!error.isProblem) return false
  if (error.status === 408 || error.status === 429) return false
  return error.status >= 400 && error.status < 500
}

/** 오류 응답 본문(이미 파싱된 값이든 아니든)을 ApiError로 바꾼다 */
export function toApiError(response: Response, body: unknown): ApiError {
  const problem = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const code = str(problem.code)
  if (code === undefined) {
    // code 없는 4xx는 앞단의 답(isPermanentError 머리 주석) — "볼 수 없어요"처럼 굳은 문구 대신 다시 해 보라고
    return new ApiError({
      status: response.status,
      title: fallbackTitle(response.status === 401 ? 401 : 500),
      requestId: requestIdOf(response, problem),
    })
  }
  return new ApiError({
    status: response.status,
    code,
    title: str(problem.title) ?? fallbackTitle(response.status),
    detail: str(problem.detail),
    requestId: requestIdOf(response, problem),
    until: str(problem.until),
    fieldErrors: readFieldErrors(problem.errors),
    isProblem: true,
  })
}

/** 성공인데 JSON이 아닌 본문(배포 설정 실수로 받은 HTML 등) */
export function badResponseError(response: Response): ApiError {
  return new ApiError({
    status: response.status,
    code: 'BAD_RESPONSE',
    title: fallbackTitle(500),
    requestId: requestIdOf(response),
  })
}

type Result<T> = Promise<{ data?: T; error?: unknown; response: Response }>

/** openapi-fetch 결과에서 data를 꺼낸다. 오류면 ApiError, 본문이 있어야 하는데 없으면 EMPTY_RESPONSE */
export async function unwrap<T>(result: Result<T>): Promise<T> {
  const { data, error, response } = await result
  if (!response.ok) throw toApiError(response, error)
  if (data === undefined) {
    throw new ApiError({
      status: response.status,
      code: 'EMPTY_RESPONSE',
      title: fallbackTitle(500),
      requestId: requestIdOf(response),
    })
  }
  return data
}

/** 본문 없는 성공(204 등)을 기대하는 호출 */
export async function unwrapVoid(result: Result<unknown>): Promise<void> {
  const { error, response } = await result
  if (!response.ok) throw toApiError(response, error)
}
