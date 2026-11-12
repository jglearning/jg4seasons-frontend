import { useState, type ReactNode } from 'react'
import styles from './CoverHeader.module.css'

// 표지 헤더(DESIGN.md 1.6) — S-03 홈·S-08 완료. 넓은 면을 표지 색(--L)으로 칠하고 글자는 --L-on.
// 아래 두 모서리는 반경 28로 둥글게(그라데이션 없음 — 11/12 밤, 그라데이션이 그림을 뿌옇게 덮어서 뺐다).
// 높이는 기본 clamp(260px, 41svh, 344px) — 390×844에서 344, 낮은 폰에서 줄어든다.
// art: 레벨별 표지 캐릭터 그림(장식, alt=""). 오른쪽에 붙이고 높이는 헤더와 같게, 폭은 높이 × 0.76(344일 때 262) —
//   폭을 고정하면 낮은 폰에서 왼쪽 글자와 겹친다. 왼쪽 30%는 마스크로 헤더 색에 녹인다.
//   그림 파일이 없거나 못 받으면 그림만 숨긴다(깨진 그림 표시 없음) — 색만 있는 헤더
// action: 오른쪽 위 자리(설정 버튼 등). 화면 여백(StudentLayout 20px)을 넘어 화면 폭 전체로 칠한다
type CoverHeaderProps = {
  children: ReactNode
  art?: string
  action?: ReactNode
  className?: string
}

export function CoverHeader({ children, art, action, className }: CoverHeaderProps) {
  const [artFailed, setArtFailed] = useState<string | null>(null)
  const showArt = art !== undefined && artFailed !== art
  return (
    <header className={[styles.cover, className].filter(Boolean).join(' ')}>
      {showArt && (
        <img
          className={styles.art}
          src={art}
          alt=""
          onError={() => setArtFailed(art)}
          data-testid="cover-art"
        />
      )}
      <div className={styles.content}>{children}</div>
      {action && <div className={styles.action}>{action}</div>}
    </header>
  )
}
