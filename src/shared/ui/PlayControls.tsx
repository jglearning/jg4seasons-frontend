import { Pause, Play, RotateCcw, SkipBack } from 'lucide-react'
import styles from './PlayControls.module.css'

// S-05 재생 줄(v0.2 지시문 §2.2-14). 가운데 재생/일시정지 96px(레벨 진한 색 + 크림 아이콘, 턱 4px),
// 왼쪽 "앞 문장"·오른쪽 "이 문장 다시" 64px 흰 동그라미(턱 3px) + 아래 글자. 모두 누르면 턱만큼 내려간다.
// 상태는 모르는 표시 부품 — 재생 상태·동작은 features/player가 넘긴다
type PlayControlsProps = {
  playing: boolean
  onToggle: () => void
  onPrevious: () => void
  onReplay: () => void
  disabled?: boolean
  previousDisabled?: boolean
  replayDisabled?: boolean
}

export function PlayControls({
  playing,
  onToggle,
  onPrevious,
  onReplay,
  disabled = false,
  previousDisabled = false,
  replayDisabled = false,
}: PlayControlsProps) {
  return (
    <div className={styles.row}>
      <button
        type="button"
        className={styles.side}
        onClick={onPrevious}
        disabled={disabled || previousDisabled}
      >
        <span className={styles.round} aria-hidden>
          <SkipBack size={26} strokeWidth={2.2} />
        </span>
        <span className={styles.label}>앞 문장</span>
      </button>
      <button
        type="button"
        className={styles.play}
        aria-label={playing ? '일시정지' : '재생'}
        onClick={onToggle}
        disabled={disabled}
      >
        {playing ? (
          <Pause size={40} fill="currentColor" strokeWidth={0} aria-hidden />
        ) : (
          <Play size={40} fill="currentColor" strokeWidth={0} aria-hidden />
        )}
      </button>
      <button
        type="button"
        className={styles.side}
        onClick={onReplay}
        disabled={disabled || replayDisabled}
      >
        <span className={styles.round} aria-hidden>
          <RotateCcw size={26} strokeWidth={2.2} />
        </span>
        <span className={styles.label}>이 문장 다시</span>
      </button>
    </div>
  )
}
