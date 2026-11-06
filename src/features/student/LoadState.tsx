import type { UseQueryResult } from '@tanstack/react-query'
import { ApiError } from '../../api/errors'
import { errorMessage, NETWORK_MESSAGE } from '../../shared/errorMessage'
import { Button, ButtonLink } from '../../shared/ui/Button'
import styles from './Student.module.css'

// 화면 데이터가 아직 없을 때(로딩·오프라인·실패) 보일 것
// - 오프라인: TanStack Query가 요청을 멈춘 채(paused) 오류를 내지 않는다 → 연결 문구. 연결되면 저절로 다시 받는다
// - 401: 세션 만료 처리가 입장 화면으로 보내므로 그리지 않는다
// - 그 밖 4xx: 다시 보내도 같다 → 문구 + (있으면) 홈으로
// - 5xx·네트워크: 문구 + 다시 시도
// - 로딩 중: 아무것도 그리지 않는다(빈 값으로 "수업 없음"을 잘못 보이지 않게)
type LoadStateProps = {
  query: Pick<
    UseQueryResult<unknown>,
    'isError' | 'error' | 'fetchStatus' | 'refetch' | 'isFetching'
  >
  homeLink?: boolean
}

export function LoadState({ query, homeLink = false }: LoadStateProps) {
  if (!query.isError) {
    if (query.fetchStatus !== 'paused') return null
    return (
      <div className={styles.failed}>
        <p role="alert" className={styles.failedText}>
          {NETWORK_MESSAGE}
        </p>
      </div>
    )
  }

  const status = query.error instanceof ApiError ? query.error.status : undefined
  if (status === 401) return null
  const clientError = status !== undefined && status >= 400 && status < 500

  return (
    <div className={styles.failed}>
      <p role="alert" className={styles.failedText}>
        {errorMessage(query.error)}
      </p>
      {clientError ? (
        homeLink && (
          <ButtonLink to="/" variant="secondary">
            홈으로
          </ButtonLink>
        )
      ) : (
        <Button
          variant="secondary"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          다시 시도
        </Button>
      )}
    </div>
  )
}
