import styles from './ModeTabs.module.css'

// 디자인 가이드 §5 WordCard(카드 학습) — 위 모드 탭(암기·리콜·스펠·목록, 2줄 라벨). 고른 것은 ink 채움 + aria-pressed.
// 같은 모양으로 목록 모드의 지문 필터(전체·1~6)에도 쓴다(한 줄 라벨)
export type ModeOption<T extends string | number> = { id: T; label: string; sub?: string }

type ModeTabsProps<T extends string | number> = {
  label: string
  options: ModeOption<T>[]
  selected: T
  onSelect: (id: T) => void
}

export function ModeTabs<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
}: ModeTabsProps<T>) {
  return (
    <div
      className={styles.tabs}
      role="group"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={styles.tab}
          aria-pressed={option.id === selected}
          onClick={() => onSelect(option.id)}
        >
          <span className={styles.label}>{option.label}</span>
          {option.sub && <span className={styles.sub}>{option.sub}</span>}
        </button>
      ))}
    </div>
  )
}
