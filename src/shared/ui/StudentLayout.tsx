import { useLayoutEffect, type ReactNode } from 'react'
import { levelName } from '../level'
import styles from './StudentLayout.module.css'

// 학생 화면 틀: 단일 컬럼, 넓은 화면에서는 max-width 520 가운데 정렬.
// levelCode(서버 level.code)를 <html data-level="green">으로 붙인다 — 바탕(--L-tint)이 520 밖까지 칠해지고,
// 시트·탭 바처럼 <main> 밖에 놓이는 것도 같은 레벨 색을 쓴다. 학생 화면을 떠나면 떼어서 교사 화면에 남지 않는다.
// 레벨을 모르면(S-01, 불러오는 중) "none" — tokens.css 기본값(회색 바탕, ink 버튼)
// tabBar: 떠 있는 탭 바(BottomBar)가 있는 화면 — 맨 끝 내용이 탭 바에 가리지 않게 아래 여백(DESIGN.md 1.7)
type StudentLayoutProps = { children: ReactNode; levelCode?: string; tabBar?: boolean }

const LEVEL_NONE = 'none'

export function StudentLayout({ children, levelCode, tabBar = false }: StudentLayoutProps) {
  const name = levelName(levelCode) ?? LEVEL_NONE

  useLayoutEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-level', name)
    return () => root.removeAttribute('data-level')
  }, [name])

  return (
    <main className={tabBar ? `${styles.layout} ${styles.withTabBar}` : styles.layout}>
      {children}
    </main>
  )
}
