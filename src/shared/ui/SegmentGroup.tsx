import { Check } from 'lucide-react'
import styles from './SegmentGroup.module.css'

// 디자인 가이드 §5 Player의 세그먼트(0.8 | 1.0 | 1.2)를 일반화한 선택 줄 — S-05 목소리·재생 속도.
// 고른 칸은 ink 채움(aria-pressed). done이면 ✓ 아이콘 + 읽는 이름에 "완료" — 색만으로 구분하지 않는다.
// block이면 한 줄을 칸 수로 나눠 채우고 학생 터치 높이(48)를 쓴다
export type SegmentOption<V extends string> = { value: V; label: string; done?: boolean }

type SegmentGroupProps<V extends string> = {
  /** 그룹 이름(스크린 리더) */
  label: string
  options: SegmentOption<V>[]
  selected: V
  onSelect: (value: V) => void
  disabled?: boolean
  block?: boolean
}

export function SegmentGroup<V extends string>({
  label,
  options,
  selected,
  onSelect,
  disabled = false,
  block = false,
}: SegmentGroupProps<V>) {
  return (
    <div
      className={[styles.segment, block && styles.block].filter(Boolean).join(' ')}
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.option}
          aria-pressed={option.value === selected}
          aria-label={option.done ? `${option.label} 완료` : option.label}
          onClick={() => onSelect(option.value)}
          disabled={disabled}
        >
          {option.label}
          {option.done && <Check size={14} strokeWidth={2.5} aria-hidden />}
        </button>
      ))}
    </div>
  )
}
