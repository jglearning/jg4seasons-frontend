import { Mic, Phone } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { Button } from '../../../shared/ui/Button'
import { sentenceText } from './captionText'
import { findLessonWords, type LessonWord } from './lessonWords'
import { TalkCover, type Art } from './TalkCover'
import type { TalkSnapshot } from './talkCall'
import styles from './Talk.module.css'

// 대화 화면(시안 11/26 ②~⑤).
// ② 연결 중: 화면 전체 레벨 바탕 — "연결하고 있어요" + 점 3개, 가운데 큰 표지 그림, 아래 끊기.
// ③④ 대화: 위 레벨 바탕 면(남은 시간 + 표지 그림) / 아래 연한 바탕 — 상태 줄(말하는 쪽 + 음량 막대) → 자막 / 맨 아래 끊기.
// 자막은 말풍선 없이 줄 글자: 지금 캐릭터 줄 20px 700, 지난 줄·학생 줄 15px muted(최근 3줄).
// 캐릭터 말 속 회차 단어는 굵게 + 레벨 진한 색 밑줄(색만으로 구분하지 않음) — 누르는 동작 없음(시안 11/26).
// ⑤ 끝내기 확인: 어두운 막 + 아래 시트(대화 상자). 떠 있는 동안 타이머는 계속 간다.
// 화면 낭독기: 단어마다 읽히지 않게 자막 영역은 알리지 않고, 완성된 캐릭터 줄만 따로 한 번(aria-live)

const STATUS: Record<TalkSnapshot['phase'], string> = {
  connecting: '연결하고 있어요',
  listening: '듣고 있어요',
  speaking: '말하고 있어요',
  ending: '대화를 정리하고 있어요',
  ended: '대화를 정리하고 있어요',
}

const VISIBLE_LINES = 3
/** 음량 막대 모양(px) — 묶음 전체가 소리 크기만큼 세로로 커진다(talkDevice LevelMeter) */
const BARS = [10, 18, 20, 14, 8]

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeReduced(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const query = window.matchMedia(REDUCED_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  )
}

type CallViewProps = {
  art: Art
  snapshot: TalkSnapshot
  lessonWords: readonly LessonWord[]
  /** 음량 막대 묶음 — 그려지는 순간 LevelMeter에 붙인다(연결 중 화면에는 없다) */
  barRef: Ref<HTMLSpanElement>
  onEnd: () => void
}

export function CallView({ art, snapshot, lessonWords, barRef, onEnd }: CallViewProps) {
  const reduced = useReducedMotion()
  const [confirming, setConfirming] = useState(false)
  const hangupRef = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)

  const connecting = snapshot.phase === 'connecting'
  const speaking = snapshot.phase === 'speaking'
  const ending = snapshot.phase === 'ending' || snapshot.phase === 'ended'
  const sheetOpen = confirming && !ending

  // 시트를 닫으면(계속 말하기·Esc) 포커스를 끊기 버튼으로 돌려준다
  useEffect(() => {
    if (!sheetOpen && wasConfirming.current) hangupRef.current?.focus()
    wasConfirming.current = sheetOpen
  }, [sheetOpen])

  const lines = snapshot.lines
    .map((line) => ({ line, text: reduced ? sentenceText(line) : line.text }))
    .filter((item) => item.text.trim() !== '')
    .slice(-VISIBLE_LINES)
  const current = lines.findLast((item) => item.line.role === 'character')?.line.id

  return (
    <div className={connecting ? styles.connectScreen : styles.call}>
      {/* 시트가 떠 있으면 뒤 화면은 누를 수도 읽을 수도 없게(inert) */}
      <div className={styles.callContent} inert={sheetOpen}>
        {connecting ? (
          <>
            <div className={styles.connectHead}>
              <p className={styles.connectTitle}>연결하고 있어요</p>
              <span className={styles.dots} aria-hidden>
                <span />
                <span />
                <span />
              </span>
            </div>
            <div className={styles.connectArt}>
              {art.src && <img className={styles.connectArtImg} src={art.src} alt={art.alt} />}
            </div>
          </>
        ) : (
          <>
            <TalkCover art={art} variant="stage">
              <span
                className={styles.time}
                role="timer"
                aria-label={`남은 시간 ${Math.floor(snapshot.remaining / 60)}분 ${snapshot.remaining % 60}초`}
              >
                {clock(snapshot.remaining)}
              </span>
            </TalkCover>
            <div className={styles.callBody}>
              {/* 말하는 쪽: 캐릭터 = 레벨 색 막대 + 글자, 나 = 마이크 + 글자 + ink 막대.
                  막대 요소는 하나(음량 막대가 붙어 있는 요소) — 순서만 CSS로 바꾼다 */}
              <p className={speaking ? `${styles.status} ${styles.statusSpeaking}` : styles.status}>
                {!speaking && !ending && (
                  <Mic size={20} strokeWidth={2} className={styles.statusIcon} aria-hidden />
                )}
                <span>{STATUS[snapshot.phase]}</span>
                <span ref={barRef} className={styles.bars} aria-hidden>
                  {BARS.map((height, i) => (
                    <span key={i} style={{ height }} />
                  ))}
                </span>
              </p>
              <div className={styles.captions}>
                {lines.map(({ line, text }) => (
                  <p
                    key={line.id}
                    className={line.id === current ? styles.lineCurrent : styles.linePast}
                  >
                    {line.role === 'character' ? (
                      <CharacterText text={text} words={lessonWords} />
                    ) : (
                      text
                    )}
                  </p>
                ))}
              </div>
            </div>
          </>
        )}

        <p className={styles.srOnly} aria-live="polite">
          {snapshot.announce}
        </p>

        <div className={styles.callBottom}>
          <button
            ref={hangupRef}
            type="button"
            className={connecting ? `${styles.hangup} ${styles.hangupOnLevel}` : styles.hangup}
            aria-label="대화 끝내기"
            onClick={() => setConfirming(true)}
            disabled={ending}
          >
            <Phone size={28} strokeWidth={2} className={styles.hangupIcon} aria-hidden />
          </button>
        </div>
      </div>

      {sheetOpen && <EndSheet onContinue={() => setConfirming(false)} onEnd={onEnd} />}
    </div>
  )
}

/** ⑤ 끝내기 확인 — 아래 시트. 열리면 "계속 말하기"에 포커스, Tab은 시트 안에서만 돈다, Esc·막 누르기 = 계속 말하기 */
function EndSheet({ onContinue, onEnd }: { onContinue: () => void; onEnd: () => void }) {
  const titleId = useId()
  const descId = useId()
  const sheetRef = useRef<HTMLDivElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    continueRef.current?.focus()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onContinue()
      return
    }
    if (event.key !== 'Tab' || !sheetRef.current) return
    const buttons = [...sheetRef.current.querySelectorAll('button')]
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <>
      <div className={styles.scrim} aria-hidden onClick={onContinue} />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
      >
        <span className={styles.sheetHandle} aria-hidden />
        <div className={styles.sheetText}>
          <h2 id={titleId} className={styles.sheetTitle}>
            대화를 끝낼까요
          </h2>
          <p id={descId} className={styles.sheetSub}>
            지금까지 말한 내용을 정리해서 보여 드려요
          </p>
        </div>
        <div className={styles.sheetButtons}>
          <Button ref={continueRef} block onClick={onContinue}>
            계속 말하기
          </Button>
          <Button variant="secondary" block className={styles.endButton} onClick={onEnd}>
            끝내기
          </Button>
        </div>
      </div>
    </>
  )
}

/**
 * 단어마다 span(새 단어만 120ms 페이드 — 글자 위치가 key라 이미 보인 단어는 다시 움직이지 않는다.
 * 예외: 숙어가 완성되는 순간 앞 낱말이 강조 span 안으로 옮겨져 한 번 더 페이드)
 */
function CharacterText({ text, words }: { text: string; words: readonly LessonWord[] }) {
  const segments = findLessonWords(text, words)
  const starts = segments.map((_, i) =>
    segments.slice(0, i).reduce((sum, item) => sum + item.text.length, 0),
  )
  return (
    <>
      {segments.map((segment, i) => {
        const start = starts[i]
        const spans = wordSpans(segment.text, start)
        if (!segment.word) return spans
        return (
          <span key={`w${start}`} className={styles.lessonWord}>
            {spans}
          </span>
        )
      })}
    </>
  )
}

function wordSpans(text: string, start: number) {
  const parts: ReactNode[] = []
  for (const match of text.matchAll(/\S+|\s+/g)) {
    const at = start + match.index
    parts.push(
      /\s/.test(match[0][0]) ? (
        match[0]
      ) : (
        <span key={at} className={styles.word}>
          {match[0]}
        </span>
      ),
    )
  }
  return parts
}
