import { TriangleAlert } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router'
import styles from './OverdueAlert.module.css'

// 디자인 가이드 §5 OverdueAlert — 홈 맨 위 밀린 수업 경고 칸. 항목이 없으면 그리지 않는다.
// 빨강만으로 알리지 않게 경고 아이콘·"밀린 수업" 글자를 함께 쓴다
export type OverdueItem = {
  /** 수업(세션) 단위로 겹치지 않는 값 — 회차 코드가 아니라 seq */
  key: string
  title: string
  /** "12/15 (화) 수업 · 지문 듣기 2 / 6에서 멈춤" */
  detail: string
  action: { label: string; to: string }
}

export function OverdueAlert({ items }: { items: OverdueItem[] }) {
  const headingId = useId()
  if (items.length === 0) return null
  return (
    <section role="alert" aria-labelledby={headingId} className={styles.alert}>
      <div className={styles.head}>
        <h2 id={headingId} className={styles.heading}>
          <TriangleAlert size={20} strokeWidth={2} aria-hidden />
          밀린 수업 {items.length}개
        </h2>
        <span className={styles.hint}>다음 수업 전에 끝내요</span>
      </div>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.key} className={styles.item}>
            <div className={styles.text}>
              <span className={styles.title}>{item.title}</span>
              <span className={styles.detail}>{item.detail}</span>
            </div>
            <Link
              to={item.action.to}
              className={styles.action}
              aria-label={`${item.title} ${item.action.label}`}
            >
              {item.action.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
