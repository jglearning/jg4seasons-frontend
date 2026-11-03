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

  it('붙여 넣은 값은 숫자만 남긴 뒤 4자리로 자른다(앞에 다른 글자가 있어도)', async () => {
    const onValue = vi.fn()
    render(<ControlledCodeBoxes onValue={onValue} />)

    await userEvent.click(screen.getByLabelText('개인 코드'))
    await userEvent.paste('코드 1234 5678')

    expect(onValue).toHaveBeenLastCalledWith('1234')
  })

  it('전각 숫자도 받는다', () => {
    const onChange = vi.fn()
    render(<CodeBoxes label="개인 코드" value="" onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('개인 코드'), { target: { value: '１２３４' } })

    expect(onChange).toHaveBeenCalledWith('1234')
  })

  it('커서는 늘 끝에 있다(중간에 끼워 넣어 칸 순서가 뒤섞이지 않게)', () => {
    render(<CodeBoxes label="개인 코드" value="12" onChange={() => {}} />)
    const input = screen.getByLabelText<HTMLInputElement>('개인 코드')

    input.setSelectionRange(0, 0)
    fireEvent.select(input)

    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 2])
  })

  it('기본은 숫자 키보드, 키패드와 같이 쓸 때는 폰 키보드를 띄우지 않는다', () => {
    const { rerender } = render(<CodeBoxes label="개인 코드" value="" onChange={() => {}} />)
    expect(screen.getByLabelText('개인 코드')).toHaveAttribute('inputmode', 'numeric')

    rerender(<CodeBoxes label="개인 코드" value="" onChange={() => {}} inputMode="none" />)
    expect(screen.getByLabelText('개인 코드')).toHaveAttribute('inputmode', 'none')
  })

  it('오류는 입력과 이어지고 바로 읽힌다', () => {
    render(
      <CodeBoxes
        label="개인 코드"
        value="12"
        onChange={() => {}}
        error="가입 코드 또는 개인 코드가 맞지 않아요"
      />,
    )

    const input = screen.getByLabelText('개인 코드')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('가입 코드 또는 개인 코드가 맞지 않아요')
    expect(screen.getByRole('alert')).toHaveTextContent('가입 코드 또는 개인 코드가 맞지 않아요')
  })
})

describe('Keypad', () => {
  it('숫자·한 글자 지우기·모두 지움을 각각 알린다(보이는 글자와 이름이 같다)', async () => {
    const onDigit = vi.fn()
    const onDelete = vi.fn()
    const onClear = vi.fn()
    render(<Keypad onDigit={onDigit} onDelete={onDelete} onClear={onClear} />)

    await userEvent.click(screen.getByRole('button', { name: '7' }))
    await userEvent.click(screen.getByRole('button', { name: '0' }))
    await userEvent.click(screen.getByRole('button', { name: '한 글자 지우기' }))
    await userEvent.click(screen.getByRole('button', { name: '모두 지움' }))

    expect(onDigit.mock.calls).toEqual([['7'], ['0']])
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('disabled면 모든 키가 막힌다', () => {
    render(<Keypad onDigit={() => {}} onDelete={() => {}} onClear={() => {}} disabled />)
    expect(screen.getAllByRole('button').every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
  })
})
