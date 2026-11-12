import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ReactNode, Ref } from 'react'
import { Link } from 'react-router'
import styles from './ActionRow.module.css'

// 흰 턱 카드 한 줄(v0.2) — 왼쪽 아이콘(선택) + 굵은 글 + 보조 글 + 〉. 누르면 턱만큼 내려간다(DESIGN.md 1.2)
// - to: 카드 전체가 다른 화면으로 가는 링크(S-03 밀린 수업 요약 → S-04)
// - onToggle: 같은 화면 아래 내용을 펼치는 버튼(S-07 "홈 화면에 추가"). aria-expanded·aria-controls, 펼치면 〉가 ⌄로
type Common = {
  title: string
  detail?: string
  icon?: ReactNode
}
type LinkRow = Common & { to: string }
type ToggleRow = Common & {
  onToggle: () => void
  expanded: boolean
  /** 펼쳐지는 내용의 id */
  controls: string
  ref?: Ref<HTMLButtonElement>
}
type ActionRowProps = LinkRow | ToggleRow

export function ActionRow(props: ActionRowProps) {
  return 'to' in props ? <LinkActionRow {...props} /> : <ToggleActionRow {...props} />
}

function RowContent({ title, detail, icon }: Common) {
  return (
    <>
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
    </>
  )
}

function LinkActionRow({ to, ...content }: LinkRow) {
  return (
    <Link to={to} className={styles.row}>
      <RowContent {...content} />
      <ChevronRight size={20} strokeWidth={2} className={styles.chevron} aria-hidden />
    </Link>
  )
}

function ToggleActionRow({ onToggle, expanded, controls, ref, ...content }: ToggleRow) {
  const Chevron = expanded ? ChevronDown : ChevronRight
  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.row} ${styles.button}`}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
    >
      <RowContent {...content} />
      <Chevron size={20} strokeWidth={2} className={styles.chevron} aria-hidden />
    </button>
  )
}
