import type { ReactNode } from 'react'
import styles from './StudentLayout.module.css'

// 학생 화면: 단일 컬럼, 넓은 화면에서는 max-width 520 가운데 정렬(디자인 가이드 §1)
export function StudentLayout({ children }: { children: ReactNode }) {
  return <main className={styles.layout}>{children}</main>
}
