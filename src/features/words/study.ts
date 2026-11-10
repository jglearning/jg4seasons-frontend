// 단어 카드·카드 학습(S-06·S-06b, ADR-25)의 화면 계산. 서버는 모드별 최고 결과만 저장한다(03 §2.5) —
// 리콜·스펠 채점은 화면에서 한다(뜻·철자는 2.4 응답에 이미 있다, 11/6 동섭 승인)

/** 품사 표기(03 §2.4 — 표기는 프론트) */
export const POS_LABEL = {
  n: '명사',
  v: '동사',
  adj: '형용사',
  adv: '부사',
  prep: '전치사',
  conj: '접속사',
  pron: '대명사',
  interj: '감탄사',
  phr: '구',
} as const

/** 단어 출처(BE ADR-29): 어휘책 그 강의 단어·숙어 / 어휘책에 없는 회차 어휘. 음원 유무와는 따로다 */
export const SOURCE_LABEL = {
  book: '어휘책',
  extra: '추가 단어',
} as const

/**
 * 리콜 4지선다: 정답 + 같은 회차의 다른 뜻 3개를 섞은 단어 번호들.
 * 뜻이 같은 단어는 오답으로 쓰지 않는다(둘 다 정답처럼 보여서). random은 테스트에서 바꾼다
 */
export function pickChoices(
  words: ReadonlyArray<{ korean: string }>,
  answer: number,
  random: () => number = Math.random,
): number[] {
  const meaning = words[answer].korean
  const seen = new Set([meaning])
  const others: number[] = []
  for (const i of shuffle(
    words.map((_, i) => i).filter((i) => i !== answer),
    random,
  )) {
    if (seen.has(words[i].korean)) continue
    seen.add(words[i].korean)
    others.push(i)
    if (others.length === 3) break
  }
  return shuffle([answer, ...others], random)
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(Math.floor(random() * (i + 1)), i)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** 스펠 채점: 앞뒤 빈칸·대소문자 무시, 사이 빈칸은 하나로 */
export function isSpellCorrect(input: string, english: string): boolean {
  const normal = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase()
  return normal(input) !== '' && normal(input) === normal(english)
}

/** 예문 속 그 단어(대소문자 무시 첫 일치)를 나눈다. 못 찾으면 강조 없음 */
export function splitExample(example: string, word: string) {
  const at = word === '' ? -1 : example.toLowerCase().indexOf(word.toLowerCase())
  if (at < 0) return { before: example, match: '', after: '' }
  return {
    before: example.slice(0, at),
    match: example.slice(at, at + word.length),
    after: example.slice(at + word.length),
  }
}

// ── 암기: 알아요는 빼고, 몰라요는 맨 뒤로 보내 다시 ──

export type MemState = {
  /** 남은 카드(단어 번호), 맨 앞이 지금 카드 */
  queue: number[]
  known: number
  unknown: number
  /** 단어 번호 → 몰라요를 누른 횟수("다시 n번째") */
  again: Record<number, number>
}

export function memStart(count: number): MemState {
  return { queue: Array.from({ length: count }, (_, i) => i), known: 0, unknown: 0, again: {} }
}

export function memKnow(state: MemState): MemState {
  if (state.queue.length === 0) return state
  return { ...state, queue: state.queue.slice(1), known: state.known + 1 }
}

export function memDontKnow(state: MemState): MemState {
  if (state.queue.length === 0) return state
  const [head, ...rest] = state.queue
  return {
    ...state,
    queue: [...rest, head],
    unknown: state.unknown + 1,
    again: { ...state.again, [head]: (state.again[head] ?? 0) + 1 },
  }
}
