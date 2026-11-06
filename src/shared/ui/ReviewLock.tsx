import { Lock } from 'lucide-react'
import styles from './ReviewLock.module.css'

// 디자인 가이드 §5 ReviewLock(11/6) — S-05 복습이 잠긴 동안. 지문을 다 들으면(서버 완료 값) 열린다
type ReviewLockProps = {
  done: number
  total: number
  /** 아직 완료 안 된 지문 번호 */
  remaining: number[]
  onGoTest: () => void
}

export function ReviewLock({ done, total, remaining, onGoTest }: ReviewLockProps) {
  return (
    <section className={styles.box} aria-label="복습 잠김">
      <Lock size={22} strokeWidth={2} aria-hidden />
      <p className={styles.title}>복습은 지문 {total}개를 다 들으면 열려요</p>
      <p className={styles.body}>
        지금 {done} / {total}
        {remaining.length > 0 && ` · 남은 지문 ${remaining.join(', ')}`}
      </p>
      <button type="button" className={styles.action} onClick={onGoTest}>
        테스트 듣기로
      </button>
    </section>
  )
}
