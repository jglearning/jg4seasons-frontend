import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import styles from './StaffLayout.module.css'

// 교사·관리자 화면 틀(디자인 가이드 §1): 사이드바 240 + 본문, 1280 기준. 768 이하에서는 사이드바가 위 가로 메뉴로 접힌다.
// 메뉴 항목은 쓰는 쪽(역할)이 정한다. 지금 위치는 NavLink가 aria-current="page"로 표시
export type StaffNavItem = { to: string; label: string }

/** 이름 아래 "로그아웃"(공통 틀 S4 — 확인 없이 바로). 요청·이동은 쓰는 쪽이 한다 */
export type StaffLogout = {
  onLogout: () => void
  pending: boolean
  /** 실패 문구(있으면 버튼 아래 role=alert) */
  error?: string
}

type StaffLayoutProps = {
  nav: StaffNavItem[]
  /** 사이드바 아래 "이름 · 역할" */
  user?: { name: string; roleLabel: string }
  logout?: StaffLogout
  children: ReactNode
}

export function StaffLayout({ nav, user, logout, children }: StaffLayoutProps) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <p className={styles.brand}>제이G 4 Seasons</p>
        <nav aria-label="관리 메뉴">
          <ul className={styles.nav}>
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} className={styles.link}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {(user || logout) && (
          <div className={styles.account}>
            {user && (
              <p className={styles.user}>
                {user.name} · {user.roleLabel}
              </p>
            )}
            {logout && (
              <button
                type="button"
                className={styles.logout}
                onClick={logout.onLogout}
                disabled={logout.pending}
              >
                {logout.pending ? '로그아웃 중' : '로그아웃'}
              </button>
            )}
            {logout?.error && (
              <p className={styles.logoutError} role="alert">
                {logout.error}
              </p>
            )}
          </div>
        )}
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
