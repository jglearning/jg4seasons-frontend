// S-06 단어 카드 주소와 "이 단어만 보기" 거르기(#187) — 단어시험 결과(student/wordtest)가 주소를 만들고
// 단어 카드(words)가 읽는다. 기능 폴더끼리 import하지 않게 두 쪽이 여기만 본다.
// 거를 단어는 영어 철자(교재 단어 — 개인정보 아님)를 `?only=a,b,c`로. 주소에 있어 새로고침해도 유지된다

const ONLY = 'only'

/** 단어 카드 주소. only가 있으면 그 철자의 단어만 보이게(중복·빈 값은 뺀다) */
export function wordsPath(lessonCode: string, only?: readonly string[]): string {
  const path = `/lessons/${lessonCode}/words`
  const spellings = [...new Set((only ?? []).map((s) => s.trim()).filter((s) => s !== ''))]
  if (spellings.length === 0) return path
  return `${path}?${new URLSearchParams({ [ONLY]: spellings.join(',') })}`
}

/** 주소의 거를 철자. 없으면 undefined(전체) */
export function onlySpellings(search: URLSearchParams): string[] | undefined {
  const raw = search.get(ONLY)
  if (raw === null) return undefined
  const spellings = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
  return spellings.length === 0 ? undefined : spellings
}

/** 철자 비교 — 앞뒤 공백·대소문자는 무시(서버 정답 철자와 단어 철자가 같은 회차 데이터에서 온다) */
export function sameSpelling(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}
