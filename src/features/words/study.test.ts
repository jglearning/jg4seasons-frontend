import { describe, expect, it } from 'vitest'
import { isSpellCorrect, memDontKnow, memKnow, memStart, pickChoices, splitExample } from './study'

const words = [
  { korean: '갑작스러운' },
  { korean: '불가능한' },
  { korean: '경쟁하다' },
  { korean: '갑작스러운' }, // 뜻이 같은 단어
  { korean: '자동의' },
  { korean: '기록' },
]

/** 늘 같은 순서를 내는 가짜 난수 */
function sequence(...values: number[]) {
  let i = 0
  return () => values[i++ % values.length]
}

describe('pickChoices — 리콜 4지선다(같은 회차 다른 뜻에서 오답 3개)', () => {
  it('정답 1개 + 오답 3개, 모두 다른 뜻', () => {
    const choices = pickChoices(words, 0, sequence(0.1, 0.5, 0.9, 0.3))
    expect(choices).toHaveLength(4)
    expect(choices).toContain(0)
    expect(new Set(choices.map((i) => words[i].korean)).size).toBe(4)
  })

  it('정답과 뜻이 같은 단어는 오답으로 쓰지 않는다', () => {
    for (let seed = 0; seed < 20; seed++) {
      const choices = pickChoices(words, 0, sequence(seed / 20, 0.7, 0.2, 0.95))
      expect(choices).not.toContain(3)
    }
  })

  it('뜻이 같은 단어를 건너뛰고 다른 뜻으로 채운다(다른 뜻이 딱 3개일 때)', () => {
    const five = [
      { korean: '가' },
      { korean: '가' },
      { korean: '나' },
      { korean: '다' },
      { korean: '라' },
    ]
    for (const r of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
      const choices = pickChoices(five, 0, sequence(r, 1 - r, r / 2))
      expect(choices.sort()).toEqual([0, 2, 3, 4])
    }
  })

  it('단어가 4개보다 적으면 있는 만큼', () => {
    expect(pickChoices(words.slice(0, 2), 1, Math.random).sort()).toEqual([0, 1])
  })

  it('정답 자리는 난수에 따라 달라진다(늘 첫째가 아니다)', () => {
    const places = new Set(
      [0, 0.3, 0.6, 0.9].map((r) => pickChoices(words, 2, sequence(r, r, r, r)).indexOf(2)),
    )
    expect(places.size).toBeGreaterThan(1)
  })
})

describe('isSpellCorrect — 스펠(화면 채점)', () => {
  it('앞뒤 빈칸·대소문자는 무시', () => {
    expect(isSpellCorrect('  Sudden ', 'sudden')).toBe(true)
    expect(isSpellCorrect('SUDDEN', 'sudden')).toBe(true)
  })

  it('철자가 다르거나 비었으면 틀림', () => {
    expect(isSpellCorrect('suden', 'sudden')).toBe(false)
    expect(isSpellCorrect('', 'sudden')).toBe(false)
  })

  it('두 단어 이상은 사이 빈칸 여러 개를 하나로', () => {
    expect(isSpellCorrect('look   after', 'look after')).toBe(true)
  })
})

describe('splitExample — 예문 속 단어 강조(대소문자 무시 첫 일치, 03 §2.4)', () => {
  it('첫 일치를 나눈다(예문의 원래 대소문자 그대로)', () => {
    expect(splitExample('Sudden rain. A sudden storm.', 'sudden')).toEqual({
      before: '',
      match: 'Sudden',
      after: ' rain. A sudden storm.',
    })
  })

  it('못 찾으면 강조 없음', () => {
    expect(splitExample('It rained.', 'storm')).toEqual({
      before: 'It rained.',
      match: '',
      after: '',
    })
  })
})

describe('암기 순서 — 알아요는 빼고 몰라요는 뒤로', () => {
  it('알아요를 누르면 빠지고 수를 센다', () => {
    const next = memKnow(memStart(3))
    expect(next.queue).toEqual([1, 2])
    expect(next.known).toBe(1)
  })

  it('몰라요를 누르면 맨 뒤로 가고 다시 나온 횟수를 센다', () => {
    let state = memDontKnow(memStart(3))
    expect(state.queue).toEqual([1, 2, 0])
    expect(state.unknown).toBe(1)
    expect(state.again[0]).toBe(1)
    state = memKnow(memKnow(state))
    state = memDontKnow(state)
    expect(state.queue).toEqual([0])
    expect(state.again[0]).toBe(2)
  })

  it('다 알면 빈 줄 — 아는 수는 단어 수', () => {
    let state = memStart(2)
    state = memDontKnow(state)
    state = memKnow(memKnow(state))
    expect(state.queue).toEqual([])
    expect(state.known).toBe(2)
  })

  it('빈 줄에서는 바뀌지 않는다', () => {
    const empty = memStart(0)
    expect(memKnow(empty)).toBe(empty)
    expect(memDontKnow(empty)).toBe(empty)
  })
})
