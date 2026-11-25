// 캐릭터 자막에서 그 회차 단어를 찾는다(학생 말에는 쓰지 않는다).
// 규칙: 대소문자 무시, 단어 경계 기준. 끝에 s · es · ed · ing · d가 붙은 꼴도 같은 단어
// (숙어는 마지막 낱말에만 — played soccer는 못 찾는다. y→ied·자음 겹침(stopped)은 처리하지 않는다).
// 숙어(여러 낱말)는 낱말이 이어서(사이에 공백만) 나올 때만. 다른 단어 속에 든 것은 찾지 않는다(cat ↛ category).
// 겹치면 긴 단어(숙어)가 먼저

export type LessonWord = { english: string; korean: string }

export type CaptionSegment = { text: string; word?: LessonWord }

const SUFFIX = '(?:s|es|ed|ing|d)?'
const LETTER = "[A-Za-z0-9'’]"

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function pattern(english: string): string | undefined {
  const parts = english.trim().split(/\s+/).filter(Boolean).map(escape)
  if (parts.length === 0) return undefined
  return `${parts.join('\\s+')}${SUFFIX}`
}

/** 자막을 강조할 조각과 아닌 조각으로 나눈다. 조각을 이어 붙이면 원문 그대로 */
export function findLessonWords(text: string, words: readonly LessonWord[]): CaptionSegment[] {
  const entries = words
    .map((word) => ({ word, source: pattern(word.english) }))
    .filter((entry): entry is { word: LessonWord; source: string } => entry.source !== undefined)
    .sort((a, b) => b.word.english.length - a.word.english.length)
  if (entries.length === 0 || text === '') return text === '' ? [] : [{ text }]

  const groups = entries.map((entry) => `(${entry.source})`).join('|')
  const regex = new RegExp(`(?<!${LETTER})(?:${groups})(?!${LETTER})`, 'gi')

  const segments: CaptionSegment[] = []
  let last = 0
  for (const match of text.matchAll(regex)) {
    const index = match.index
    const group = match.findIndex((value, i) => i > 0 && value !== undefined)
    if (group < 1) continue
    if (index > last) segments.push({ text: text.slice(last, index) })
    segments.push({ text: match[0], word: entries[group - 1].word })
    last = index + match[0].length
  }
  if (last < text.length) segments.push({ text: text.slice(last) })
  return segments
}
