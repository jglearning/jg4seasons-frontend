import type { LucideIcon } from 'lucide-react'
import styles from './StatusPanel.module.css'

// 빈 상태·못 받은 상태 안내(와이어프레임 S05_Before ②~⑤, 명세 S04_S05_빈상태 §2).
// 흰 받침 원(지름 72, 1px line) 안의 아이콘 30 + 제목(20/800) + 보조 글(15/500 muted).
// 묶음 높이는 216으로 고정 — 제목·보조 글이 한 줄이든 두 줄이든 아이콘 자리가 움직이지 않는다.
// 아이콘 색: bad = 다시 시도하면 풀릴 수 있는 문제(끊김·서버 오류), muted = 기다려야 하는 상태(잠김·기간).
// 상태를 색만으로 구분하지 않도록 아이콘 모양이 상태마다 다르다. --bad는 아이콘에만(글자는 ink)
type StatusPanelProps = {
  icon: LucideIcon
  tone: 'bad' | 'muted'
  title: string
  /** 보조 글 — 없거나 제목과 같으면 그리지 않는다(서버가 detail을 비우면 title로 채워 보낸다) */
  detail?: string
  /** alert = 다시 시도할 문제, status = 알림 */
  role: 'alert' | 'status'
}

export function StatusPanel({ icon: Icon, tone, title, detail, role }: StatusPanelProps) {
  const showDetail = detail !== undefined && detail !== '' && detail !== title
  return (
    <div className={styles.panel} role={role}>
      <span className={styles.badge} data-tone={tone} aria-hidden="true">
        <Icon size={30} strokeWidth={2} />
      </span>
      <p className={styles.title}>{title}</p>
      {showDetail && <p className={styles.detail}>{detail}</p>}
    </div>
  )
}
