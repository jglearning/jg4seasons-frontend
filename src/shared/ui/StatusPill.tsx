import type { ReactNode } from 'react'
import styles from './StatusPill.module.css'

// 디자인 가이드 §5 StatusPill — 학생 회차 타일·교사 매트릭스가 같이 쓰는 상태 문법.
// 색이 아니라 채움/테두리/회색으로 구분한다. 상태 글자("밀림"·"오늘" 등)는 children으로 꼭 넣는다
export type Status = 'completed' | 'in_progress' | 'open' | 'locked' | 'overdue' | 'today'

type StatusPillProps = {
  status: Status
  /** pill: 작은 알약(카드 안 상태) · tile: 회차 타일(S-04) */
  shape?: 'pill' | 'tile'
  children: ReactNode
}

export function StatusPill({ status, shape = 'pill', children }: StatusPillProps) {
  return (
    <span className={`${styles.base} ${styles[shape]} ${styles[status]}`} data-status={status}>
      {children}
    </span>
  )
}
