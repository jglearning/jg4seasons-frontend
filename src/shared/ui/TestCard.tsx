import { BookOpen } from 'lucide-react'
import styles from './TestCard.module.css'

// 디자인 가이드 §5 TestCard(11/6) — S-05 테스트 듣기. 본문 글자 없이 실물 책을 펴고 듣는다.
// 책 아이콘 + "책 n번 지문을 펴고 들어요" + 지금 위치(전체 1:29 → 문장 4 / 10) + "이 문장 다시"·"앞 문장"
type TestCardProps = {
  passageNo: number
  /** "전체 1:29" 또는 "문장 4 / 10" */
  position: string
  onReplay: () => void
  onPrevious: () => void
  previousDisabled?: boolean
  disabled?: boolean
}

export function TestCard({
  passageNo,
  position,
  onReplay,
  onPrevious,
  previousDisabled = false,
  disabled = false,
}: TestCardProps) {
  return (
    <section className={styles.card} aria-label="테스트 듣기">
      <BookOpen size={22} strokeWidth={2} aria-hidden />
      <p className={styles.title}>책 {passageNo}번 지문을 펴고 들어요</p>
      <p className={styles.position} aria-live="polite">
        {position}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={onReplay} disabled={disabled}>
          이 문장 다시
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={onPrevious}
          disabled={disabled || previousDisabled}
        >
          앞 문장
        </button>
      </div>
    </section>
  )
}
