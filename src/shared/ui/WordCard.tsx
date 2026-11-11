import { ChevronDown, ChevronUp, Volume2 } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { pageCurl, polygon } from './pageCurl'
import styles from './WordCard.module.css'

// 디자인 가이드 §5 WordCard(11/11 판, #64). 세로로 긴 카드 — 위 절반 영단어·품사, 아래 절반 뜻.
// 카드 절반 크기의 종이 한 장: 아래 자리면 뜻을 가리고(단어 보기), 위로 넘기면 단어를 덮는다(뜻 보고 단어 떠올리기).
// 넘길 때는 오른쪽 아래 모서리가 손가락 높이를 따라 올라가며 대각선으로 말린다(pageCurl). 놓으면 모서리가
// 가운데선을 넘었을 때만 반대쪽으로 넘어가고 아니면 돌아간다. 카드 전체가 <button> — 끌기·누르기·Enter·Space.
// 카드를 바꾸면 부르는 쪽이 key로 새로 그린다(아래 자리에서 시작)
type WordCardProps = {
  /** 왼쪽 위 작은 칩(단어 출처 "어휘책"·"추가 단어") */
  sourceLabel: string
  english: string
  posLabel: string
  korean: string
  /** 위 절반에 "발음 자동 재생" 표시 */
  autoplay?: boolean
}

/** 손가락이 이만큼 움직여야 끌기로 본다(그보다 작으면 누르기) */
const DRAG_SLOP = 4
/** 놓은 뒤·누른 뒤 넘어가거나 돌아가는 시간(가이드 11/11 예외) */
const SETTLE_MS = 200

type Size = { width: number; half: number }
type Drag = { pointerId: number; startY: number; start: number; size: Size; moved: boolean }
type Settle = { from: number; to: number }

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function WordCard({
  sourceLabel,
  english,
  posLabel,
  korean,
  autoplay = false,
}: WordCardProps) {
  const meaningId = useId()
  /** 종이가 위로 넘어가 있는가(뜻이 보임) */
  const [up, setUp] = useState(false)
  /**
   * 끄는 중 모서리가 아래 자리에서 올라간 거리(px, 0 ~ 종이 높이의 2배). 종이 높이만큼이면 가운데선,
   * 2배면 카드 위 끝(다 넘어감). 끌지 않을 때는 null
   */
  const [travel, setTravel] = useState<number | null>(null)
  /** 놓은 뒤 움직이는 중의 진행(0~1). 움직이지 않을 때는 null */
  const [settleT, setSettleT] = useState<number | null>(null)
  const [settle, setSettle] = useState<Settle | null>(null)
  const [size, setSize] = useState<Size>({ width: 0, half: 0 })
  const drag = useRef<Drag | null>(null)
  /** 끌기 뒤에 브라우저가 보내는 click은 무시한다 */
  const dragged = useRef(false)

  // 놓은 뒤: from → to를 SETTLE_MS 동안 ease-out으로
  useEffect(() => {
    if (settle === null) return
    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const k = Math.min((now - start) / SETTLE_MS, 1)
      setSettleT(settle.from + (settle.to - settle.from) * (1 - (1 - k) ** 3))
      if (k < 1) frame = requestAnimationFrame(step)
      else {
        setSettle(null)
        setSettleT(null)
      }
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [settle])

  function measure(button: HTMLElement): Size {
    const card = button.getBoundingClientRect()
    // 종이 높이는 아래 절반 칸의 높이
    const bottom = button.parentElement?.querySelector(`.${styles.bottom}`)
    const half = (bottom ?? button).getBoundingClientRect().height
    return { width: card.width || 0, half }
  }

  function startSettle(from: number, to: number) {
    if (from === to || reducedMotion() || typeof requestAnimationFrame !== 'function') return
    setSettle({ from, to })
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary) return
    const el = event.currentTarget
    try {
      // 손가락이 카드 밖으로 나가도 계속 받는다. 이미 끝난 포인터면 브라우저가 던진다 — 끌기는 그대로 둔다
      el.setPointerCapture?.(event.pointerId)
    } catch {
      // 잡지 못해도 카드 위에서는 끌린다
    }
    const s = measure(el)
    setSize(s)
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      start: up ? s.half * 2 : 0,
      size: s,
      moved: false,
    }
    dragged.current = false
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const d = drag.current
    if (d === null || event.pointerId !== d.pointerId) return
    const delta = d.startY - event.clientY
    if (!d.moved && Math.abs(delta) < DRAG_SLOP) return
    d.moved = true
    setTravel(Math.min(Math.max(d.start + delta, 0), d.size.half * 2))
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const d = drag.current
    if (d === null || event.pointerId !== d.pointerId) return
    drag.current = null
    if (!d.moved) return // 누르기 — click에서 넘긴다
    dragged.current = true
    if (travel !== null && d.size.half > 0) {
      const toUp = travel >= d.size.half
      setUp(toUp)
      startSettle(travel / (d.size.half * 2), toUp ? 1 : 0)
    }
    setTravel(null)
  }

  function onPointerCancel() {
    const d = drag.current
    drag.current = null
    if (travel !== null && d !== null && d.size.half > 0) {
      startSettle(travel / (d.size.half * 2), up ? 1 : 0)
    }
    setTravel(null)
  }

  function onClick(event: MouseEvent<HTMLButtonElement>) {
    if (dragged.current) {
      dragged.current = false
      return
    }
    setSize(measure(event.currentTarget))
    startSettle(up ? 1 : 0, up ? 0 : 1)
    setUp((v) => !v)
  }

  // 그릴 진행: 끄는 중 → 손가락, 놓은 뒤 → 움직임, 그 밖 → 아래(0)·위(1)
  const t = travel !== null && size.half > 0 ? travel / (size.half * 2) : (settleT ?? (up ? 1 : 0))
  const curl = pageCurl(size.width, size.half, t)
  const resting = curl === null
  const restUp = resting && t >= 1

  return (
    <section className={styles.card} aria-label="단어 카드">
      <div className={styles.top} aria-hidden={up ? true : undefined}>
        <span className={styles.source}>{sourceLabel}</span>
        <span className={styles.pos}>{posLabel}</span>
        <span className={styles.word} lang="en">
          {english}
        </span>
        {autoplay && (
          <span className={styles.autoplay}>
            <Volume2 size={16} strokeWidth={2} aria-hidden />
            발음 자동 재생
          </span>
        )}
      </div>
      <div className={styles.bottom}>
        <p id={meaningId} className={styles.meaning} aria-hidden={up ? undefined : true}>
          {korean}
        </p>
      </div>

      {/* 종이 그림 — 움직이지 않을 때는 아래·위 자리 한 장, 넘기는 중에는 남은 앞면·접힌 선·뒷면 */}
      {resting ? (
        <span
          className={[styles.paper, restUp ? styles.paperUp : styles.paperDown].join(' ')}
          aria-hidden
        >
          <span className={styles.handle} />
          {restUp ? (
            <ChevronDown size={20} strokeWidth={2} />
          ) : (
            <ChevronUp size={20} strokeWidth={2} />
          )}
          <span>{restUp ? '내려서 단어 보기' : '올려서 뜻 보기'}</span>
        </span>
      ) : (
        <>
          <span
            className={styles.coverLayer}
            aria-hidden
            style={{ clipPath: polygon(curl.cover) }}
          />
          <span className={styles.flapShadow} aria-hidden>
            <span
              className={styles.flap}
              style={{
                clipPath: polygon(curl.flap),
                // 뒷면 명암: 접힌 선 쪽이 어둡고 끝(모서리)으로 갈수록 밝다
                backgroundImage: `linear-gradient(${curl.crease.angle}deg, var(--paper-back-dark), var(--paper-back-light) 70%)`,
              }}
            />
          </span>
          <span
            className={styles.crease}
            aria-hidden
            style={{
              left: curl.crease.x,
              top: curl.crease.y,
              width: curl.diagonal * 2,
              transform: `translate(-50%, -50%) rotate(${curl.crease.angle}deg)`,
            }}
          />
        </>
      )}

      {/* 카드 전체가 버튼 — 이름은 지금 할 수 있는 동작 */}
      <button
        type="button"
        className={[styles.grab, travel !== null && styles.dragging].filter(Boolean).join(' ')}
        style={
          { '--shift': travel !== null ? `${travel}px` : up ? '100%' : '0px' } as CSSProperties
        }
        aria-expanded={up}
        aria-controls={meaningId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={onClick}
      >
        <span className={styles.srOnly}>{up ? '내려서 단어 보기' : '올려서 뜻 보기'}</span>
      </button>
    </section>
  )
}
