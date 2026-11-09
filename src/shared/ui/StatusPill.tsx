import type { ReactNode } from 'react'
import styles from './StatusPill.module.css'

// 디자인 가이드 §5 StatusPill — 학생 회차 타일·교사 매트릭스가 같이 쓰는 상태 문법.
// 색이 아니라 채움/테두리/회색으로 구분한다. 상태 글자("밀림"·"오늘" 등)는 children으로 꼭 넣는다
export type Status = 'completed' | 'in_progress' | 'open' | 'locked' | 'overdue' | 'today'

type StatusPillProps = {
  status: Status
  /** pill: 작은 알약(카드 안 상태) · tile: 회차 타일(S-04) · cell: 교사 매트릭스 칸(36×26) */
  shape?: 'pill' | 'tile' | 'cell'
  /**
   * 화면 낭독기가 읽을 글자. 주면 보이는 글자(✓·—·3/6)는 읽지 않고 이것만 읽는다.
   * 매트릭스 칸처럼 기호만 보이는 곳에서 "김민준 Reading Day 5 진행 중 3 / 6"처럼 넣는다
   */
  srLabel?: string
  children: ReactNode
}

export function StatusPill({ status, shape = 'pill', srLabel, children }: StatusPillProps) {
  return (
    <span className={`${styles.base} ${styles[shape]} ${styles[status]}`} data-status={status}>
      {srLabel === undefined ? (
        children
      ) : (
        <>
          <span aria-hidden>{children}</span>
          <span className={styles.srOnly}>{srLabel}</span>
        </>
      )}
    </span>
  )
}
