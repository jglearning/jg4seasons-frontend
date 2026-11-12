import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import styles from './ActionRow.module.css'

// 흰 턱 카드 한 줄(v0.2) — 왼쪽 아이콘(선택) + 굵은 글 + 보조 글 + 〉. 카드 전체가 다른 화면으로 가는 링크.
// S-03 밀린 수업 요약(→ S-04), S-07 "홈 화면에 추가" 줄. 누르면 턱만큼 내려간다(DESIGN.md 1.2)
type ActionRowProps = {
  to: string
  title: string
  detail?: string
  icon?: ReactNode
}

export function ActionRow({ to, title, detail, icon }: ActionRowProps) {
  return (
    <Link to={to} className={styles.row}>
      {icon && (
        <span className={styles.icon} aria-hidden>
          {icon}
        </span>
      )}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {/* 읽는 이름이 "2개Reading…"으로 붙지 않게(세로 flex라 화면에는 보이지 않는다) */}{' '}
        {detail && <span className={styles.detail}>{detail}</span>}
      </span>
      <ChevronRight size={20} strokeWidth={2} className={styles.chevron} aria-hidden />
    </Link>
  )
}
