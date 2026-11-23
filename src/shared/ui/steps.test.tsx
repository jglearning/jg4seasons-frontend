import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Steps } from './Steps'

const STEPS = ['붙여넣기', '열 고르기', '반 정하기', '검사·만들기']

describe('Steps', () => {
  it('지금 단계는 aria-current="step", 지난 단계만 눌러서 돌아감, 다음 단계는 버튼이 아님', async () => {
    const onGo = vi.fn()
    render(<Steps steps={STEPS} current={2} onGo={onGo} />)

    const list = screen.getByRole('list', { name: '단계' })
    const items = within(list).getAllByRole('listitem')
    expect(items[2]).toHaveAttribute('aria-current', 'step')
    expect(items.filter((i) => i.hasAttribute('aria-current'))).toHaveLength(1)

    const buttons = within(list).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['붙여넣기 (끝남)', '열 고르기 (끝남)'])
    await userEvent.click(buttons[1]!)
    expect(onGo).toHaveBeenCalledWith(1)
  })

  it('locked면 지난 단계도 누를 수 없다', () => {
    render(<Steps steps={STEPS} current={3} onGo={() => {}} locked />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
