import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../api/errors'
import { errorMessage, STUDENT_COPY } from './errorMessage'

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
  const { container } = render(<p>{errorMessage(error, STUDENT_COPY)}</p>)
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
