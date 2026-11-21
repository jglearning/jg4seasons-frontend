import type { Passage } from './lessonApi'
import type { Variant } from './player'

// S-08 "들은 분량"(#130, BE #59에서 바뀜) — 지문마다 서버 `coverage`(목소리를 섞어 들은 것까지 합친 값) ×
// 그 지문에서 고른 목소리의 음원 길이, 합. 서버가 주는 값이 없어 화면이 곱한다(백엔드 handoff 11/21 권장).
// 표시용이다: 완료 판정에 쓰지 않고, 실제 흐른 시간도 아니다(재생 속도·다시 듣기는 반영되지 않는다) —
// 그래서 화면 글도 "들은 시간"이 아니라 "들은 분량"

type HeardPassage = Pick<Passage, 'coverage'> & {
  voices: ReadonlyArray<Pick<Passage['voices'][number], 'variant' | 'durationMs'>>
}

/** 회차 전체의 들은 분량(ms). 고른 목소리가 그 지문에 없으면 첫 목소리(화면이 실제로 듣는 목소리) */
export function heardAmountMs(passages: ReadonlyArray<HeardPassage>, variant: Variant): number {
  let total = 0
  for (const passage of passages) {
    const voice = passage.voices.find((v) => v.variant === variant) ?? passage.voices[0]
    if (voice !== undefined) total += passage.coverage * voice.durationMs
  }
  return Math.round(total)
}

/** "6분 12초" · 1분 미만 "45초" · 초가 0이면 "6분". 초 단위로 반올림 */
export function formatHeardAmount(ms: number): string {
  const seconds = Math.round(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes === 0) return `${rest}초`
  if (rest === 0) return `${minutes}분`
  return `${minutes}분 ${rest}초`
}
