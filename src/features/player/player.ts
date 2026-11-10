import { createContext, useContext } from 'react'

// 플레이어 재생 상태는 이 컨텍스트 하나(CLAUDE.md). 오디오 요소도 하나 — 지문 음원(목소리별 파일)만 올린다(ADR-26·27).
// 목소리(us_w·us_m·uk_w·uk_m)는 파일(트랙)을 고르는 것이고, 속도 0.8·1.0·1.2는 playbackRate다(ADR-27, docs/adr/0001)

import { voiceLabel } from '../../shared/lessonLabel'
import type { Passage } from './lessonApi'
import { PLAYBACK_RATES, type PlaybackRate } from './listeningTracker'

export { PLAYBACK_RATES, type PlaybackRate }

/** 목소리 파일(생성 타입 enum에서) */
export type Variant = Passage['voices'][number]['variant']

/** 화면 글: 목소리 이름("미국 여") — 교사 화면과 같은 글(shared/lessonLabel) */
export const VOICE_LABEL = (variant: Variant): string => voiceLabel(variant) ?? variant

/** 0.8 → "0.8×", 1 → "1.0×" */
export function rateLabel(rate: PlaybackRate): string {
  return `${rate.toFixed(1)}×`
}

/** 소리가 안 날 때: load — 음원을 못 불러옴(404·디코드), blocked — 브라우저가 재생을 막음 */
export type PlayerError = 'load' | 'blocked'

/** 지금 올라간 지문 음원 하나 */
export type Source = {
  passageNo: number
  variant: Variant
  trackId: number
  audioUrl: string
  durationMs: number
}

export type PlayerValue = {
  source: Source | null
  playing: boolean
  positionMs: number
  /** 음원 정보를 받기 전에는 서버 durationMs, 받은 뒤에는 실제 길이 */
  durationMs: number
  error: PlayerError | null
  /** 재생 속도(playbackRate). 트랙을 바꿔도 유지 */
  rate: PlaybackRate
  setRate: (rate: PlaybackRate) => void
  /** 지금 트랙을 다시 불러와 재생 */
  retry: () => void
  /** 이 화면에서 그 트랙을 들은 구간(지금 트랙이 아니어도) */
  listenedOf: (trackId: number) => Array<[number, number]>
  /** 트랙을 올린다. atMs는 음원 정보를 받은 뒤 옮길 위치(목소리를 바꿀 때 같은 문장 시작으로) */
  load: (source: Source, options?: { play?: boolean; atMs?: number }) => void
  play: () => void
  toggle: () => void
  seekTo: (ms: number) => void
}

export const PlayerContext = createContext<PlayerValue | null>(null)

export function usePlayer(): PlayerValue {
  const value = useContext(PlayerContext)
  if (value === null) throw new Error('usePlayer는 PlayerProvider 안에서만')
  return value
}

/** 잠금화면 제목(STU-06): "Reading Day 5 · 지문 3 · 미국 여 · 1.0×" */
export function mediaTitle(lessonTitle: string, source: Source, rate: PlaybackRate): string {
  return `${lessonTitle} · 지문 ${source.passageNo} · ${VOICE_LABEL(source.variant)} · ${rateLabel(rate)}`
}
