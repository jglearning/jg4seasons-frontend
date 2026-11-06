import styles from './SentenceRow.module.css'

// 디자인 가이드 §5 SentenceRow(따라 읽기, ADR-26). 상자 전체가 버튼 — 누르면 그 문장 시작으로 옮겨 재생한다.
// 왼쪽 번호 + 그 아래 점(들은 문장이면 채움), 오른쪽 영어 문장(양쪽 맞춤).
// 지금 재생 중인 문장은 ink 테두리·surface-2 배경·aria-current. 들음은 점과 숨은 글자로(색만으로 구분하지 않는다)
type SentenceRowProps = {
  no: number
  text: string
  current: boolean
  heard: boolean
  onSelect: () => void
  disabled?: boolean
}

export function SentenceRow({
  no,
  text,
  current,
  heard,
  onSelect,
  disabled = false,
}: SentenceRowProps) {
  return (
    <li className={styles.item}>
      <button
        type="button"
        className={styles.row}
        aria-current={current ? 'true' : undefined}
        onClick={onSelect}
        disabled={disabled}
      >
        <span className={styles.side} aria-hidden>
          <span className={styles.no}>{no}</span>
          <span className={[styles.dot, heard && styles.heard].filter(Boolean).join(' ')} />
        </span>
        <span className={styles.srOnly}>
          문장 {no}
          {heard ? ' · 들음' : ''}
          {', '}
        </span>
        <span className={styles.text} lang="en">
          {text}
        </span>
      </button>
    </li>
  )
}
