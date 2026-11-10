import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { renewAudioAccess } from './audioAccess'
import type { FlushResult } from './flushApi'
import {
  mediaTitle,
  PlayerContext,
  type PlayerError,
  type PlaybackRate,
  type PlayerValue,
  type Source,
} from './player'
import { useListeningTracker } from './useListeningTracker'

/** keepRenew: 음원 오류 뒤 refresh하고 다시 부르는 것(그 오류에 refresh를 또 하지 않게) */
type LoadOptions = { play?: boolean; atMs?: number; keepRenew?: boolean }

type ProviderProps = {
  children: ReactNode
  /** 잠금화면 제목에 쓴다(예: "Reading Day 5") */
  lessonTitle: string
  onTrackResult: (result: FlushResult) => void
}

// 오디오 요소 하나 + 지금 트랙의 청취 추적 + Media Session + 재생 속도(playbackRate, ADR-27).
// 음원 오류는 서명 쿠키 만료(403)일 수 있어 refresh를 한 번 하고 같은 자리에서 다시 불러온다(백엔드 ADR-28).
// 오디오 요소는 ref로 다루고(재생 위치·주소를 바꾸는 쪽), state는 추적기를 다시 붙일 때만 쓴다
export function PlayerProvider({ children, lessonTitle, onTrackResult }: ProviderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)
  const [source, setSource] = useState<Source | null>(null)
  const [playing, setPlaying] = useState(false)
  const [positionMs, setPositionMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [error, setError] = useState<PlayerError | null>(null)
  const [rate, setRateState] = useState<PlaybackRate>(1)
  const rateRef = useRef<PlaybackRate>(1)
  /** 재생하려던 중인가(음원 오류 뒤 다시 불러올 때 이어서 재생할지) */
  const wantPlay = useRef(false)
  /** 이번 음원 오류에 refresh를 이미 해 봤는가 — 재생이 시작되면 다시 false */
  const renewTried = useRef(false)
  /** 음원 정보를 받으면 옮길 위치(ms) */
  const pendingAt = useRef(0)
  /** 오디오 이벤트(onError)에서 다시 불러올 때 쓰는 load — 아래에서 정의 뒤 채운다 */
  const loadRef = useRef<(next: Source, options?: LoadOptions) => void>(() => {})

  const attach = useCallback((element: HTMLAudioElement | null) => {
    audioRef.current = element
    setAudio(element)
  }, [])

  const sourceRef = useRef(source)
  useEffect(() => {
    sourceRef.current = source
  })

  const listenedRanges = useListeningTracker(audio, source?.trackId, { onResult: onTrackResult })
  const rangesRef = useRef(listenedRanges)
  useEffect(() => {
    rangesRef.current = listenedRanges
  })
  /** 이 화면에서 그 트랙을 들은 구간 — 추적기 안의 값이라 재생 위치(state)가 바뀌어 다시 그릴 때 읽는다 */
  const listenedOf = useCallback((trackId: number) => rangesRef.current(trackId), [])

  /** play()의 거절을 나눈다: 새 load가 끼어든 것(AbortError)은 무시, 막힘·음원 문제는 화면에 알린다 */
  const startPlaying = useCallback((element: HTMLAudioElement) => {
    wantPlay.current = true
    void element.play().catch((reason: unknown) => {
      setPlaying(false)
      const name = reason instanceof Error ? reason.name : ''
      if (name === 'AbortError') return
      // 음원 자체의 오류는 error 이벤트(아래 onError)가 먼저 와서 처리한다
      if (element.error) return
      setError(name === 'NotAllowedError' ? 'blocked' : 'load')
      console.error('[audio] 재생 실패', { name, trackId: sourceRef.current?.trackId })
    })
  }, [])

  // 오디오 이벤트 → 화면 상태
  useEffect(() => {
    const element = audioRef.current
    if (element === null) return
    const sync = () => {
      setPositionMs(Math.round(element.currentTime * 1000))
    }
    const onPlay = () => {
      setPlaying(true)
      wantPlay.current = true
      setError(null)
      renewTried.current = false
    }
    const onStop = () => {
      setPlaying(false)
      sync()
    }
    const onMeta = () => {
      if (!Number.isFinite(element.duration)) return
      setDurationMs(Math.round(element.duration * 1000))
      const at = pendingAt.current
      pendingAt.current = 0
      if (at > 0) element.currentTime = Math.min(at / 1000, element.duration)
    }
    const onError = () => {
      setPlaying(false)
      const current = sourceRef.current
      if (current !== null && !renewTried.current) {
        renewTried.current = true
        const atMs = Math.round(element.currentTime * 1000) || pendingAt.current
        const resume = wantPlay.current
        void renewAudioAccess().then((ok) => {
          if (sourceRef.current !== current) return
          if (ok) loadRef.current(current, { atMs, play: resume, keepRenew: true })
          else setError('load')
        })
        return
      }
      setError('load')
      console.error('[audio] 음원 오류', {
        code: element.error?.code,
        trackId: sourceRef.current?.trackId,
      })
    }
    element.addEventListener('playing', onPlay)
    element.addEventListener('pause', onStop)
    element.addEventListener('ended', onStop)
    element.addEventListener('timeupdate', sync)
    element.addEventListener('seeked', sync)
    element.addEventListener('loadedmetadata', onMeta)
    element.addEventListener('error', onError)
    return () => {
      element.removeEventListener('playing', onPlay)
      element.removeEventListener('pause', onStop)
      element.removeEventListener('ended', onStop)
      element.removeEventListener('timeupdate', sync)
      element.removeEventListener('seeked', sync)
      element.removeEventListener('loadedmetadata', onMeta)
      element.removeEventListener('error', onError)
    }
  }, [audio])

  const load = useCallback(
    (next: Source, options: LoadOptions = {}) => {
      const element = audioRef.current
      if (element === null) return
      element.pause()
      wantPlay.current = options.play ?? false
      if (!options.keepRenew) renewTried.current = false
      pendingAt.current = Math.max(options.atMs ?? 0, 0)
      setSource(next)
      setError(null)
      setPositionMs(0)
      setDurationMs(next.durationMs)
      element.src = next.audioUrl
      element.load()
      // 새 음원은 defaultPlaybackRate로 시작한다 — 고른 속도를 트랙이 바뀌어도 유지
      element.defaultPlaybackRate = rateRef.current
      element.playbackRate = rateRef.current
      // 누른 그 순간에 재생을 시작한다(iOS Safari는 사용자 동작 밖의 play()를 막을 수 있다).
      // 위치 이동은 음원 정보를 받은 뒤(loadedmetadata)
      if (options.play) startPlaying(element)
    },
    [startPlaying],
  )

  // loadRef는 위에서 선언 — 렌더마다 최신 load로
  useEffect(() => {
    loadRef.current = load
  })

  const setRate = useCallback((next: PlaybackRate) => {
    rateRef.current = next
    setRateState(next)
    const element = audioRef.current
    if (element === null) return
    element.defaultPlaybackRate = next
    element.playbackRate = next
  }, [])

  const play = useCallback(() => {
    const element = audioRef.current
    if (element === null || sourceRef.current === null) return
    startPlaying(element)
  }, [startPlaying])

  const pause = useCallback(() => {
    wantPlay.current = false
    audioRef.current?.pause()
  }, [])

  const toggle = useCallback(() => {
    const element = audioRef.current
    if (element === null) return
    if (element.paused) play()
    else pause()
  }, [play, pause])

  const retry = useCallback(() => {
    const current = sourceRef.current
    if (current !== null) load(current, { play: true })
  }, [load])

  const seekTo = useCallback((ms: number) => {
    const element = audioRef.current
    if (element === null) return
    const max = Number.isFinite(element.duration) ? element.duration : Infinity
    element.currentTime = Math.min(Math.max(ms / 1000, 0), max)
    // 멈춘 채 옮기면 timeupdate가 오지 않을 수 있다 — 위치는 바로 보인다
    setPositionMs(Math.round(element.currentTime * 1000))
  }, [])

  useMediaSession(source, lessonTitle, rate, playing, play, pause)

  const value = useMemo<PlayerValue>(
    () => ({
      source,
      playing,
      positionMs,
      durationMs,
      error,
      rate,
      setRate,
      retry,
      listenedOf,
      load,
      play,
      toggle,
      seekTo,
    }),
    [
      source,
      playing,
      positionMs,
      durationMs,
      error,
      rate,
      setRate,
      retry,
      listenedOf,
      load,
      play,
      toggle,
      seekTo,
    ],
  )

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {/* 화면에 보이지 않는 오디오 하나. 조작은 하단 플레이어 바로만 */}
      <audio ref={attach} preload="metadata" />
    </PlayerContext.Provider>
  )
}

// 잠금화면·알림 조작(STU-06). 재생은 재생, 일시정지는 일시정지 — 상태가 어긋나도 반대로 동작하지 않게
function useMediaSession(
  source: Source | null,
  lessonTitle: string,
  rate: PlaybackRate,
  playing: boolean,
  play: () => void,
  pause: () => void,
) {
  useEffect(() => {
    if (source === null || !('mediaSession' in navigator)) return
    const session = navigator.mediaSession
    if (typeof MediaMetadata !== 'undefined') {
      session.metadata = new MediaMetadata({
        title: mediaTitle(lessonTitle, source, rate),
        artist: '제이G 4 Seasons',
      })
    }
    session.setActionHandler('play', play)
    session.setActionHandler('pause', pause)
    return () => {
      session.setActionHandler('play', null)
      session.setActionHandler('pause', null)
    }
  }, [source, lessonTitle, rate, play, pause])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [playing])
}
