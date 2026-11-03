import { QueryClient } from '@tanstack/react-query'

// 4xx(Problem Details의 status)는 다시 보내도 같은 결과라 재시도하지 않는다.
// 401의 refresh는 API 클라이언트가 맡는다
function isClientError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('status' in error)) return false
  const { status } = error
  return typeof status === 'number' && status >= 400 && status < 500
}

export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !isClientError(error) && failureCount < 1
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
