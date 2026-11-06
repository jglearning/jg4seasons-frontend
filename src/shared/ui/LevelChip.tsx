import type { ReactNode } from 'react'
import styles from './LevelChip.module.css'

// 디자인 가이드 §5 LevelChip — 레벨 fill 배경 + 흰 글자("그린 · 겨울"). 색은 바깥 [data-level]의 --level
export function LevelChip({ children }: { children: ReactNode }) {
  return <span className={styles.chip}>{children}</span>
}
