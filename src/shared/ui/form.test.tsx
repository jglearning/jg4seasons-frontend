import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'
import { TextField } from './TextField'

describe('Button', () => {
  it('기본 type은 button이다(폼 안에서 실수로 제출하지 않게)', () => {
    render(<Button>다음</Button>)
    expect(screen.getByRole('button', { name: '다음' })).toHaveAttribute('type', 'button')
  })
})

describe('TextField', () => {
  it('라벨로 찾을 수 있고, 오류가 있으면 aria-invalid·설명이 이어지며 바로 읽힌다', () => {
    render(<TextField label="가입 코드" hint="8자리" error="코드를 확인해 주세요" />)

    const input = screen.getByLabelText('가입 코드')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('코드를 확인해 주세요 8자리')
    expect(screen.getByRole('alert')).toHaveTextContent('코드를 확인해 주세요')
  })

  it('code 입력은 모바일에서 대문자로 치고 자동 고침을 끈다', () => {
    render(<TextField label="가입 코드" code />)

    const input = screen.getByLabelText('가입 코드')
    expect(input).toHaveAttribute('autocapitalize', 'characters')
    expect(input).toHaveAttribute('autocorrect', 'off')
    expect(input).toHaveAttribute('spellcheck', 'false')
  })
})
