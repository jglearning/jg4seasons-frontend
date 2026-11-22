import { describe, expect, it } from 'vitest'
import { shouldRetry } from '../app/queryClient'
import { ApiError, isPermanentError, isTimeout, toApiError, unwrap, unwrapVoid } from './errors'

describe('toApiError', () => {
  it('Problem Details의 code·title·detail·until·errors를 꺼낸다', () => {
    const error = toApiError(new Response(null, { status: 423 }), {
      type: 'https://jg4seasons.example/problems/locked',
      title: '잠시 잠겼어요',
      status: 423,
      detail: '10:42에 다시 시도할 수 있어요',
      code: 'LOCKED',
      until: '2026-11-04T01:42:00Z',
      requestId: 'r1',
      errors: [{ field: 'personalCode', message: '숫자 4자리' }, { field: 1 }],
    })

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 423,
      code: 'LOCKED',
      title: '잠시 잠겼어요',
      detail: '10:42에 다시 시도할 수 있어요',
      until: '2026-11-04T01:42:00Z',
      requestId: 'r1',
      fieldErrors: [{ field: 'personalCode', message: '숫자 4자리' }],
      isProblem: true,
    })
  })

  it('본문이 Problem Details가 아니면(예: 게이트웨이 HTML) 상태와 요청 ID만 살린다', () => {
    const error = toApiError(
      new Response(null, { status: 502, headers: { 'X-Request-Id': 'gw-1' } }),
      '<html>Bad Gateway</html>',
    )

    expect(error).toMatchObject({
      status: 502,
      code: undefined,
      title: '잠시 후 다시 시도해 주세요',
      requestId: 'gw-1',
      isProblem: false,
    })
  })

  it('code 없는 응답은 서버 title(프레임워크 기본 영어)·detail 대신 한국어 문구를 쓴다', () => {
    const body = { title: 'Unauthorized', status: 401, detail: 'Full authentication is required' }

    expect(toApiError(new Response(null, { status: 401 }), body)).toMatchObject({
      title: '다시 들어와 주세요',
      detail: undefined,
    })
  })

  it('code 없는 401 밖의 4xx(CloudFront·WAF HTML)는 우리 서버 답이 아니라 "잠시 후 다시"(#159)', () => {
    for (const status of [403, 404, 413, 429]) {
      expect(toApiError(new Response(null, { status }), '<html>Forbidden</html>').title).toBe(
        '잠시 후 다시 시도해 주세요',
      )
    }
  })

  it('code 있는 응답에 title이 없으면 상태별 문구', () => {
    expect(toApiError(new Response(null, { status: 403 }), { code: 'FORBIDDEN' }).title).toBe(
      '이 화면을 볼 수 없어요',
    )
    expect(toApiError(new Response(null, { status: 404 }), { code: 'NOT_FOUND' }).title).toBe(
      '찾을 수 없어요',
    )
  })

  it('쿼리 재시도 정책과 이어진다: Problem Details 4xx는 재시도하지 않고 5xx는 한 번 한다', () => {
    expect(shouldRetry(0, toApiError(new Response(null, { status: 401 }), {}))).toBe(false)
    expect(
      shouldRetry(0, toApiError(new Response(null, { status: 404 }), { code: 'NOT_FOUND' })),
    ).toBe(false)
    expect(shouldRetry(0, toApiError(new Response(null, { status: 503 }), {}))).toBe(true)
  })
})

describe('isTimeout', () => {
  it('시간 제한으로 끊은 요청(TimeoutError)만', () => {
    expect(isTimeout(new DOMException('늦음', 'TimeoutError'))).toBe(true)
    expect(isTimeout(new DOMException('취소', 'AbortError'))).toBe(false)
    expect(isTimeout(new TypeError('Failed to fetch'))).toBe(false)
  })
})

// 다시 보내도 같은 결과인 오류인가 — 재시도 정책·화면 판정이 함께 쓴다(#159)
describe('isPermanentError', () => {
  const problem = (status: number, code = 'X') =>
    new ApiError({ status, code, title: 't', isProblem: true })
  const notProblem = (status: number) => new ApiError({ status, title: 't' })

  it.each([
    ['Problem Details 400', problem(400), true],
    ['Problem Details 403', problem(403), true],
    ['Problem Details 404', problem(404), true],
    ['Problem Details 423', problem(423, 'LESSON_LOCKED'), true],
    ['401(Problem Details든 아니든 — 세션 흐름이 맡음)', notProblem(401), true],
    ['Problem Details 408', problem(408), false],
    ['Problem Details 429', problem(429, 'RATE_LIMITED'), false],
    ['code 없는 403(WAF HTML 등)', notProblem(403), false],
    ['code 없는 404', notProblem(404), false],
    ['5xx', problem(503), false],
    ['시간 초과', new DOMException('늦음', 'TimeoutError'), false],
    ['연결 실패', new TypeError('Failed to fetch'), false],
    ['알 수 없는 오류', new Error('x'), false],
  ] as const)('%s', (_, error, expected) => {
    expect(isPermanentError(error)).toBe(expected)
  })
})

describe('unwrap', () => {
  it('성공이면 data를 돌려준다', async () => {
    await expect(
      unwrap(Promise.resolve({ data: { id: 1 }, response: new Response(null, { status: 200 }) })),
    ).resolves.toEqual({ id: 1 })
  })

  it('실패면 ApiError를 던진다', async () => {
    await expect(
      unwrap(
        Promise.resolve({
          error: { code: 'INVALID_CREDENTIALS', title: '코드를 확인해 주세요' },
          response: new Response(null, { status: 401 }),
        }),
      ),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' })
  })

  it('성공인데 본문이 없으면(204 등) 데이터 대신 EMPTY_RESPONSE 오류', async () => {
    await expect(
      unwrap(Promise.resolve({ data: undefined, response: new Response(null, { status: 204 }) })),
    ).rejects.toMatchObject({ status: 204, code: 'EMPTY_RESPONSE' })
  })
})

describe('unwrapVoid', () => {
  it('본문 없는 성공은 그대로 끝나고, 실패는 ApiError', async () => {
    await expect(
      unwrapVoid(Promise.resolve({ response: new Response(null, { status: 204 }) })),
    ).resolves.toBeUndefined()
    await expect(
      unwrapVoid(Promise.resolve({ error: {}, response: new Response(null, { status: 500 }) })),
    ).rejects.toMatchObject({ status: 500 })
  })
})
