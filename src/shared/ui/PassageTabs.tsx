import { Check } from 'lucide-react'
import styles from './PassageTabs.module.css'

// S-05 위 지문 탭(STU-04). 지문 수는 레벨마다 1~12(ADR-27) — 6칸 격자라 7개부터 다음 줄. 들은 지문(서버 완료 값)은 채움 + ✓ — 색만으로 구분하지 않는다
export type PassageTab = { no: number; done: boolean }

type PassageTabsProps = {
  tabs: PassageTab[]
  selected: number
  onSelect: (no: number) => void
}

export function PassageTabs({ tabs, selected, onSelect }: PassageTabsProps) {
  return (
    <nav aria-label="지문" className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.no}
          type="button"
          className={[styles.tab, tab.done && styles.done].filter(Boolean).join(' ')}
          aria-current={tab.no === selected ? 'true' : undefined}
          aria-label={`지문 ${tab.no}${tab.done ? ' · 완료' : ''}`}
          onClick={() => onSelect(tab.no)}
        >
          {tab.done && <Check size={14} strokeWidth={2.5} aria-hidden />}
          {tab.no}
        </button>
      ))}
    </nav>
  )
}
