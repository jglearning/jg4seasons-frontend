import { useState, type ReactNode } from 'react'
import styles from './CoverHeader.module.css'

// 표지 헤더(DESIGN.md 1.6) — S-03 홈·S-08 완료. 넓은 면을 표지 색(--L)으로 칠하고 글자는 --L-on.
// art: 레벨별 표지 캐릭터 그림(장식, alt=""). 오른쪽에 붙이고 왼쪽 30%는 마스크로 헤더 색에 녹인다.
//   그림 파일이 없거나 못 받으면 그림만 숨긴다(깨진 그림 표시 없음) — 색만 있는 헤더
// fadeTo: 맨 아래 40px에서 이어지는 아래 바탕(연한 레벨 바탕 tint 또는 흰색) — 이 앱에서 허용된 유일한 그라데이션
// action: 오른쪽 위 자리(설정 버튼 등). 화면 여백(StudentLayout 20px)을 넘어 화면 폭 전체로 칠한다
type CoverHeaderProps = {
  children: ReactNode
  art?: string
  action?: ReactNode
  fadeTo?: 'tint' | 'white'
  height?: number
  className?: string
}

export function CoverHeader({
  children,
  art,
  action,
  fadeTo = 'tint',
  height = 344,
  className,
}: CoverHeaderProps) {
  const [artFailed, setArtFailed] = useState<string | null>(null)
  const showArt = art !== undefined && artFailed !== art
  return (
    <header
      className={[styles.cover, fadeTo === 'white' && styles.toWhite, className]
        .filter(Boolean)
        .join(' ')}
      style={{ height }}
    >
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
      <div className={styles.fade} aria-hidden />
    </header>
  )
}
