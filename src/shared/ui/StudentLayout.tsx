import type { CSSProperties, ReactNode } from 'react'
import styles from './StudentLayout.module.css'

// 학생 화면: 단일 컬럼, 넓은 화면에서는 max-width 520 가운데 정렬(디자인 가이드 §1).
// levelColorHex를 주면 서버의 level.colorHex를 --level로 넣는다 — 화면 안 레벨 색은 이것 하나
type StudentLayoutProps = { children: ReactNode; levelColorHex?: string }

// #RRGGBB가 아니면 넣지 않는다(잘못된 값이면 --level을 쓰는 곳이 모두 색을 잃는다 → 기본 ink 유지)
const HEX = /^#[0-9a-f]{6}$/i

export function StudentLayout({ children, levelColorHex }: StudentLayoutProps) {
  const color = levelColorHex !== undefined && HEX.test(levelColorHex) ? levelColorHex : undefined
  const style = color === undefined ? undefined : ({ '--level': color } as CSSProperties)
  return (
    <main className={styles.layout} data-level={color === undefined ? undefined : ''} style={style}>
      {children}
    </main>
  )
}
