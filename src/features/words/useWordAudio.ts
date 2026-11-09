import { useCallback, useEffect, useRef, useState } from 'react'

// 단어·예문 발음(S-06·S-06b). 오디오 요소 하나를 돌려 쓴다 — 새 소리를 틀면 앞 소리는 멈춘다.
// 청취 추적(flush)은 하지 않는다: 단어는 카드·학습 결과만 기록한다(ADR-25).
// 자동 재생은 브라우저가 막을 수 있다(사용자 동작 전) — 막히면 blocked를 켜서 화면이 "눌러서 듣기"를 보인다
export function useWordAudio() {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    return () => {
      audio.current?.pause()
      audio.current = null
    }
  }, [])

  const play = useCallback((url: string | undefined) => {
    if (url === undefined) return
    let element = audio.current
    if (element === null) {
      element = new Audio()
      audio.current = element
    }
    void startSound(element, url)
      .then(() => setBlocked(false))
      .catch((reason: unknown) => {
        const name = reason instanceof Error ? reason.name : ''
        if (name === 'AbortError') return // 다음 소리가 끼어든 것
        if (name === 'NotAllowedError') setBlocked(true)
        else console.error('[audio] 단어 소리 재생 실패', { name })
      })
  }, [])

  const stop = useCallback(() => {
    audio.current?.pause()
  }, [])

  return { play, stop, blocked }
}

/** 앞 소리를 멈추고 처음부터 재생(요소를 바꾸는 일은 훅 밖에서) */
function startSound(element: HTMLAudioElement, url: string): Promise<void> {
  element.pause()
  element.src = url
  element.currentTime = 0
  return Promise.resolve(element.play())
}
