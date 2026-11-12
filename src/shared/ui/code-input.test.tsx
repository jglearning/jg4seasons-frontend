import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CodeBoxes } from './CodeBoxes'
import { Keypad } from './Keypad'

type Kind = 'join' | 'pin'
const NAMES: Record<Kind, string> = { join: '가입 코드 8자리', pin: '개인 코드 숫자 4자리' }

function Controlled({ kind, onValue }: { kind: Kind; onValue: (v: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <CodeBoxes
      kind={kind}
      label={kind === 'join' ? '가입 코드' : '개인 코드'}
      ariaLabel={NAMES[kind]}
      value={value}
      onChange={(v) => {
        setValue(v)
        onValue(v)
      }}
    />
  )
}

const boxes = () => Array.from(document.querySelectorAll('[data-box]'))

describe('CodeBoxes pin(개인 코드 4칸)', () => {
  it('숫자만 받고 4자리에서 멈추며, 칸에는 숫자 대신 점이 보인다', async () => {
    const onValue = vi.fn()
    render(<Controlled kind="pin" onValue={onValue} />)

    await userEvent.type(screen.getByLabelText(NAMES.pin), '0a4-2391')

    expect(screen.getByLabelText(NAMES.pin)).toHaveValue('0423')
    expect(onValue).toHaveBeenLastCalledWith('0423')
    expect(boxes()).toHaveLength(4)
    expect(
      boxes()
        .map((b) => b.textContent)
        .join(''),
    ).toBe('')
    expect(boxes().filter((b) => b.querySelector('span'))).toHaveLength(4)
  })

  it('붙여 넣은 값은 숫자만 남긴 뒤 4자리로 자른다, 전각 숫자도 받는다', async () => {
    const onValue = vi.fn()
    render(<Controlled kind="pin" onValue={onValue} />)

    await userEvent.click(screen.getByLabelText(NAMES.pin))
    await userEvent.paste('코드 1234 5678')
    expect(onValue).toHaveBeenLastCalledWith('1234')

    const onChange = vi.fn()
    render(<CodeBoxes kind="pin" label="x" ariaLabel="전각" value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('전각'), { target: { value: '１２３４' } })
    expect(onChange).toHaveBeenCalledWith('1234')
  })

  it('폰 숫자 키보드, 자동 완성 끔, 읽는 이름은 ariaLabel', () => {
    render(
      <CodeBoxes kind="pin" label="개인 코드" ariaLabel={NAMES.pin} value="" onChange={() => {}} />,
    )
    const input = screen.getByRole('textbox', { name: NAMES.pin })
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).toHaveAttribute('autocomplete', 'off')
  })

  it('커서는 늘 끝에 있다(중간에 끼워 넣어 칸 순서가 뒤섞이지 않게)', () => {
    render(<CodeBoxes kind="pin" label="x" ariaLabel="개인" value="12" onChange={() => {}} />)
    const input = screen.getByLabelText<HTMLInputElement>('개인')

    input.setSelectionRange(0, 0)
    fireEvent.select(input)

    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 2])
  })

  it('오류면 aria-invalid·describedBy, 칸은 --bad 테두리이고 지금 칸만 ink', () => {
    render(
      <>
        <CodeBoxes
          kind="pin"
          label="x"
          ariaLabel="개인"
          value=""
          onChange={() => {}}
          invalid
          describedBy="line"
        />
        <p id="line">개인 코드가 달라요. 다시 눌러요</p>
      </>,
    )
    const input = screen.getByLabelText('개인')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('개인 코드가 달라요. 다시 눌러요')

    fireEvent.focus(input)
    const [first, ...rest] = boxes()
    expect(first.className).toMatch(/active/)
    expect(first.className).not.toMatch(/invalid/)
    expect(rest.every((b) => /invalid/.test(b.className))).toBe(true)
  })

  it('다 찬 채 포커스면 마지막 칸이 지금 칸(포커스 표시), 오류면 지금 칸 없이 모두 --bad', () => {
    const { rerender } = render(
      <CodeBoxes kind="pin" label="x" ariaLabel="개인" value="1234" onChange={() => {}} />,
    )
    fireEvent.focus(screen.getByLabelText('개인'))
    expect(boxes()[3].className).toMatch(/active/)
    expect(
      boxes()
        .slice(0, 3)
        .some((b) => /active/.test(b.className)),
    ).toBe(false)

    rerender(
      <CodeBoxes kind="pin" label="x" ariaLabel="개인" value="1234" onChange={() => {}} invalid />,
    )
    expect(boxes().some((b) => /active/.test(b.className))).toBe(false)
    expect(boxes().every((b) => /invalid/.test(b.className))).toBe(true)
  })

  it('inactive면 탭으로 오지 않는다', () => {
    render(
      <CodeBoxes kind="pin" label="x" ariaLabel="개인" value="" onChange={() => {}} inactive />,
    )
    expect(screen.getByLabelText('개인')).toHaveAttribute('tabindex', '-1')
  })
})

describe('CodeBoxes join(가입 코드 8칸)', () => {
  it('영문·숫자만, 소문자는 대문자로, 8자에서 멈추고 칸에 글자가 보인다(4 + 4)', async () => {
    const onValue = vi.fn()
    render(<Controlled kind="join" onValue={onValue} />)

    await userEvent.type(screen.getByLabelText(NAMES.join), 'g7km-2xp4 extra')

    expect(screen.getByLabelText(NAMES.join)).toHaveValue('G7KM2XP4')
    expect(
      boxes()
        .map((b) => b.textContent)
        .join(''),
    ).toBe('G7KM2XP4')
    expect(document.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(2)
  })

  it('전각 영문도 반각 대문자로', () => {
    const onChange = vi.fn()
    render(<CodeBoxes kind="join" label="x" ariaLabel="가입" value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('가입'), { target: { value: 'ｇ７ｋｍ' } })
    expect(onChange).toHaveBeenCalledWith('G7KM')
  })

  it('대문자 자동 입력·맞춤법 검사 끔', () => {
    render(<CodeBoxes kind="join" label="x" ariaLabel="가입" value="" onChange={() => {}} />)
    const input = screen.getByLabelText('가입')
    expect(input).toHaveAttribute('autocapitalize', 'characters')
    expect(input).toHaveAttribute('spellcheck', 'false')
    expect(input).toHaveAttribute('inputmode', 'text')
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
