import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { FlushResult } from './flushApi'
import {
  mediaTitle,
  PlayerContext,
  type PlayerError,
  type PlayerValue,
  type Source,
} from './player'
import { useListeningTracker } from './useListeningTracker'

type ProviderProps = {
  children: ReactNode
  /** 잠금화면 제목에 쓴다(예: "Reading Day 5") */
  lessonTitle: string
  onTrackResult: (result: FlushResult) => void
}

// 오디오 요소 하나 + 지금 트랙의 청취 추적 + Media Session.
// 오디오 요소는 ref로 다루고(재생 위치·주소를 바꾸는 쪽), state는 추적기를 다시 붙일 때만 쓴다
export function PlayerProvider({ children, lessonTitle, onTrackResult }: ProviderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)
  const [source, setSource] = useState<Source | null>(null)
  const [playing, setPlaying] = useState(false)
  const [positionMs, setPositionMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [error, setError] = useState<PlayerError | null>(null)
  /** 음원 정보를 받으면 옮길 위치(ms) */
  const pendingAt = useRef(0)

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
    void element.play().catch((reason: unknown) => {
      setPlaying(false)
      const name = reason instanceof Error ? reason.name : ''
      if (name === 'AbortError') return
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
      setError(null)
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
    (next: Source, options: { play?: boolean; atMs?: number } = {}) => {
      const element = audioRef.current
      if (element === null) return
      element.pause()
      pendingAt.current = Math.max(options.atMs ?? 0, 0)
      setSource(next)
      setError(null)
      setPositionMs(0)
      setDurationMs(next.durationMs)
      element.src = next.audioUrl
      element.load()
      // 누른 그 순간에 재생을 시작한다(iOS Safari는 사용자 동작 밖의 play()를 막을 수 있다).
      // 위치 이동은 음원 정보를 받은 뒤(loadedmetadata)
      if (options.play) startPlaying(element)
    },
    [startPlaying],
  )

  const play = useCallback(() => {
    const element = audioRef.current
    if (element === null || sourceRef.current === null) return
    startPlaying(element)
  }, [startPlaying])

  const pause = useCallback(() => {
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

  useMediaSession(source, lessonTitle, playing, play, pause)

  const value = useMemo<PlayerValue>(
    () => ({
      source,
      playing,
      positionMs,
      durationMs,
      error,
      retry,
      listenedOf,
      load,
      play,
      toggle,
      seekTo,
    }),
    [source, playing, positionMs, durationMs, error, retry, listenedOf, load, play, toggle, seekTo],
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
  playing: boolean,
  play: () => void,
  pause: () => void,
) {
  useEffect(() => {
    if (source === null || !('mediaSession' in navigator)) return
    const session = navigator.mediaSession
    if (typeof MediaMetadata !== 'undefined') {
      session.metadata = new MediaMetadata({
        title: mediaTitle(lessonTitle, source),
        artist: '제이G 4 Seasons',
      })
    }
    session.setActionHandler('play', play)
    session.setActionHandler('pause', pause)
    return () => {
      session.setActionHandler('play', null)
      session.setActionHandler('pause', null)
    }
  }, [source, lessonTitle, play, pause])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [playing])
}
