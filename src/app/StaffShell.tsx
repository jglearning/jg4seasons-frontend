import { useQuery } from '@tanstack/react-query'
import { Outlet } from 'react-router'
import { meQuery } from '../api/session'
import { StaffLayout, type StaffNavItem } from '../shared/ui/StaffLayout'

// 교사·관리자 화면 틀. 메뉴는 역할로 고른다(관리 메뉴는 관리자만 — 화면·서버도 따로 막는다).
// 세션은 바깥 RequireSession(staff)이 이미 확인했다
const TEACHER_NAV: StaffNavItem[] = [{ to: '/teacher', label: '반 목록' }]
const ADMIN_NAV: StaffNavItem[] = [
  ...TEACHER_NAV,
  { to: '/admin/classes', label: '반 관리' },
  { to: '/admin/teachers', label: '교사 관리' },
]
const ROLE_LABEL = {
  teacher: '교사',
  admin: '관리자',
  superadmin: '운영자',
  student: '학생',
} as const

export function StaffShell() {
  const me = useQuery(meQuery)
  const role = me.data?.role
  const admin = role === 'admin' || role === 'superadmin'
  return (
    <StaffLayout
      nav={admin ? ADMIN_NAV : TEACHER_NAV}
      user={me.data ? { name: me.data.name, roleLabel: ROLE_LABEL[me.data.role] } : undefined}
    >
      <Outlet />
    </StaffLayout>
  )
}
