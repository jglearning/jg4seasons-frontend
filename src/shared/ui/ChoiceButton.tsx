import styles from './ChoiceButton.module.css'

// 디자인 가이드 §5 WordCard(리콜) — 선택지 높이 52. 고른 뒤: 정답은 레벨 fill 채움 + "정답", 고른 오답은 danger 테두리 + "오답".
// 색만으로 구분하지 않는다(글자 "정답"·"오답")
export type ChoiceResult = 'none' | 'correct' | 'wrong'

type ChoiceButtonProps = {
  label: string
  result: ChoiceResult
  onClick: () => void
  /** 이미 골랐으면 더 누를 수 없다 */
  locked: boolean
}

export function ChoiceButton({ label, result, onClick, locked }: ChoiceButtonProps) {
  return (
    <button
      type="button"
      className={[styles.choice, result !== 'none' && styles[result]].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-disabled={locked || undefined}
    >
      <span className={styles.label}>{label}</span>
      {/* 읽어 줄 때 "뜻 정답"으로 띄어 읽게(화면에서는 양 끝 배치라 보이지 않는다) */}{' '}
      {result !== 'none' && (
        <span className={styles.mark}>{result === 'correct' ? '정답' : '오답'}</span>
      )}
    </button>
  )
}
