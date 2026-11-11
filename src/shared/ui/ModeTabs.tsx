import styles from './ModeTabs.module.css'

// 모드 탭(2줄 라벨 가능) — 고른 것은 ink 채움 + aria-pressed. 처음엔 S-06b 카드 학습용(11/11 삭제), 지금은 교사 매트릭스 묶음 탭.
// 한 줄 라벨로도 쓴다
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
