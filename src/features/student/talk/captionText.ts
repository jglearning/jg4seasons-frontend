import type { CaptionLine } from './talkCall'

/** 움직임 줄이기: 단어 대신 문장 단위 — 지금 푼 자리가 든 문장 끝까지 한 번에(끝 표시가 아직 안 왔으면 받은 데까지) */
export function sentenceText(line: CaptionLine): string {
  if (line.done || line.role !== 'character') return line.text
  if (line.text === '') return ''
  const from = Math.max(0, line.text.length - 1)
  const end = line.full.slice(from).search(/[.!?](\s|$)/)
  return end < 0 ? line.full : line.full.slice(0, from + end + 1)
}
