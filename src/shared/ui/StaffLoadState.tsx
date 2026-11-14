import { ApiError } from '../../api/errors'
import { errorMessage, NETWORK_MESSAGE } from '../errorMessage'
import { Button } from './Button'
import styles from './StaffLoadState.module.css'

// 교사·관리자·운영자 화면에서 목록·상세를 아직 못 받았을 때(불러오는 중·오프라인·실패).
// 401은 세션 만료 이동이 처리, 4xx는 다시 해도 같으니 문구만, 그 밖은 "다시 시도"
type LoadQuery = { isError: boolean; error: unknown; fetchStatus: string; refetch: () => unknown }

export function StaffLoadState({ query }: { query: LoadQuery }) {
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
