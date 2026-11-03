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
  it('라벨로 찾을 수 있고, 오류가 있으면 aria-invalid와 설명이 이어진다', () => {
    render(<TextField label="가입 코드" hint="8자리" error="코드를 확인해 주세요" />)

    const input = screen.getByLabelText('가입 코드')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('코드를 확인해 주세요 8자리')
  })
})
