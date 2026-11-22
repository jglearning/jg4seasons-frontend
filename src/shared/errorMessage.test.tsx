import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/errors'
import { errorMessage, type Copy } from './errorMessage'

const COPY: Copy = { unlockAt: (time) => `${time}부터 다시 할 수 있어요` }

function locked(until: string | undefined) {
  return new ApiError({
    status: 423,
    code: 'LOCKED',
    title: '잠시 후 다시 시도해 주세요',
    detail: '잠시 쉬었다가 다시 시도해 주세요',
    until,
    isProblem: true,
  })
}

function shown(error: unknown) {
  const { container } = render(<p>{errorMessage(error, COPY)}</p>)
  return container.textContent
}

describe('errorMessage — LOCKED 해제 시각', () => {
  it.each([
    ['2026-11-11T06:42:00Z', '오후 3시 42분'],
    ['2026-11-10T15:05:00Z', '오전 12시 5분'],
    ['2026-11-11T03:00:00Z', '오후 12시'],
    ['2026-11-11T14:59:00Z', '오후 11시 59분'],
    ['2026-11-11T15:42:00+09:00', '오후 3시 42분'],
  ])('until %s → 한국 시간 "%s"', (until, time) => {
    expect(shown(locked(until))).toBe(`잠시 후 다시 시도해 주세요${time}부터 다시 할 수 있어요`)
  })

  it.each([undefined, 'not-a-date'])('until이 %s면 서버 detail을 그대로 보인다', (until) => {
    expect(shown(locked(until))).toBe('잠시 후 다시 시도해 주세요잠시 쉬었다가 다시 시도해 주세요')
  })

  it('화면이 시각 문구를 정하지 않았으면 detail을 보인다', () => {
    render(<p>{errorMessage(locked('2026-11-11T06:42:00Z'))}</p>)
    expect(screen.getByText(/잠시 쉬었다가/)).toBeInTheDocument()
  })

  it('LOCKED가 아닌 오류의 until은 쓰지 않는다', () => {
    const error = new ApiError({
      status: 429,
      code: 'RATE_LIMITED',
      title: '너무 많이 시도했어요',
      detail: '1분 뒤에 다시 시도해 주세요',
      until: '2026-11-11T06:42:00Z',
      isProblem: true,
    })
    expect(shown(error)).toBe('너무 많이 시도했어요1분 뒤에 다시 시도해 주세요')
  })
})

describe('errorMessage — 기록', () => {
  it('우리 서버 답이 아닌 4xx(앞단 HTML)는 5xx처럼 상태·requestId를 기록한다(#159)', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    errorMessage(
      new ApiError({ status: 403, title: '잠시 후 다시 시도해 주세요', requestId: 'cf-1' }),
    )
    expect(logged).toHaveBeenCalledWith('[api]', {
      status: 403,
      code: undefined,
      requestId: 'cf-1',
    })
  })

  it('Problem Details 4xx와 code 없는 401은 기록하지 않는다(서버가 정한 결과·세션 흐름)', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    errorMessage(new ApiError({ status: 404, code: 'NOT_FOUND', title: 't', isProblem: true }))
    errorMessage(new ApiError({ status: 401, title: 't' }))
    expect(logged).not.toHaveBeenCalled()
  })

  it('시간 초과는 연결 문구, 기록 없음', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(shown(new DOMException('늦음', 'TimeoutError'))).toBe(
      '인터넷 연결을 확인하고 다시 시도해 주세요',
    )
    expect(logged).not.toHaveBeenCalled()
  })
})
