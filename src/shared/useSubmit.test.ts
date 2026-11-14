import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/errors'
import { useSubmit } from './useSubmit'

function apiError(
  status: number,
  init: { code: string; fieldErrors?: { field: string; message: string }[] },
) {
  return new ApiError({ status, title: '서버 문구', isProblem: true, ...init })
}

async function failWith(error: unknown, copy?: Parameters<typeof useSubmit>[0]) {
  const { result } = renderHook(() => useSubmit(copy))
  await act(async () => {
    await result.current.run(() => Promise.reject(error))
  })
  return result
}

describe('useSubmit — 칸 옆과 폼 아래로 오류 나누기', () => {
  it('400 errors[].field는 그 칸 옆에만, 폼 아래는 비움', async () => {
    const result = await failWith(
      apiError(400, {
        code: 'VALIDATION',
        fieldErrors: [{ field: 'slug', message: '소문자·숫자·-만' }],
      }),
    )
    expect(result.current.fieldError('slug')).toBe('소문자·숫자·-만')
    expect(result.current.fieldError('name')).toBeUndefined()
    expect(result.current.formError(['slug', 'name'])).toBeUndefined()
  })

  it('칸에 붙일 code는 copy 문구로 칸 옆에(없으면 서버 title)', async () => {
    const copy = { codes: { LOGIN_ID_TAKEN: '이미 쓰는 아이디입니다' } }
    const result = await failWith(apiError(409, { code: 'LOGIN_ID_TAKEN' }), copy)
    expect(result.current.fieldError('loginId', ['LOGIN_ID_TAKEN'])).toBe('이미 쓰는 아이디입니다')
    expect(result.current.formError(['loginId'], ['LOGIN_ID_TAKEN'])).toBeUndefined()

    const bare = await failWith(apiError(409, { code: 'ACADEMY_SLUG_TAKEN' }))
    expect(bare.current.fieldError('slug', ['ACADEMY_SLUG_TAKEN'])).toBe('서버 문구')
  })

  it('칸에 붙지 않는 오류는 폼 아래에 copy 문구로, reset이면 지움', async () => {
    const copy = { codes: { FORBIDDEN: '관리자만 할 수 있습니다' } }
    const result = await failWith(apiError(403, { code: 'FORBIDDEN' }), copy)
    expect(result.current.formError(['name'])).toBe('관리자만 할 수 있습니다')
    act(() => result.current.reset())
    expect(result.current.formError(['name'])).toBeUndefined()
  })

  it('진행 중에 다시 부르면 요청을 보내지 않는다(렌더 전에 들어온 두 번째 클릭)', async () => {
    const { result } = renderHook(() => useSubmit())
    let finish: (value: number) => void = () => {}
    const request = vi.fn(() => new Promise<number>((resolve) => (finish = resolve)))
    let first: Promise<number | undefined> | undefined
    let second: number | undefined = -1
    await act(async () => {
      // 같은 렌더의 run을 두 번 — pending은 아직 false
      first = result.current.run(request)
      second = await result.current.run(request)
    })
    expect(request).toHaveBeenCalledTimes(1)
    expect(second).toBeUndefined()
    await act(async () => {
      finish(7)
      expect(await first).toBe(7)
    })
    // 끝난 뒤에는 다시 보낼 수 있다
    const again = vi.fn(() => Promise.resolve(1))
    await act(async () => {
      expect(await result.current.run(again)).toBe(1)
    })
    expect(again).toHaveBeenCalledTimes(1)
  })

  it('성공하면 결과를 돌려주고 진행 중이 풀림', async () => {
    const { result } = renderHook(() => useSubmit())
    let value: number | undefined
    await act(async () => {
      value = await result.current.run(() => Promise.resolve(7))
    })
    expect(value).toBe(7)
    expect(result.current.pending).toBe(false)
    expect(result.current.error).toBeNull()
  })
})
