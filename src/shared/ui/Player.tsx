import { useState, type PointerEvent, type ReactNode } from 'react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import styles from './Player.module.css'

// 디자인 가이드 §5 Player(하단 고정, v0.3). 재생 상태는 모르는 표시 부품 — 상태는 features/player 컨텍스트가 넘긴다.
// - 첫 줄: 지금 듣는 것("지문 3 전체 · 1:29 · 1.0×" / "지문 3 · 문장 4 / 10 · 1.0×") + 오른쪽 작은 글자(들은 구간)
// - 진행 바 8px: 들은 구간만 채운다(건너뛴 곳은 line 그대로, 여러 조각) + 지금 위치 2px ink 세로선.
//   onSeek이 있으면 바를 누르거나 끌어 옮긴다(STU-05, 11/9). 끄는 동안은 위치만 보여 주고 손을 뗄 때 한 번 onSeek —
//   seek마다 들은 구간이 끊기므로(TRK-03). 누르기·끌기는 pointer 이벤트로 직접 계산한다(iOS의 range는 트랙을 눌러도
//   옮겨지지 않는다). 키보드·스크린 리더는 위에 겹친 투명 <input type="range">로
// - 이전 문장 · 재생/일시정지 · 다음 문장
// - 소리가 안 나면(음원 오류·재생 막힘) 안내 한 줄 + 다시 불러오기
// - overlay: 바 바로 위에 띄울 것(완료 전 안내 카드 등)
type PlayerProps = {
  title: string
  /** 첫 줄 오른쪽 작은 글자(예: "들은 구간 72%") */
  aside?: string
  playing: boolean
  positionMs: number
  durationMs: number
  listened: Array<[number, number]>
  onToggle: () => void
  onPrev: () => void
  onNext: () => void
  /** 진행 바로 옮길 위치(ms). 없으면 바는 표시만 */
  onSeek?: (ms: number) => void
  prevDisabled?: boolean
  nextDisabled?: boolean
  /** 소리가 안 날 때 보일 안내(없으면 숨김) */
  error?: { message: string; onRetry: () => void }
  disabled?: boolean
  overlay?: ReactNode
}

export function Player({
  title,
  aside,
  playing,
  positionMs,
  durationMs,
  listened,
  onToggle,
  onPrev,
  onNext,
  onSeek,
  prevDisabled = false,
  nextDisabled = false,
  error,
  disabled = false,
  overlay,
}: PlayerProps) {
  const total = Math.max(durationMs, 1)
  const percent = (ms: number) => `${(Math.min(Math.max(ms, 0), total) / total) * 100}%`
  /** 끄는 중인 위치(ms) — 손을 떼기 전까지 화면에만 */
  const [dragMs, setDragMs] = useState<number | null>(null)
  const seekable = onSeek !== undefined && !disabled && durationMs > 0
  const shownMs = dragMs ?? positionMs

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

  return (
    <>
      <div className={styles.spacer} aria-hidden />
      <section className={styles.bar} aria-label="플레이어">
        {overlay && <div className={styles.overlay}>{overlay}</div>}
        <div className={styles.inner}>
          <div className={styles.top}>
            <span className={styles.title}>{title}</span>
            {aside && <span className={styles.aside}>{aside}</span>}
          </div>

          {error && (
            <div className={styles.error} role="alert">
              <span>{error.message}</span>
              <button type="button" className={styles.retry} onClick={error.onRetry}>
                다시 불러오기
              </button>
            </div>
          )}

          <div
            className={styles.seek}
            data-seekable={seekable || undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDragMs(null)}
          >
            <div className={styles.track} aria-hidden>
              {listened.map(([start, end]) => (
                <span
                  key={`${start}-${end}`}
                  className={styles.listened}
                  data-range={`${start}-${end}`}
                  style={{
                    left: percent(start),
                    width: `calc(${percent(end)} - ${percent(start)})`,
                  }}
                />
              ))}
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
          <div className={styles.times}>
            <span>{clock(shownMs)}</span>
            <span>{clock(durationMs)}</span>
          </div>

          <div className={styles.controls}>
            <button
              type="button"
              className={styles.round}
              aria-label="이전 문장"
              onClick={onPrev}
              disabled={disabled || prevDisabled}
            >
              <SkipBack size={20} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              className={styles.play}
              aria-label={playing ? '일시정지' : '재생'}
              onClick={onToggle}
              disabled={disabled}
            >
              {playing ? (
                <Pause size={24} strokeWidth={2} aria-hidden />
              ) : (
                <Play size={24} strokeWidth={2} aria-hidden />
              )}
            </button>
            <button
              type="button"
              className={styles.round}
              aria-label="다음 문장"
              onClick={onNext}
              disabled={disabled || nextDisabled}
            >
              <SkipForward size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      </section>
    </>
  )
}

/** 63000 → "1:03" */
function clock(ms: number): string {
  const seconds = Math.max(Math.floor(ms / 1000), 0)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
