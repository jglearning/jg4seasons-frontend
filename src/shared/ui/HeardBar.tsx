import { useState, type PointerEvent } from 'react'
import styles from './HeardBar.module.css'

// S-05 들은 구간 바(v0.2 지시문 §2.2-15). 12px 알약.
// - 들은 구간(서버 heardRanges + 이 화면에서 들은 것): 레벨 진한 색. 여러 조각
// - 건너뛴 구간: 지금 위치보다 앞인데 듣지 않은 곳 — 45° 빗금(표시용, 판정 아님)
// - 남은 구간: line / 지금 위치: ink 3px 세로선 / 완료 기준(서버 threshold) 자리: muted 2px 눈금
// 누르거나 끌어 옮긴다(앞으로 건너뛴 곳은 미청취로 남는다). 끄는 동안은 위치만 보여 주고 손을 뗄 때 한 번 onSeek —
// seek마다 들은 구간이 끊기므로(TRK-03). iOS의 range는 트랙을 눌러도 옮겨지지 않아 pointer 이벤트로 직접 계산하고,
// 키보드·스크린 리더는 위에 겹친 투명 <input type="range">로 (#40에서 옮겨 옴)
type HeardBarProps = {
  listened: Array<[number, number]>
  positionMs: number
  durationMs: number
  /** 완료 기준(0~1, 서버 completion.threshold). 없으면 눈금 없음 */
  threshold?: number
  onSeek?: (ms: number) => void
  disabled?: boolean
}

export function HeardBar({
  listened,
  positionMs,
  durationMs,
  threshold,
  onSeek,
  disabled = false,
}: HeardBarProps) {
  const total = Math.max(durationMs, 1)
  const clamp = (ms: number) => Math.min(Math.max(ms, 0), total)
  const percent = (ms: number) => `${(clamp(ms) / total) * 100}%`
  /** 끄는 중인 위치(ms) — 손을 떼기 전까지 화면에만 */
  const [dragMs, setDragMs] = useState<number | null>(null)
  const seekable = onSeek !== undefined && !disabled && durationMs > 0
  const shownMs = dragMs ?? positionMs
  const skipped = gapsBefore(listened, positionMs)

  const msAt = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = box.width > 0 ? (event.clientX - box.left) / box.width : 0
    return Math.round(Math.min(Math.max(ratio, 0), 1) * durationMs)
  }
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!seekable || !event.isPrimary) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDragMs(msAt(event))
  }
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (dragMs !== null) setDragMs(msAt(event))
  }
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (dragMs === null) return
    setDragMs(null)
    onSeek?.(msAt(event))
  }

  // 들은 조각은 data-range, 건너뛴 조각은 data-skipped(테스트·디버그용으로 구분)
  const segment = (kind: 'listened' | 'skipped', [start, end]: [number, number]) => (
    <span
      key={`${kind}-${start}-${end}`}
      className={styles[kind]}
      {...{ [kind === 'listened' ? 'data-range' : 'data-skipped']: `${start}-${end}` }}
      style={{ left: percent(start), width: `calc(${percent(end)} - ${percent(start)})` }}
    />
  )

  return (
    <div
      className={styles.seek}
      data-seekable={seekable || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDragMs(null)}
    >
      <div className={styles.track} aria-hidden>
        {skipped.map((range) => segment('skipped', range))}
        {listened.map((range) => segment('listened', range))}
        {threshold !== undefined && threshold > 0 && threshold < 1 && (
          <span className={styles.tick} style={{ left: `${threshold * 100}%` }} />
        )}
        <span className={styles.head} style={{ left: percent(shownMs) }} />
      </div>
      {onSeek && (
        <input
          type="range"
          className={styles.range}
          aria-label="재생 위치"
          aria-valuetext={`${clock(shownMs)} / ${clock(durationMs)}`}
          min={0}
          max={Math.max(durationMs, 0)}
          step={1000}
          value={Math.min(Math.max(shownMs, 0), Math.max(durationMs, 0))}
          disabled={!seekable}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
        />
      )}
    </div>
  )
}

/** 0 ~ position 사이에서 들은 구간이 덮지 않은 곳(겹치지 않는 정렬된 listened 기준). 1초 미만 틈은 버린다(문장 사이 깜빡임) */
function gapsBefore(
  listened: Array<[number, number]>,
  positionMs: number,
): Array<[number, number]> {
  const MIN_GAP = 1000
  const sorted = [...listened].sort((a, b) => a[0] - b[0])
  const gaps: Array<[number, number]> = []
  let cursor = 0
  for (const [start, end] of sorted) {
    if (start >= positionMs) break
    if (start - cursor >= MIN_GAP) gaps.push([cursor, start])
    cursor = Math.max(cursor, end)
  }
  if (positionMs - cursor >= MIN_GAP) gaps.push([cursor, positionMs])
  return gaps
}

/** 63000 → "1:03" */
function clock(ms: number): string {
  const seconds = Math.max(Math.floor(ms / 1000), 0)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
