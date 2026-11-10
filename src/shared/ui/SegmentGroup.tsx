import styles from './SpeedSegment.module.css'

// 디자인 가이드 §5 Player — 지문 제목 옆 속도 세그먼트 0.8 | 1.0● | 1.2.
// 속도별 파일을 고르는 것이지 playbackRate가 아니다(배속 UI 금지). ●는 필수 속도(서버 required)
export type SpeedOption<V extends string> = { variant: V; required: boolean }

type SpeedSegmentProps<V extends string> = {
  options: SpeedOption<V>[]
  selected: V
  onSelect: (variant: V) => void
  disabled?: boolean
}

export function SpeedSegment<V extends string>({
  options,
  selected,
  onSelect,
  disabled = false,
}: SpeedSegmentProps<V>) {
  return (
    <div className={styles.segment} role="group" aria-label="속도">
      {options.map((option) => (
        <button
          key={option.variant}
          type="button"
          className={styles.option}
          aria-pressed={option.variant === selected}
          aria-label={option.required ? `${option.variant} 필수` : option.variant}
          onClick={() => onSelect(option.variant)}
          disabled={disabled}
        >
          {option.variant}
          {option.required && (
            <span className={styles.required} aria-hidden>
              ●
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
