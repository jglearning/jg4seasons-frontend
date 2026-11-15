import { useCallback, useEffect, useRef, useState } from 'react'
import { renewAudioAccess } from '../../shared/audioAccess'

// 단어·예문 발음(S-06·S-06b). 오디오 요소 하나를 돌려 쓴다 — 새 소리를 틀면 앞 소리는 멈춘다.
// 청취 추적(flush)은 하지 않는다: 단어는 카드·학습 결과만 기록한다(ADR-25).
// 소리가 나지 않으면 blocked를 켜서 화면이 "눌러서 듣기"를 보인다:
// - 자동 재생을 브라우저가 막았다(사용자 동작 전)
// - 음원을 못 받았다(서명 쿠키 만료 403 등) — refresh를 한 번 보내 쿠키를 새로 받고 다시 튼 뒤에도 안 될 때.
//   S-05(PlayerProvider)와 같은 회복이고, 재생 요청 하나에 한 번만 한다
export function useWordAudio() {
  const audio = useRef<HTMLAudioElement | null>(null)
  // 가장 최근 재생 요청의 번호 — 갱신을 기다리는 사이 다른 소리가 요청됐거나 멈췄으면 앞 소리를 다시 틀지 않는다
  const latest = useRef(0)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    return () => {
      latest.current += 1
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
    const target = element
    latest.current += 1
    const request = latest.current

    const attempt = (renewed: boolean) => {
      void startSound(target, url)
        .then(() => setBlocked(false))
        .catch(async (reason: unknown) => {
          const name = reason instanceof Error ? reason.name : ''
          if (name === 'AbortError') return // 다음 소리가 끼어든 것
          if (name === 'NotAllowedError') {
            setBlocked(true)
            return
          }
          console.error('[audio] 단어 소리 재생 실패', { name, renewed })
          if (renewed) {
            setBlocked(true)
            return
          }
          const access = await renewAudioAccess()
          if (latest.current !== request) return
          if (access === 'ok') attempt(true)
          // 세션이 끝났으면('expired') 입장 화면으로 간다 — 표시를 바꾸지 않는다
          else if (access === 'failed') setBlocked(true)
        })
    }
    attempt(false)
  }, [])

  const stop = useCallback(() => {
    latest.current += 1
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
