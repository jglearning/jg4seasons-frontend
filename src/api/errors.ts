// 서버 오류는 RFC 9457 Problem Details(03 §0.4). 화면은 code로 분기하고 title·detail을 그대로 보여 준다.
// 응답 모양은 생성 타입이 생기면 그 타입으로 좁힌다. 지금은 필요한 필드만 실행 중에 확인해서 꺼낸다.

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly title: string
  readonly detail?: string
  readonly requestId?: string
  readonly until?: string
  readonly fieldErrors: ReadonlyArray<{ field: string; message: string }>

  constructor(init: {
    status: number
    title: string
    code?: string
    detail?: string
    requestId?: string
    until?: string
    fieldErrors?: ReadonlyArray<{ field: string; message: string }>
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
  }
}

const FALLBACK_TITLE = '잠시 후 다시 시도해 주세요'

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

/** 오류 응답 본문(이미 파싱된 값이든 아니든)을 ApiError로 바꾼다. Problem Details가 아니면 상태 코드만 살린다 */
export function toApiError(response: Response, body: unknown): ApiError {
  const problem = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  return new ApiError({
    status: response.status,
    title: str(problem.title) ?? FALLBACK_TITLE,
    code: str(problem.code),
    detail: str(problem.detail),
    requestId: str(problem.requestId) ?? response.headers.get('X-Request-Id') ?? undefined,
    until: str(problem.until),
    fieldErrors: readFieldErrors(problem.errors),
  })
}

/** openapi-fetch 결과에서 data를 꺼내고, 오류면 ApiError를 던진다 */
export async function unwrap<T>(
  result: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await result
  if (!response.ok) throw toApiError(response, error)
  return data as T
}
