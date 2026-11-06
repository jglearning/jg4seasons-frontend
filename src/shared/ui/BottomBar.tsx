import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'
import styles from './BottomBar.module.css'

// 학생 하단 탭(S-03·S-04). 화면 아래 고정, 지금 화면 탭은 aria-current="page"(NavLink가 붙인다).
// 배지는 숫자만 보이고 읽을 때는 badge.label(예: "밀린 수업 2개")을 붙인다
type TabBase = { label: string; icon: LucideIcon }

export type BottomTab = TabBase &
  (
    | {
        to: string
        /** 그 주소에서만 켜짐("/"가 모든 주소에서 켜지지 않게) */
        end?: boolean
        badge?: { count: number; label: string }
      }
    | {
        /** 누를 수 없는 탭 — 읽을 때 붙는 이유(예: "준비 중") */
        to?: undefined
        unavailable: string
      }
  )

export function BottomBar({ tabs }: { tabs: BottomTab[] }) {
  return (
    <>
      <div className={styles.spacer} aria-hidden />
      <nav aria-label="주 메뉴" className={styles.bar}>
        <ul className={styles.list}>
          {tabs.map((tab) => (
            <li key={tab.label} className={styles.item}>
              <Tab tab={tab} />
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}

function Tab({ tab }: { tab: BottomTab }) {
  const Icon = tab.icon
  const count = tab.to !== undefined && tab.badge !== undefined ? tab.badge.count : 0
  const body = (
    <>
      <span className={styles.iconWrap}>
        <Icon size={22} strokeWidth={2} aria-hidden />
        {count > 0 && (
          <span className={styles.badge} aria-hidden>
            {count}
          </span>
        )}
      </span>
      <span className={styles.label}>{tab.label}</span>
    </>
  )

  if (tab.to === undefined) {
    return (
      <span
        role="link"
        aria-disabled="true"
        aria-label={`${tab.label}, ${tab.unavailable}`}
        className={`${styles.tab} ${styles.disabled}`}
      >
        {body}
      </span>
    )
  }
  const name = count > 0 && tab.badge ? `${tab.label}, ${tab.badge.label}` : tab.label
  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      aria-label={name}
      className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}
    >
      {body}
    </NavLink>
  )
}
