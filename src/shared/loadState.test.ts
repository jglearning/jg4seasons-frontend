import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/errors'
import { loadStateOf, useServerErrorLog, type LoadQuery } from './loadState'

// 받기 전·못 받은 상태 판정(S-05·S-06 공용, #154) — 화면 테스트로는 닿기 어려운 분기까지 표로

function query(over: Partial<LoadQuery>): LoadQuery {
  return { isError: false, error: null, fetchStatus: 'idle', refetch: () => {}, ...over }
}
function apiError(status: number, code?: string) {
  return new ApiError({ status, code, title: 't', isProblem: true, requestId: 'req-1' })
}
const failed = (error: unknown, fetchStatus = 'idle') =>
  query({ isError: true, error, fetchStatus })

describe('loadStateOf', () => {
  it.each([
    ['처음 받는 중', query({ fetchStatus: 'fetching' }), 'loading'],
    ['아직 결과 없음(idle)', query({}), 'loading'],
    ['오류 뒤 다시 받는 중', failed(apiError(500), 'fetching'), 'loading'],
    ['오프라인으로 멈춤 — 오류보다 먼저', failed(apiError(500), 'paused'), 'offline'],
    ['연결 오류(TypeError)', failed(new TypeError('Failed to fetch')), 'offline'],
    ['알 수 없는 오류', failed(new Error('x')), 'server'],
    ['오류 객체가 아닌 값', failed('문자열'), 'server'],
    ['401 — 세션 만료 이동이 맡음', failed(apiError(401, 'UNAUTHORIZED')), 'none'],
    ['423 LESSON_LOCKED', failed(apiError(423, 'LESSON_LOCKED')), 'locked'],
    ['403 LICENSE_INACTIVE', failed(apiError(403, 'LICENSE_INACTIVE')), 'license'],
    ['403 그 밖', failed(apiError(403, 'FORBIDDEN')), 'client'],
    ['404', failed(apiError(404, 'NOT_FOUND')), 'client'],
    ['500', failed(apiError(500, 'INTERNAL')), 'server'],
    ['503', failed(apiError(503)), 'server'],
    [
      '시간 초과 — 느린 망인지 멈춘 서버인지 몰라 서버 오류 안내(#159)',
      failed(new DOMException('늦음', 'TimeoutError')),
      'server',
    ],
    ['408 — 다시 하면 풀림(#159)', failed(apiError(408, 'TIMEOUT')), 'server'],
    ['429 — 다시 하면 풀림(#159)', failed(apiError(429, 'RATE_LIMITED')), 'server'],
    [
      'code 없는 403(WAF HTML) — 우리 서버 답이 아님(#159)',
      failed(new ApiError({ status: 403, title: 't' })),
      'server',
    ],
    ['code 없는 404(#159)', failed(new ApiError({ status: 404, title: 't' })), 'server'],
  ] as const)('%s', (_, q, expected) => {
    expect(loadStateOf(q)).toBe(expected)
  })
})

describe('useServerErrorLog', () => {
  it('server가 아니면 기록하지 않는다', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderHook(() => useServerErrorLog('client', apiError(404)))
    renderHook(() => useServerErrorLog('offline', new TypeError('x')))
    expect(logged).not.toHaveBeenCalled()
  })

  it('ApiError는 상태·code·requestId만', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderHook(() => useServerErrorLog('server', apiError(500, 'INTERNAL')))
    expect(logged).toHaveBeenCalledTimes(1)
    expect(logged).toHaveBeenCalledWith('[api]', {
      status: 500,
      code: 'INTERNAL',
      requestId: 'req-1',
    })
  })

  it('시간 초과(DOMException)도 이름 — jsdom의 DOMException은 Error의 하위 클래스가 아니다(#159)', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderHook(() => useServerErrorLog('server', new DOMException('응답이 늦어요', 'TimeoutError')))
    expect(logged).toHaveBeenCalledWith('[api]', { name: 'TimeoutError' })
  })

  it('그 밖의 오류는 이름만 — 메시지에 응답 본문 조각이 섞일 수 있어서(개인정보 규칙)', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderHook(() =>
      useServerErrorLog(
        'server',
        new SyntaxError('Unexpected token \'<\', "<!doctype "... is not valid JSON'),
      ),
    )
    expect(logged).toHaveBeenCalledWith('[api]', { name: 'SyntaxError' })
  })
})
