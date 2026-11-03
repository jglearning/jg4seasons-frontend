import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CodeBoxes } from './CodeBoxes'
import { Keypad } from './Keypad'

function ControlledCodeBoxes({ onValue }: { onValue: (v: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <CodeBoxes
      label="개인 코드"
      value={value}
      onChange={(v) => {
        setValue(v)
        onValue(v)
      }}
    />
  )
}

describe('CodeBoxes', () => {
  it('숫자만 받고 4자리에서 멈추며, 칸에 한 글자씩 보인다', async () => {
    const onValue = vi.fn()
    render(<ControlledCodeBoxes onValue={onValue} />)

    await userEvent.type(screen.getByLabelText('개인 코드'), '0a4-2391')

    expect(screen.getByLabelText('개인 코드')).toHaveValue('0423')
    expect(onValue).toHaveBeenLastCalledWith('0423')
    expect(screen.getAllByText(/^[0-9]$/).map((el) => el.textContent)).toEqual(['0', '4', '2', '3'])
  })

  it('maxLength를 거치지 않고 긴 값이 들어와도(붙여 넣기·자동 완성) 4자리만 넘긴다', () => {
    const onChange = vi.fn()
    render(<CodeBoxes label="개인 코드" value="" onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('개인 코드'), { target: { value: '1234 5678' } })

    expect(onChange).toHaveBeenCalledWith('1234')
  })

  it('숫자 키보드를 띄운다', () => {
    render(<CodeBoxes label="개인 코드" value="" onChange={() => {}} />)
    expect(screen.getByLabelText('개인 코드')).toHaveAttribute('inputmode', 'numeric')
  })
})

describe('Keypad', () => {
  it('숫자·지우기·모두 지우기를 각각 알린다', async () => {
    const onDigit = vi.fn()
    const onDelete = vi.fn()
    const onClear = vi.fn()
    render(<Keypad onDigit={onDigit} onDelete={onDelete} onClear={onClear} />)

    await userEvent.click(screen.getByRole('button', { name: '7' }))
    await userEvent.click(screen.getByRole('button', { name: '0' }))
    await userEvent.click(screen.getByRole('button', { name: '한 글자 지우기' }))
    await userEvent.click(screen.getByRole('button', { name: '모두 지우기' }))

    expect(onDigit.mock.calls).toEqual([['7'], ['0']])
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
