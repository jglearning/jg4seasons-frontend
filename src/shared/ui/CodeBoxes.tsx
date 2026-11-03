import { useId, useState, type ReactNode, type SyntheticEvent } from 'react'
import styles from './CodeBoxes.module.css'

// 디자인 가이드 §5 Field — 개인 코드 4칸. 칸은 보여 주기만 하고, 실제 입력은 칸 위에 투명하게 겹친 input 하나가 받는다
// (칸을 누르면 그 input에 포커스가 가서 폰 숫자 키보드가 뜬다).
// - 숫자 밖의 글자는 버리고 전각 숫자(１２３４)는 반각으로 바꾼다. maxLength를 두지 않는다 — 브라우저가 붙여 넣은 값을
//   숫자만 남기기 전에 잘라 버리기 때문(" 1234" → "123")
// - 커서는 항상 끝에 둔다(투명 input이라 커서가 안 보여, 중간에 끼워 넣으면 칸 순서가 뒤섞인다)
// - S-02처럼 화면 키패드와 같이 쓸 때는 inputMode="none"(폰 키보드가 키패드를 가리지 않게)과
//   showNext(포커스가 키패드 버튼에 있어도 다음 칸 표시)를 준다
type CodeBoxesProps = {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  length?: number
  error?: ReactNode
  disabled?: boolean
  autoFocus?: boolean
  inputMode?: 'numeric' | 'none'
  showNext?: boolean
}

function keepDigits(raw: string, length: number): string {
  return raw.normalize('NFKC').replace(/\D/g, '').slice(0, length)
}

function caretToEnd(event: SyntheticEvent<HTMLInputElement>) {
  const input = event.currentTarget
  const end = input.value.length
  if (input.selectionStart !== end || input.selectionEnd !== end) input.setSelectionRange(end, end)
}

export function CodeBoxes({
  label,
  value,
  onChange,
  length = 4,
  error,
  disabled,
  autoFocus,
  inputMode = 'numeric',
  showNext = false,
}: CodeBoxesProps) {
  const id = useId()
  const errorId = error ? `${id}-error` : undefined
  const [focused, setFocused] = useState(false)
  const highlight = (focused || showNext) && !disabled

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div
        className={styles.boxes}
        style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
      >
        {Array.from({ length }, (_, i) => {
          const filled = i < value.length
          const active = highlight && i === Math.min(value.length, length - 1)
          return (
            <div
              key={i}
              aria-hidden="true"
              className={[
                styles.box,
                filled && styles.filled,
                active && styles.active,
                error && styles.invalid,
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {value[i] ?? ''}
            </div>
          )
        })}
        <input
          id={id}
          className={styles.input}
          type="text"
          inputMode={inputMode}
          pattern="[0-9]*"
          autoComplete="off"
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          onChange={(event) => onChange(keepDigits(event.target.value, length))}
          onFocus={(event) => {
            setFocused(true)
            caretToEnd(event)
          }}
          onBlur={() => setFocused(false)}
          onSelect={caretToEnd}
          onClick={caretToEnd}
        />
      </div>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
