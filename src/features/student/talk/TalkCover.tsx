import { ChevronLeft } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import styles from './Talk.module.css'

// 프리토킹의 레벨 바탕 면(시안 11/26) — 홈 표지 헤더와 같은 그림(cover.webp)을 레벨 바탕(--L) 위에.
// head: 시작 전 머리(280px) — 그림은 오른쪽, 왼쪽 30%를 바탕에 녹인다(홈 CoverHeader와 같은 방식).
// stage: 대화·잠금의 위 면(최대 420px) — 그림은 가운데 아래, 좌우 끝 16%씩 녹인다.
// 홈 CoverHeader는 높이·흐림 방향이 고정이라 공용 컴포넌트를 바꾸지 않고 이 화면 안에 둔다.
// 그림 파일을 못 받으면 그림만 숨긴다(색만 있는 면). 자르기·반전·색 보정 없음

export type Art = { src: string | undefined; alt: string }

type TalkCoverProps = {
  art: Art
  variant: 'head' | 'stage'
  /** 왼쪽 위 뒤로 버튼(홈으로) */
  back?: boolean
  children?: ReactNode
}

export function TalkCover({ art, variant, back = false, children }: TalkCoverProps) {
  const [failed, setFailed] = useState<string | null>(null)
  const showArt = art.src !== undefined && failed !== art.src
  return (
    <div className={variant === 'head' ? styles.coverHead : styles.coverStage}>
      {showArt && (
        <img
          className={variant === 'head' ? styles.coverHeadArt : styles.coverStageArt}
          src={art.src}
          alt={art.alt}
          onError={() => setFailed(art.src ?? null)}
        />
      )}
      {back && (
        <Link to="/" className={styles.back} aria-label="뒤로">
          <ChevronLeft size={28} strokeWidth={2} aria-hidden />
        </Link>
      )}
      {children}
    </div>
  )
}
