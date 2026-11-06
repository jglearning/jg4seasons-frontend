import { useEffect, useRef, type RefObject } from 'react'
import { findSentence } from './sentenceSync'

// 따라 읽기(ADR-26, 가이드 §5 SentenceRow): 재생 위치 → 지금 문장, 재생이 다음 문장으로 넘어가면 그 상자를 화면 가운데로.
// 사용자가 직접 스크롤하면 5초 동안 자동 스크롤을 멈춘다(읽던 곳을 빼앗지 않게)
export const USER_SCROLL_PAUSE_MS = 5_000

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

type Options = {
  /** 재생을 시작한 뒤에만 지금 문장이 있다 */
  active: boolean
  playing: boolean
  /** 지금 문장 상자(aria-current)를 찾을 곳 */
  container: RefObject<HTMLElement | null>
}

/** 지금 문장 번호(0부터, 없으면 -1) */
export function useSentenceSync(
  timings: number[][],
  positionMs: number,
  { active, playing, container }: Options,
): number {
  const current = active ? findSentence(timings, positionMs) : -1
  const userScrolledAt = useRef(-Infinity)

  useEffect(() => {
    const mark = () => {
      userScrolledAt.current = Date.now()
    }
    const onKey = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key)) mark()
    }
    window.addEventListener('wheel', mark, { passive: true })
    window.addEventListener('touchmove', mark, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('wheel', mark)
      window.removeEventListener('touchmove', mark)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    if (!playing || current < 0) return
    if (Date.now() - userScrolledAt.current < USER_SCROLL_PAUSE_MS) return
    const row = container.current?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!row || typeof row.scrollIntoView !== 'function') return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    row.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
    // 문장이 바뀔 때만(재생 중 위치가 바뀔 때마다가 아니다)
  }, [current, playing, container])

  return current
}
