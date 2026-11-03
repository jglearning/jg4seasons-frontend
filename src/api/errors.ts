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

/** 오류 응답 본문(이미 파싱된 값이든 아니든)을 ApiError로 바꾼다 */
export function toApiError(response: Response, body: unknown): ApiError {
  const problem = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const code = str(problem.code)
  if (code === undefined) {
    return new ApiError({
      status: response.status,
      title: fallbackTitle(response.status),
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
