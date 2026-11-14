import type { MatrixCell, MatrixSession } from './teacherApi'
import type { Status } from '../../shared/ui/StatusPill'
import { voiceLabel } from '../../shared/lessonLabel'

// 교사 화면 글자. 날짜·상태는 서버 값을 글자로만 바꾼다(열림·밀림·완료를 판단하지 않음).
// 학원 날짜 "12/19 (토)"는 shared/dates.ts(관리자·운영자 화면과 같이 씀)

/** T-03 매트릭스 묶음 하나 = 진도표 seq 8개 */
export const GROUP_SIZE = 8

/**
 * T-03 묶음 번호 1..n — n = 진도표(4.5) 마지막 seq를 8로 나눠 올림, 최소 3(겨울 1·2·3).
 * 휴강 행도 seq를 차지해(BE #42) 행이 24를 넘을 수 있고 블랙은 28회. 진도표가 오기 전·못 받으면 3
 */
export function matrixGroups(lastSeq: number | undefined): number[] {
  const count = Math.max(3, Math.ceil((lastSeq ?? 0) / GROUP_SIZE))
  return Array.from({ length: count }, (_, i) => i + 1)
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

/** 밀리초 → "1:05" (재생 시간·길이 표시) */
export function playTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** 서버 청취율 0~1 → "94%"(교사 화면만 퍼센트) */
export function percent(coverage: number): string {
  return `${Math.round(coverage * 100)}%`
}

/** "지문 1 · 미국 여". 목소리가 아닌 값이 오면 받은 글자 그대로 */
export function trackName(passageNo: number, variant: string): string {
  return `지문 ${passageNo} · ${voiceLabel(variant) ?? variant}`
}

/** 트랙을 지문별로 모은다(서버 순서 그대로 — 지문 no → 목소리) */
export function groupByPassage<T extends { passageNo: number }>(
  tracks: readonly T[],
): Array<{ passageNo: number; tracks: T[] }> {
  const groups: Array<{ passageNo: number; tracks: T[] }> = []
  for (const track of tracks) {
    const last = groups.at(-1)
    if (last?.passageNo === track.passageNo) last.tracks.push(track)
    else groups.push({ passageNo: track.passageNo, tracks: [track] })
  }
  return groups
}

/**
 * 지문 칸 하나에 보일 목소리(T-05). 서버가 completed로 준 목소리가 있으면 그것, 없으면 가장 많이 들은 목소리.
 * 완료 판정은 서버 값 그대로 — 지문 완료 = 아무 목소리 하나 완료(BE ADR-27)라 여러 목소리를 한 칸에 모아 보일 뿐이다
 */
export function passageCell<T>(
  results: ReadonlyArray<{ track: T; completed: boolean; coverage: number }>,
): { track: T; completed: boolean; coverage: number } | undefined {
  const done = results.find((r) => r.completed)
  if (done !== undefined) return done
  return results.reduce<(typeof results)[number] | undefined>(
    (best, r) => (r.coverage > 0 && (best === undefined || r.coverage > best.coverage) ? r : best),
    undefined,
  )
}

type LessonStatus = 'not_started' | 'in_progress' | 'completed'

/** 회차 상태 알약(서버 status·requiredDone 그대로) */
export function lessonLook(
  status: LessonStatus,
  requiredDone: number,
  requiredTotal: number,
): { status: Status; text: string } {
  if (status === 'completed') return { status: 'completed', text: '완료' }
  if (status === 'in_progress')
    return { status: 'in_progress', text: `진행 중 ${requiredDone} / ${requiredTotal}` }
  return { status: 'open', text: '미시작' }
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
