import { useQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router'
import { meQuery } from '../../api/session'
import styles from './Admin.module.css'

// 학원 관리자(admin)만 들어오는 화면(A-01~A-05). 세션·영역은 바깥 RequireSession(staff)이 이미 확인했다 —
// 여기서는 교사인지만 본다. 교사가 주소로 들어오면 안내만(서버도 403).
// 운영자(superadmin)는 학원이 없어 학원 화면 API가 모두 403 — RequireSession이 운영자 화면으로 보낸다(BE #48)
export function AdminOnly() {
  const me = useQuery(meQuery)
  if (me.data === undefined) return null
  if (me.data.role !== 'admin') {
    return (
      <p className={styles.notice} role="alert">
        관리자만 볼 수 있는 화면입니다
      </p>
    )
  }
  return <Outlet />
}
