import { useCallback, useState, type ReactNode } from 'react'
import { ApiError } from '../../api/errors'
import { errorMessage } from '../../shared/errorMessage'

// 버튼 요청(진도표 바꾸기·휴강·개인 코드 재발급)의 진행·오류 상태. 관리자 useSubmit과 같은 규칙 —
// 기능 폴더끼리 import하지 않아 따로 둔다. 결과를 캐시에 넣지 않으려고 useMutation을 쓰지 않는다(개인 코드)
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

  /** 칸 옆 문구: 서버 errors[].field가 이 칸일 때 */
  const fieldError = (field: string): string | undefined =>
    apiError?.fieldErrors.find((e) => e.field === field)?.message

  /** 폼 아래 문구: 칸 옆에 보이지 않은 오류만 */
  const formError = (fields: string[]): ReactNode => {
    if (error === null) return undefined
    if (apiError?.fieldErrors.some((e) => fields.includes(e.field))) return undefined
    return errorMessage(error)
  }

  const reset = useCallback(() => setError(null), [])

  return { pending, run, fieldError, formError, reset }
}
