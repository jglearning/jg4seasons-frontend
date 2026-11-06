import styles from './ProgressBar.module.css'

// 디자인 가이드 §5 ProgressBar — line 배경 + 레벨 fill. 값은 서버가 준 것을 그대로 받는다(여기서 계산하지 않음).
// 플레이어의 "들은 구간만 채우는" 바는 따로 만든다(S-05)
type ProgressBarProps = {
  value: number
  max: number
  /** 스크린 리더 이름(예: "지문 듣기") */
  label: string
  size?: 'student' | 'word'
}

export function ProgressBar({ value, max, label, size = 'student' }: ProgressBarProps) {
  const top = Math.max(max, 0)
  // 그리기·aria-valuenow는 0~max 안으로 맞춘다. 읽어 주는 글자(valuetext)는 서버 값 그대로
  const now = Math.min(Math.max(value, 0), top)
  const ratio = top > 0 ? now / top : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={top}
      aria-valuenow={now}
      aria-valuetext={`${value} / ${max}`}
      className={`${styles.track} ${styles[size]}`}
    >
      <div className={styles.fill} style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}
