import type { MatrixCell, MatrixSession } from './teacherApi'
import type { Status } from '../../shared/ui/StatusPill'

// 교사 화면 글자. 날짜·상태는 서버 값을 글자로만 바꾼다(열림·밀림·완료를 판단하지 않음).
// 날짜 함수는 학생 화면(features/student/dates.ts)과 같은 방식 — 기능 폴더끼리 import하지 않아 따로 둔다

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "2026-12-19" → "12/19 (토)". 읽을 수 없으면 받은 글자 그대로 */
export function shortDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (m === null) return date
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return date
  return `${month}/${day} (${WEEKDAYS[utc.getUTCDay()]})`
}

/** "2026-12-19" → "12/19" (매트릭스 머리글) */
export function monthDay(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date)
  return m === null ? date : `${Number(m[1])}/${Number(m[2])}`
}

const KOREA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** 서버 UTC 시각 → 한국 시간 "12/19 19:12" */
export function koreaTime(iso: string): string {
  const parts = Object.fromEntries(KOREA.formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
  return `${Number(parts.month)}/${Number(parts.day)} ${parts.hour}:${parts.minute}`
}

export type CellLook = {
  status: Status
  /** 칸에 보이는 글자(완료는 아이콘이라 빈 글자) */
  text: string
  /** 낭독 글자(학생·회차 이름은 부르는 쪽이 앞에 붙인다) */
  label: string
}

/**
 * 매트릭스 칸 모양. 순서: 수업 전(서버 opened=false) → 밀림(서버 overdue) → 완료·진행·미시작.
 * 휴강 행은 열로 오지 않는다. 열린 회차는 학생마다 칸이 항상 오지만(BE #28) 혹시 없으면 미시작으로 그린다
 */
export function cellLook(session: MatrixSession, cell: MatrixCell | undefined): CellLook {
  if (!session.opened) return { status: 'locked', text: '', label: '수업 전' }
  const progress = cell === undefined ? '' : ` ${cell.requiredDone} / ${cell.requiredTotal}`
  if (cell?.overdue === true) {
    const detail = cell.status === 'in_progress' ? `진행 중${progress}` : '미시작'
    return { status: 'overdue', text: '밀림', label: `밀림, ${detail}` }
  }
  if (cell?.status === 'completed') return { status: 'completed', text: '', label: '완료' }
  if (cell?.status === 'in_progress')
    return {
      status: 'in_progress',
      text: `${cell.requiredDone}/${cell.requiredTotal}`,
      label: `진행 중${progress}`,
    }
  return { status: 'open', text: '—', label: '미시작' }
}
