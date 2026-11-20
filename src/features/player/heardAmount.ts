import type { Passage } from './lessonApi'

// S-08 "들은 분량"(#130) — 완료한 목소리의 음원 길이 합. 서버가 주는 값이 없어 화면이 더한다(백엔드 답 11/20).
// 표시용이다: 완료 판정에 쓰지 않고, 실제 흐른 시간도 아니다(재생 속도·다시 듣기는 반영되지 않는다) —
// 그래서 화면 글도 "들은 시간"이 아니라 "들은 분량"

type HeardPassage = {
  voices: ReadonlyArray<Pick<Passage['voices'][number], 'completed' | 'durationMs'>>
}

/** 회차 전체에서 `completed`인 목소리의 `durationMs` 합(ms). 한 지문에 완료한 목소리가 여럿이면 모두 더한다 */
export function heardAmountMs(passages: ReadonlyArray<HeardPassage>): number {
  let total = 0
  for (const passage of passages) {
    for (const voice of passage.voices) {
      if (voice.completed) total += voice.durationMs
    }
  }
  return total
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
