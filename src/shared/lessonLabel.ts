// 회차·트랙 표시 글(학생·교사 화면 공용, 백엔드 ADR-27).
// 화면의 회차 번호는 code 끝: `L2-B1-05` → 5, `K-B1-07` → 7, `K-B1-S1` → 보충 1.
// lesson.number는 진도표 순서라(블랙은 보충 4회가 끼어 1~28) 교재 번호와 다르다 — 정렬에만 쓴다

type LessonNo = { supplement: boolean; n: number }

function parse(code: string): LessonNo | null {
  const match = /-(S?)(\d+)$/.exec(code)
  if (match === null) return null
  return { supplement: match[1] === 'S', n: Number(match[2]) }
}

/** 문장 속 번호: "5회" · "보충 1" */
export function lessonNoLabel(code: string): string {
  const no = parse(code)
  if (no === null) return code
  return no.supplement ? `보충 ${no.n}` : `${no.n}회`
}

/** 회차 타일 번호: "05" · "S1" */
export function lessonTileNo(code: string): string {
  const no = parse(code)
  if (no === null) return code
  return no.supplement ? `S${no.n}` : String(no.n).padStart(2, '0')
}

/** 교사 표 열 머리글: "Day 5" · "보충 1" */
export function lessonDayLabel(code: string): string {
  const no = parse(code)
  if (no === null) return code
  return no.supplement ? `보충 ${no.n}` : `Day ${no.n}`
}

const VOICE_LABEL: Record<string, string> = {
  us_w: '미국 여',
  us_m: '미국 남',
  uk_w: '영국 여',
  uk_m: '영국 남',
}

/** 지문 목소리 이름(us_w → "미국 여"). 목소리가 아니면 null */
export function voiceLabel(variant: string): string | null {
  return VOICE_LABEL[variant] ?? null
}
