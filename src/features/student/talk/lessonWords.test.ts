import { describe, expect, it } from 'vitest'
import { findLessonWords, type LessonWord } from './lessonWords'

const WORDS: LessonWord[] = [
  { english: 'cheerful', korean: '쾌활한' },
  { english: 'visit', korean: '방문하다' },
  { english: 'play soccer', korean: '축구를 하다' },
  { english: 'cat', korean: '고양이' },
  { english: 'bake', korean: '굽다' },
]

const marked = (text: string, words = WORDS) =>
  findLessonWords(text, words)
    .filter((s) => s.word)
    .map((s) => `${s.text}=${s.word!.english}`)

describe('findLessonWords', () => {
  it('원형을 찾고, 조각을 이으면 원문 그대로', () => {
    const text = 'You look cheerful today!'
    const segments = findLessonWords(text, WORDS)
    expect(segments.map((s) => s.text).join('')).toBe(text)
    expect(marked(text)).toEqual(['cheerful=cheerful'])
  })

  it('대소문자를 가리지 않는다', () => {
    expect(marked('Cheerful people VISIT parks.')).toEqual(['Cheerful=cheerful', 'VISIT=visit'])
  })

  it('끝에 s · es · ed · ing · d가 붙은 꼴', () => {
    expect(marked('She visits, visited, and is visiting. Cats! She baked and bakes.')).toEqual([
      'visits=visit',
      'visited=visit',
      'visiting=visit',
      'Cats=cat',
      'baked=bake',
      'bakes=bake',
    ])
  })

  it('숙어는 낱말이 이어서 나올 때만(뒤 낱말에 붙은 꼴 포함)', () => {
    expect(marked('I play soccer and we played  soccer.')).toEqual(['play soccer=play soccer'])
    expect(marked('We like to play soccers')).toEqual(['play soccers=play soccer'])
    expect(marked('I play with a soccer ball.')).toEqual([])
  })

  it('다른 단어 속에 든 것은 강조하지 않는다', () => {
    expect(marked('This category is a revisit of cheerfulness and concatenate.')).toEqual([])
  })

  it('빈 목록이면 원문 한 조각', () => {
    expect(findLessonWords('Hello there', [])).toEqual([{ text: 'Hello there' }])
    expect(findLessonWords('', WORDS)).toEqual([])
  })

  it('정규식 특수 문자가 든 단어도 글자 그대로', () => {
    expect(marked('a.m. or am', [{ english: 'a.m.', korean: '오전' }])).toEqual(['a.m.=a.m.'])
  })
})
