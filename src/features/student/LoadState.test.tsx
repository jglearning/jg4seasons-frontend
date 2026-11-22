import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/errors'
import { LoadState } from './LoadState'

// S-03·S-04의 못 받은 상태 — "다시 시도"를 보일지는 api/errors의 isPermanentError(#159)
const failed = (error: Error) => ({
  isError: true,
  error,
  fetchStatus: 'idle' as const,
  isFetching: false,
  refetch: () => Promise.resolve() as never,
})
const problem = (status: number) =>
  new ApiError({ status, code: 'X', title: '서버 문구', isProblem: true })

function renderState(error: Error) {
  return render(
    <MemoryRouter>
      <LoadState query={failed(error)} homeLink />
    </MemoryRouter>,
  )
}

describe('학생 LoadState', () => {
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
  ] as const)('%s: 문구 + 다시 시도, 홈으로 없음', (_, error, text) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderState(error)

    expect(screen.getByRole('alert')).toHaveTextContent(text)
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '홈으로' })).not.toBeInTheDocument()
  })

  it('Problem Details 4xx: 문구 + 홈으로, 다시 시도 없음', () => {
    renderState(problem(404))

    expect(screen.getByRole('alert')).toHaveTextContent('서버 문구')
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })
})
