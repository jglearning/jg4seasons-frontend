import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CallView } from './CallView'
import { sentenceText } from './captionText'
import type { CaptionLine, TalkSnapshot } from './talkCall'

// 움직임 줄이기(prefers-reduced-motion): 단어 단위 대신 문장 단위로 한 번에

const speaking: CaptionLine = {
  id: 'r1',
  role: 'character',
  text: 'Hi',
  full: 'Hi there! How are you today?',
  done: false,
}

function snapshot(lines: CaptionLine[]): TalkSnapshot {
  return { phase: 'speaking', remaining: 120, lines, announce: '', closing: false }
}

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const caption = () =>
  [...document.querySelectorAll('p')].find(
    (p) => !p.hasAttribute('aria-live') && p.textContent?.startsWith('Hi'),
  )?.textContent

describe('sentenceText', () => {
  it('지금 푼 자리가 든 문장 끝까지', () => {
    expect(sentenceText(speaking)).toBe('Hi there!')
    expect(sentenceText({ ...speaking, text: 'Hi there! How' })).toBe(
      'Hi there! How are you today?',
    )
  })

  it('아직 시작 전이면 빈 글자, 끝난 줄과 학생 줄은 그대로', () => {
    expect(sentenceText({ ...speaking, text: '' })).toBe('')
    expect(sentenceText({ ...speaking, done: true })).toBe('Hi')
    expect(sentenceText({ ...speaking, role: 'student' })).toBe('Hi')
  })

  it('문장 끝 표시가 아직 안 왔으면 받은 데까지', () => {
    expect(sentenceText({ ...speaking, full: 'Hi there how are' })).toBe('Hi there how are')
  })
})

describe('CallView 움직임 줄이기', () => {
  const props = {
    art: { src: undefined, alt: '' },
    lessonWords: [],
    barRef: { current: null },
    onEnd: () => undefined,
  }

  it('움직임 줄이기면 문장 단위로 한 번에', () => {
    mockReducedMotion(true)
    render(<CallView {...props} snapshot={snapshot([speaking])} />)
    expect(caption()).toBe('Hi there!')
  })

  it('보통은 단어 단위(푼 데까지)', () => {
    mockReducedMotion(false)
    render(<CallView {...props} snapshot={snapshot([speaking])} />)
    expect(caption()).toBe('Hi')
    expect(screen.getByText('말하고 있어요')).toBeInTheDocument()
  })
})
