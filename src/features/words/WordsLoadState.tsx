import { ApiError } from '../../api/errors'
import { errorMessage, NETWORK_MESSAGE } from '../../shared/errorMessage'
import { Button, ButtonLink } from '../../shared/ui/Button'
import styles from './Words.module.css'

// 단어를 못 받았을 때(S-06·S-06b 공통). 401은 세션 만료 이동이 처리하므로 그리지 않는다.
// 4xx(잠김 423 등)는 다시 시도 대신 회차 목록으로, 그 밖은 다시 시도
type LoadQuery = { isError: boolean; error: unknown; fetchStatus: string; refetch: () => unknown }

export function WordsLoadState({ query }: { query: LoadQuery }) {
  if (!query.isError) {
    if (query.fetchStatus !== 'paused') return null
    return (
      <p className={styles.loadMessage} role="alert">
        {NETWORK_MESSAGE}
      </p>
    )
  }
  const status = query.error instanceof ApiError ? query.error.status : undefined
  if (status === 401) return null
  const clientError = status !== undefined && status >= 400 && status < 500
  return (
    <div className={styles.load}>
      <p className={styles.loadMessage} role="alert">
        {errorMessage(query.error)}
      </p>
      {clientError ? (
        <ButtonLink to="/lessons" variant="secondary">
          회차 목록으로
        </ButtonLink>
      ) : (
        <Button variant="secondary" onClick={() => void query.refetch()}>
          다시 시도
        </Button>
      )}
    </div>
  )
}
