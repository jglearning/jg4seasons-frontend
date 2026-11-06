import { Link } from 'react-router'
import styles from './NudgeCard.module.css'

// 디자인 가이드 §5 NudgeCard(11/5). 완료 전에 넘어가려 할 때만 하단 바 바로 위에 뜨는 작은 카드.
// 모달·딤 없음, 막지 않는다 — 넘어가도 완료가 안 될 뿐. 주 동작(ink)과 넘어가기(흰 버튼 또는 다른 화면 링크)
type Action = { label: string; onClick: () => void }

type NudgeCardProps = {
  title: string
  body: string
  primary: Action
  secondary: Action | { label: string; to: string }
}

export function NudgeCard({ title, body, primary, secondary }: NudgeCardProps) {
  return (
    <div className={styles.card} role="status">
      <p className={styles.title}>{title}</p>
      <p className={styles.body}>{body}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={primary.onClick}>
          {primary.label}
        </button>
        {'to' in secondary ? (
          <Link className={styles.secondary} to={secondary.to}>
            {secondary.label}
          </Link>
        ) : (
          <button type="button" className={styles.secondary} onClick={secondary.onClick}>
            {secondary.label}
          </button>
        )}
      </div>
    </div>
  )
}
