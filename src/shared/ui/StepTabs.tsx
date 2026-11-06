import styles from './StepTabs.module.css'

// 디자인 가이드 §5 "S-05 단계 탭"(11/6) — surface-2 바탕 40px, 고른 쪽은 흰 칸. 잠긴 단계도 누를 수 있다(누르면 잠금 안내)
export type StepTab<T extends string> = { id: T; label: string; muted?: boolean }

type StepTabsProps<T extends string> = {
  label: string
  tabs: StepTab<T>[]
  selected: T
  onSelect: (id: T) => void
}

export function StepTabs<T extends string>({ label, tabs, selected, onSelect }: StepTabsProps<T>) {
  return (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          className={[styles.tab, tab.muted && styles.muted].filter(Boolean).join(' ')}
          aria-selected={tab.id === selected}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
