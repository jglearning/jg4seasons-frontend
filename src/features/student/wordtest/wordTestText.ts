import type { WordTestSection, WordTestSubmission } from './wordTestApi'
import { COPY } from './wordTestCopy'

// 진입 줄(홈 #173)·목록(#185)이 같이 쓰는 표시 글. 서버 상태·점수를 보여 주기만 한다

/** 영역 이름. 지금은 B만 — A·C·D는 낼 수 있게 될 때 문구를 정해 더한다 */
const SECTION_LABEL: Partial<Record<WordTestSection, string>> = { B: COPY.scoreLabel }

export function sectionLabel(section: WordTestSection): string {
  return SECTION_LABEL[section] ?? `${section} 영역`
}

/**
 * 도장판(#185) 동그라미 아래 짧은 글과 동그라미 모양. 채점 결과가 있으면 채운 동그라미 + "44/48",
 * 그 밖은 흰 동그라미 + 상태 한 단어. 갈래는 latestDetail과 같다
 */
export function stampOf(latest: WordTestSubmission | null): {
  done: boolean
  caption: string
} {
  if (latest === null) return { done: false, caption: COPY.stampNew }
  switch (latest.status) {
    case 'graded':
      return latest.score === null
        ? { done: false, caption: COPY.stampHeld }
        : { done: true, caption: `${latest.score}/${latest.total}` }
    case 'pending':
    case 'grading':
      return { done: false, caption: COPY.stampGrading }
    case 'failed':
      return { done: false, caption: COPY.stampFailed }
    default:
      return { done: false, caption: COPY.stampHeld }
  }
}

/** 보조 글 — 최근 제출의 서버 상태·점수. 제출 화면(StatusView)과 같은 갈래 */
export function latestDetail(latest: WordTestSubmission | null): string {
  if (latest === null) return COPY.entryNew
  switch (latest.status) {
    case 'graded':
      // 점수 없는 graded(계약 밖)는 제출 화면이 확인 안내로 받으므로 같은 글
      return latest.score === null
        ? COPY.held
        : `${sectionLabel(latest.section)} ${latest.score} / ${latest.total}`
    case 'pending':
    case 'grading':
      return COPY.grading
    case 'failed':
      return COPY.failed
    default:
      return COPY.held
  }
}
