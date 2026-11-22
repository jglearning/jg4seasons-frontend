import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/errors'
import { StaffLoadState } from './StaffLoadState'

// 교사·관리자·운영자 화면의 못 받은 상태 — "다시 시도"를 보일지는 api/errors의 isPermanentError(#159)
const failed = (error: unknown) => ({
  isError: true,
  error,
  fetchStatus: 'idle',
  refetch: () => {},
})
const problem = (status: number) =>
  new ApiError({ status, code: 'X', title: '서버 문구', isProblem: true })

describe('StaffLoadState', () => {
  it.each([
    [
      '시간 초과',
      new DOMException('늦음', 'TimeoutError'),
      '인터넷 연결을 확인하고 다시 시도해 주세요',
    ],
    ['429', problem(429), '서버 문구'],
    [
      'code 없는 403(앞단 HTML)',
      new ApiError({ status: 403, title: '잠시 후 다시 시도해 주세요' }),
      '잠시 후 다시 시도해 주세요',
    ],
    ['5xx', problem(503), '서버 문구'],
  ] as const)('%s: 문구 + 다시 시도', (_, error, text) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<StaffLoadState query={failed(error)} />)

    expect(screen.getByRole('alert')).toHaveTextContent(text)
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  it('Problem Details 4xx: 문구만, 다시 시도 없음', () => {
    render(<StaffLoadState query={failed(problem(403))} />)

    expect(screen.getByRole('alert')).toHaveTextContent('서버 문구')
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('401: 그리지 않음(세션 만료 이동이 맡음)', () => {
    const { container } = render(
      <StaffLoadState query={failed(new ApiError({ status: 401, title: 't' }))} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
