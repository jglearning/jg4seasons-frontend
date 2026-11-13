import type { ReactNode } from 'react'
import styles from './StatTile.module.css'

// 통계 칸(지시문 §6.6 — S-08 "지문 6 / 6"·"들은 시간"). 레벨 옅은 면(--L-tint), 반경 16,
// 라벨 14px 700 muted + 값 26px 800 ink. 이름-값 한 쌍이라 <dl>로 읽힌다
type StatTileProps = {
  label: string
  value: ReactNode
}

export function StatTile({ label, value }: StatTileProps) {
  return (
    <dl className={styles.tile}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
    </dl>
  )
}
