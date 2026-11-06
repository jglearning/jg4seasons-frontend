import { useEffect, useRef } from 'react'
import {
  beaconFlush,
  describeFlushError,
  isPermanentFlushError,
  sendFlush,
  type FlushResult,
} from './flushApi'
import { ListeningTracker, mergeRanges } from './listeningTracker'

// 오디오 요소 하나에 지금 올라간 트랙의 추적기를 붙인다. 트랙이 바뀌거나 화면을 떠나면 떼면서 sendBeacon으로 보낸다.
// StrictMode의 effect 두 번 실행(붙임 → 뗌 → 붙임)에도 안전하다 — 세션은 첫 'playing'에서야 생기므로 뗄 때 보낼 것이 없다
type Options = {
  onResult: (result: FlushResult) => void
}

export function useListeningTracker(
  audio: HTMLAudioElement | null,
  trackId: number | undefined,
  { onResult }: Options,
) {
  const tracker = useRef<{ trackId: number; tracker: ListeningTracker } | null>(null)
  // 같은 화면에서 이 트랙으로 다시 돌아와도 들은 구간이 남게(트랙별)
  const saved = useRef(new Map<number, Array<[number, number]>>())
  // 콜백은 최신 것을 부른다(effect를 다시 돌리지 않으려고)
  const callback = useRef(onResult)
  useEffect(() => {
    callback.current = onResult
  })

  useEffect(() => {
    if (audio === null || trackId === undefined) return
    const store = saved.current
    const current = new ListeningTracker(audio, trackId, {
      send: sendFlush,
      beacon: beaconFlush,
      // 화면이 보이는 끝(pause·ended)은 fetch로 보내 응답(완료)을 바로 반영하고, 실패하면 남겨 다시 보낸다.
      // 화면 숨김·pagehide·트랙 전환은 sendBeacon
      finalVia: 'fetch',
      onResult: (result) => {
        if (result.dropped > 0) {
          // 서버가 버린 구간이 있다 = 클라이언트 규칙과 서버 검증이 어긋남(개인정보 없음)
          console.error('[flush] 서버가 버린 구간', {
            trackId: result.track.trackId,
            dropped: result.dropped,
          })
        }
        callback.current(result)
      },
      isPermanent: isPermanentFlushError,
      onDiscard: (reason, segments) => {
        console.error('[flush] 보내지 못하고 버린 구간', {
          trackId,
          segments,
          ...describeFlushError(reason),
        })
      },
      userAgent: navigator.userAgent,
    })
    current.start()
    tracker.current = { trackId, tracker: current }
    return () => {
      current.stop()
      const before = store.get(trackId) ?? []
      store.set(trackId, mergeRanges([...before, ...current.listenedRanges()]))
      if (tracker.current?.tracker === current) tracker.current = null
    }
  }, [audio, trackId])

  /** 이 화면에서 그 트랙을 들은 구간(합친 것). 지금 붙은 트랙이면 열린 구간까지 */
  return function listenedRanges(id: number): Array<[number, number]> {
    const before = saved.current.get(id) ?? []
    const live = tracker.current?.trackId === id ? tracker.current.tracker.listenedRanges() : []
    return mergeRanges([...before, ...live])
  }
}
