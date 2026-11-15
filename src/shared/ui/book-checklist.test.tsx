import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { BOOK_GROUPS, BOOK_OPTIONS } from '../books'
import { BookChecklist } from './BookChecklist'

// 교재 여러 권 고르기(O-03) — 세트·전체 체크와 중간 상태

function Harness({ initial = [] as string[], error }: { initial?: string[]; error?: string }) {
  const [selected, setSelected] = useState(initial)
  return (
    <>
      <BookChecklist
        legend="교재"
        groups={BOOK_GROUPS}
        selected={selected}
        onChange={setSelected}
        note={(code) => (code === 'L2-B1' ? '지정됨' : undefined)}
        error={error}
      />
      <output>{selected.join(',')}</output>
    </>
  )
}

const box = (name: string) => screen.getByRole<HTMLInputElement>('checkbox', { name })
const picked = () => screen.getByRole('status').textContent

describe('BookChecklist', () => {
  it('권 목록은 17권 — 레벨 4개는 세트 체크, 블랙은 한 권이라 세트 체크 없음', () => {
    render(<Harness />)

    expect(BOOK_OPTIONS).toHaveLength(17)
    expect(screen.getAllByRole('checkbox')).toHaveLength(1 + 4 + 17)
    expect(box('전체 17권')).not.toBeChecked()
    expect(box('그린 세트')).not.toBeChecked()
    expect(screen.queryByRole('checkbox', { name: '블랙 세트' })).not.toBeInTheDocument()
    expect(box('블랙 · 겨울 (K-B1)')).not.toBeChecked()
  })

  it('세트 체크는 그 레벨 4권을 넣고, 다시 누르면 뺀다. 순서는 레벨·권 순', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['L3-B2']} />)

    await user.click(box('그린 세트'))
    expect(picked()).toBe('L2-B1,L2-B2,L2-B3,L2-B4,L3-B2')
    expect(box('그린 세트')).toBeChecked()

    await user.click(box('그린 세트'))
    expect(picked()).toBe('L3-B2')
  })

  it('일부만 고르면 세트·전체가 중간 상태, 중간 상태에서 누르면 모두 넣는다', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(box('민트 · 봄 (L1-B2)'))
    expect(box('민트 세트').indeterminate).toBe(true)
    expect(box('민트 세트')).not.toBeChecked()
    expect(box('전체 17권').indeterminate).toBe(true)
    expect(box('그린 세트').indeterminate).toBe(false)

    await user.click(box('민트 세트'))
    expect(picked()).toBe('L1-B1,L1-B2,L1-B3,L1-B4')
    expect(box('민트 세트').indeterminate).toBe(false)
  })

  it('전체 체크는 17권을 넣고, 다시 누르면 모두 뺀다', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(box('전체 17권'))
    expect(picked()?.split(',')).toEqual(BOOK_OPTIONS.map((o) => o.value))
    expect(box('전체 17권')).toBeChecked()
    expect(box('네이비 세트')).toBeChecked()

    await user.click(box('전체 17권'))
    expect(picked()).toBe('')
  })

  it('권 옆 글자는 그 체크 칸의 설명으로 이어지고, 오류는 묶음에 붙어 바로 읽힌다', () => {
    render(<Harness error="교재를 고르세요" />)

    expect(box('그린 · 겨울 (L2-B1)')).toHaveAccessibleDescription('겨울 — 지정됨')
    expect(box('그린 · 봄 (L2-B2)')).not.toHaveAccessibleDescription()
    expect(screen.getByRole('group', { name: '교재' })).toHaveAccessibleDescription(
      '교재를 고르세요',
    )
    expect(screen.getByRole('alert')).toHaveTextContent('교재를 고르세요')
  })
})
