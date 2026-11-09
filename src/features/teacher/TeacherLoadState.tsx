import { ApiError } from '../../api/errors'
import { errorMessage, NETWORK_MESSAGE } from '../../shared/errorMessage'
import { Button } from '../../shared/ui/Button'
import styles from './Teacher.module.css'

// 목록·매트릭스를 못 받았을 때. 관리자 화면의 AdminLoadState와 같은 규칙 — 기능 폴더끼리 import하지 않아 따로 둔다.
// 401은 세션 만료 이동이 처리, 4xx는 다시 해도 같으니 문구만
type LoadQuery = { isError: boolean; error: unknown; fetchStatus: string; refetch: () => unknown }

export function TeacherLoadState({ query }: { query: LoadQuery }) {
  if (!query.isError) {
    if (query.fetchStatus === 'paused') {
      return (
        <p className={styles.notice} role="alert">
          {NETWORK_MESSAGE}
        </p>
      )
    }
    return <p className={styles.loading}>불러오는 중</p>
  }
  const status = query.error instanceof ApiError ? query.error.status : undefined
  if (status === 401) return null
  const clientError = status !== undefined && status >= 400 && status < 500
  return (
    <div className={styles.loadError}>
      <p className={styles.notice} role="alert">
        {errorMessage(query.error)}
      </p>
      {!clientError && (
        <Button variant="secondary" size="teacher" onClick={() => void query.refetch()}>
          다시 시도
        </Button>
      )}
    </div>
  )
}
