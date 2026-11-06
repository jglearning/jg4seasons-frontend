import { useQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router'
import { meQuery } from '../../api/session'
import styles from './Admin.module.css'

// 관리자(admin·superadmin)만 들어오는 화면(A-01~A-04). 세션 확인은 바깥 RequireSession이 이미 했다 —
// 여기서는 역할만 본다. 교사가 주소로 들어오면 안내만(서버도 403)
export function AdminOnly() {
  const me = useQuery(meQuery)
  if (me.data === undefined) return null
  if (me.data.role !== 'admin' && me.data.role !== 'superadmin') {
    return (
      <p className={styles.notice} role="alert">
        관리자만 볼 수 있는 화면입니다
      </p>
    )
  }
  return <Outlet />
}
