import { useId, useState, type ReactNode } from 'react'
import styles from './CodeBoxes.module.css'

// 디자인 가이드 §5 Field — 개인 코드 4칸. 칸은 보여 주기만 하고, 실제 입력은 칸 위에 투명하게 겹친 input 하나가 받는다
// (칸을 누르면 그 input에 포커스가 가서 폰 숫자 키보드가 뜬다). 숫자 밖의 글자는 버린다
type CodeBoxesProps = {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  length?: number
  error?: ReactNode
  disabled?: boolean
  autoFocus?: boolean
}

export function CodeBoxes({
  label,
  value,
  onChange,
  length = 4,
  error,
  disabled,
  autoFocus,
}: CodeBoxesProps) {
  const id = useId()
  const errorId = error ? `${id}-error` : undefined
  const [focused, setFocused] = useState(false)

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
          const active = focused && i === Math.min(value.length, length - 1)
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
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={length}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, length))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}
