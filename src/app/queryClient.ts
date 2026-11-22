import { QueryClient } from '@tanstack/react-query'
import { isPermanentError, isTimeout } from '../api/errors'

// 다시 보내도 같은 오류(Problem Details 4xx·401)는 재시도하지 않는다 — 판정은 api/errors의 isPermanentError.
// 시간 초과도 재시도하지 않는다: 이미 10초를 기다렸고, 한 번 더 하면 20초 동안 뼈대만 보인다(#159).
// 401의 refresh는 API 클라이언트가 맡는다
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !isPermanentError(error) && !isTimeout(error) && failureCount < 1
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
      },
    },
  })
}
