import { useCallback, useState, type ReactNode } from 'react'
import { ApiError } from '../../api/errors'
import { errorMessage } from '../../shared/errorMessage'
import { ADMIN_COPY } from './adminCopy'

// 만들기·수정 보내기의 진행·오류 상태. useMutation을 쓰지 않는 이유는 adminApi.ts 머리 주석(요청 값에 비밀번호).
// 오류는 칸 옆(400 VALIDATION의 errors[].field, 또는 칸에 붙일 code)과 폼 아래(그 밖)로 나눠 보인다
export function useSubmit() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const run = useCallback(async <T>(request: () => Promise<T>): Promise<T | undefined> => {
    setPending(true)
    setError(null)
    try {
      return await request()
    } catch (reason) {
      setError(reason)
      return undefined
    } finally {
      setPending(false)
    }
  }, [])

  const apiError = error instanceof ApiError ? error : undefined

  /** 칸 옆 문구: 서버 errors[].field가 이 칸이거나, 이 칸에 붙일 code(예: LOGIN_ID_TAKEN → 아이디 칸) */
  const fieldError = (field: string, codes: string[] = []): string | undefined => {
    const fromField = apiError?.fieldErrors.find((e) => e.field === field)?.message
    if (fromField) return fromField
    if (apiError?.code !== undefined && codes.includes(apiError.code)) {
      return ADMIN_COPY.codes?.[apiError.code] ?? apiError.title
    }
    return undefined
  }

  /** 폼 아래 문구: 칸 옆에 보이지 않은 오류만 */
  const formError = (fields: string[], fieldCodes: string[] = []): ReactNode => {
    if (error === null) return undefined
    if (apiError) {
      if (apiError.fieldErrors.some((e) => fields.includes(e.field))) return undefined
      if (apiError.code !== undefined && fieldCodes.includes(apiError.code)) return undefined
    }
    return errorMessage(error, ADMIN_COPY)
  }

  return { pending, error, run, fieldError, formError }
}
