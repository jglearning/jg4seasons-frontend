import { PhoneOff } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react'
import { Button } from '../../../shared/ui/Button'
import { sentenceText } from './captionText'
import { findLessonWords, type LessonWord } from './lessonWords'
import type { TalkSnapshot } from './talkCall'
import styles from './Talk.module.css'

// 대화 화면(추가 지시 나-1·나-2, 11/25 밤) — 캐릭터와 통화하는 구조.
// 위: 남은 시간만 / 가운데: 상반신(화면 높이 절반 이상, 크림 면, 움직이지 않음) / 상태 줄 + 음량 막대 /
// 자막(말풍선 없이 줄글, 최대 3줄, 지금 줄만 또렷) / 아래 가운데: 끊기 버튼(누르면 확인 한 번).
// 캐릭터 말 속 회차 단어는 굵게 + 밑줄(색만으로 구분하지 않음), 누르면 자막 아래 한 줄로 뜻(3초).
// 화면 낭독기: 단어마다 읽히지 않게 자막 영역은 알리지 않고, 완성된 문장만 따로 한 번(aria-live)

const STATUS: Record<TalkSnapshot['phase'], string> = {
  connecting: '연결하고 있어요',
  listening: '듣고 있어요',
  speaking: '말하고 있어요',
  ending: '대화를 정리하고 있어요',
  ended: '대화를 정리하고 있어요',
}

const VISIBLE_LINES = 3
const WARN_SECONDS = 30
const MEANING_MS = 3_000

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

type Art = { src: string | undefined; alt: string }

type CallViewProps = {
  art: Art
  snapshot: TalkSnapshot
  lessonWords: readonly LessonWord[]
  barRef: RefObject<HTMLSpanElement | null>
  onEnd: () => void
}

export function CallView({ art, snapshot, lessonWords, barRef, onEnd }: CallViewProps) {
  const reduced = useReducedMotion()
  const [confirming, setConfirming] = useState(false)
  const [meaning, setMeaning] = useState<LessonWord | undefined>()
  const meaningTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const continueRef = useRef<HTMLButtonElement>(null)
  const hangupRef = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)

  // 끊기 확인: 누른 버튼이 사라지므로 포커스를 "계속하기"로, 계속하면 끊기 버튼으로 돌려준다(Impeccable audit 11/25)
  useEffect(() => {
    if (confirming) continueRef.current?.focus()
    else if (wasConfirming.current) hangupRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  // 뜻 한 줄: 3초 뒤 또는 다른 곳을 누르면 사라진다(대화는 멈추지 않는다)
  useEffect(() => {
    if (!meaning) return
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-lesson-word]'))
        setMeaning(undefined)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [meaning])
  useEffect(() => () => clearTimeout(meaningTimer.current), [])

  const showMeaning = (word: LessonWord) => {
    clearTimeout(meaningTimer.current)
    setMeaning(word)
    meaningTimer.current = setTimeout(() => setMeaning(undefined), MEANING_MS)
  }

  const connecting = snapshot.phase === 'connecting'
  const ending = snapshot.phase === 'ending' || snapshot.phase === 'ended'
  const lines = snapshot.lines
    .map((line) => ({ line, text: reduced ? sentenceText(line) : line.text }))
    .filter((item) => item.text.trim() !== '')
    .slice(-VISIBLE_LINES)

  return (
    <div className={styles.call}>
      {/* 위: 남은 시간 알약 / 가운데: 배경 없는 상반신(화면 폭 끝까지) / 아래: 흰 대화 패널(말풍선 + 끊기).
          그림 위에 말풍선을 겹치지 않고, 바탕색과 흰 패널로 캐릭터 자리와 대화 자리를 나눈다(11/25 동섭) */}
      <div className={styles.stageTop}>
        <div className={styles.timePill}>
          {connecting ? (
            <span className={styles.connecting}>연결하고 있어요</span>
          ) : (
            <span
              className={
                snapshot.remaining <= WARN_SECONDS
                  ? `${styles.time} ${styles.timeWarn}`
                  : styles.time
              }
              role="timer"
              aria-label={`남은 시간 ${Math.floor(snapshot.remaining / 60)}분 ${snapshot.remaining % 60}초`}
            >
              {clock(snapshot.remaining)}
            </span>
          )}
          {/* 말하는 쪽의 소리 크기 — 글자 상태 줄 대신(11/25 동섭) */}
          <span className={styles.meter} aria-hidden>
            <span ref={barRef} className={styles.meterBar} />
          </span>
        </div>
      </div>

      <div className={styles.stage}>
        {art.src && <img className={styles.stageArt} src={art.src} alt={art.alt} />}
      </div>

      <div className={styles.chatPanel}>
        <div className={styles.captions}>
          {lines.map(({ line, text }, index) => (
            <p
              key={line.id}
              className={[
                line.role === 'character' ? styles.lineCharacter : styles.lineStudent,
                index < lines.length - 1 && styles.linePast,
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {line.role === 'character' ? (
                <CharacterText text={text} words={lessonWords} onWord={showMeaning} />
              ) : (
                text
              )}
            </p>
          ))}
          {meaning && (
            <p className={styles.meaning}>
              <span className={styles.meaningWord}>{meaning.english}</span>
              {meaning.korean}
            </p>
          )}
        </div>

        {/* 화면 낭독기: 지금 상태(알리지 않음)와 완성된 문장(한 번 알림) */}
        {!connecting && <p className={styles.srOnly}>{STATUS[snapshot.phase]}</p>}
        <p className={styles.srOnly} aria-live="polite">
          {snapshot.announce}
        </p>

        <div className={styles.callBottom}>
          {confirming && !ending ? (
            <div className={styles.confirm}>
              <p className={styles.confirmText}>대화를 끝낼까요</p>
              <div className={styles.confirmButtons}>
                <Button
                  ref={continueRef}
                  variant="secondary"
                  block
                  onClick={() => setConfirming(false)}
                >
                  계속하기
                </Button>
                <Button block onClick={onEnd}>
                  끝내기
                </Button>
              </div>
            </div>
          ) : (
            <button
              ref={hangupRef}
              type="button"
              className={styles.hangup}
              aria-label="대화 끝내기"
              onClick={() => setConfirming(true)}
              disabled={ending}
            >
              <PhoneOff size={26} strokeWidth={2} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

type CharacterTextProps = {
  text: string
  words: readonly LessonWord[]
  onWord: (word: LessonWord) => void
}

/** 단어마다 span(새 단어만 120ms 페이드 — 글자 위치가 key라 이미 보인 단어는 다시 움직이지 않는다) */
function CharacterText({ text, words, onWord }: CharacterTextProps) {
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
        const word = segment.word
        return (
          <button
            key={`w${start}`}
            type="button"
            className={styles.lessonWord}
            aria-label={`${word.english} 뜻 보기`}
            data-lesson-word=""
            onClick={() => onWord(word)}
          >
            {spans}
          </button>
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
