import type { ReactNode } from 'react'
import { levelProps } from '../level'
import styles from './StudentLayout.module.css'

// 학생 화면: 단일 컬럼, 넓은 화면에서는 max-width 520 가운데 정렬(디자인 가이드 §1).
// levelColorHex를 주면 서버의 level.colorHex를 --level로 넣는다 — 화면 안 레벨 색은 이것 하나
type StudentLayoutProps = { children: ReactNode; levelColorHex?: string }

export function StudentLayout({ children, levelColorHex }: StudentLayoutProps) {
  return (
    <main className={styles.layout} {...levelProps(levelColorHex)}>
      {children}
    </main>
  )
}
