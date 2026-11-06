import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { ApiError } from '../../api/errors'
import { Button } from '../../shared/ui/Button'
import { isStaffRole, meQuery } from '../../api/session'
import { entryPathFor } from './entry'
import { errorMessage, NETWORK_MESSAGE } from '../../shared/errorMessage'
import styles from './RequireSession.module.css'

type Area = 'student' | 'staff'

// 로그인한 사람만 들어오는 경로를 감싼다(GET /me, AUTH-03).
// 세션이 없으면 /me 401 → refresh 1회. refresh가 401·403이면 API 클라이언트가 입장 화면으로 보낸다
// (규칙은 src/api/authFetch.ts 머리 주석). 5xx·네트워크 오류는 아래 "다시 시도"를 보인다.
// 역할이 맞지 않는 영역이면 그 역할의 첫 화면으로 보낸다
export function RequireSession({ area }: { area: Area }) {
  const me = useQuery(meQuery)
  const { pathname } = useLocation()

  // 이미 받은 세션이 있으면 백그라운드 재조회가 실패해도(배포 중 5xx 등) 보던 화면을 그대로 둔다
  if (me.data !== undefined) {
    const staff = isStaffRole(me.data.role)
    if (area === 'student' && staff) return <Navigate to="/teacher" replace />
    if (area === 'staff' && !staff) return <Navigate to="/" replace />
    return <Outlet />
  }
  if (!me.isError) {
    // 오프라인이면 TanStack Query가 요청을 멈춘 채(paused) 오류를 내지 않는다 → 빈 화면 대신 연결 문구.
    // 연결되면 저절로 다시 받는다
    if (me.fetchStatus !== 'paused') return null
    return (
      <main className={styles.page}>
        <p className={styles.message} role="alert">
          {NETWORK_MESSAGE}
        </p>
      </main>
    )
  }

  const status = me.error instanceof ApiError ? me.error.status : undefined
  // 401은 이미 입장 화면으로 가는 중이다
  if (status === 401) return null
  // 그 밖의 4xx(예: 403)는 다시 해도 같다 → 입장 화면으로 가는 길을 준다
  const clientError = status !== undefined && status >= 400 && status < 500

  return (
    <main className={styles.page}>
      <p className={styles.message} role="alert">
        {errorMessage(me.error)}
      </p>
      {clientError ? (
        <Link to={entryPathFor(pathname)} className={styles.link}>
          다시 들어가기
        </Link>
      ) : (
        <Button
          variant="secondary"
          size={area === 'staff' ? 'teacher' : 'student'}
          onClick={() => void me.refetch()}
          disabled={me.isFetching}
        >
          다시 시도
        </Button>
      )}
    </main>
  )
}
