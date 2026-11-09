import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { logout, meQuery } from '../api/session'
import { StaffLayout, type StaffNavItem } from '../shared/ui/StaffLayout'

// 교사·관리자 화면 틀. 메뉴는 역할로 고른다(관리 메뉴는 관리자만 — 화면·서버도 따로 막는다).
// 세션은 바깥 RequireSession(staff)이 이미 확인했다
const TEACHER_NAV: StaffNavItem[] = [{ to: '/teacher', label: '반 목록' }]
const ADMIN_NAV: StaffNavItem[] = [
  ...TEACHER_NAV,
  { to: '/admin/classes', label: '반 관리' },
  { to: '/admin/students', label: '학생 관리' },
  { to: '/admin/teachers', label: '교사 관리' },
  { to: '/admin/dashboard', label: '학원 현황' },
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
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [logoutState, setLogoutState] = useState<'idle' | 'pending' | 'failed'>('idle')

  // 확인 없이 바로(공통 틀 S4) → T-01. 학원 공용 PC라 1차에 필요(issues 11/7)
  async function onLogout() {
    setLogoutState('pending')
    try {
      await logout()
    } catch {
      setLogoutState('failed')
      return
    }
    await navigate('/teacher/login', { replace: true })
    queryClient.clear()
  }

  return (
    <StaffLayout
      nav={admin ? ADMIN_NAV : TEACHER_NAV}
      user={me.data ? { name: me.data.name, roleLabel: ROLE_LABEL[me.data.role] } : undefined}
      logout={{
        onLogout: () => void onLogout(),
        pending: logoutState === 'pending',
        error: logoutState === 'failed' ? '로그아웃하지 못함. 다시 시도' : undefined,
      }}
    >
      <Outlet />
    </StaffLayout>
  )
}
