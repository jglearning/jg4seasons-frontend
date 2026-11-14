import { useId, type ReactNode } from 'react'
import styles from './RadioGroup.module.css'

// 하나 고르기(교사·관리자·운영자 폼 — 예: O-02 사용권 직영/연계). CheckboxGroup과 같은 모양:
// <fieldset> + <legend> + <input type="radio"> + <label> — 화살표 키 이동·스크린 리더 기본 동작 그대로.
// value가 undefined면 아무것도 고르지 않은 상태(기본값 없이 반드시 고르게 할 때)
export type RadioOption<V extends string> = { value: V; label: string; description?: string }

type RadioGroupProps<V extends string> = {
  legend: ReactNode
  options: RadioOption<V>[]
  value: V | undefined
  onChange: (next: V) => void
  error?: ReactNode
  required?: boolean
  disabled?: boolean
}

export function RadioGroup<V extends string>({
  legend,
  options,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
}: RadioGroupProps<V>) {
  const baseId = useId()
  const errorId = error ? `${baseId}-error` : undefined
  return (
    <fieldset
      className={styles.group}
      aria-invalid={error ? true : undefined}
      aria-describedby={errorId}
      disabled={disabled}
    >
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.options}>
        {options.map((option) => {
          const id = `${baseId}-${option.value}`
          // 라벨 전체(설명 포함)를 누를 수 있게 두되, 이름은 label 글자만·설명은 설명으로 읽힌다
          const labelId = `${id}-label`
          const descriptionId = option.description ? `${id}-description` : undefined
          return (
            <label key={option.value} htmlFor={id} className={styles.option}>
              <input
                id={id}
                type="radio"
                name={baseId}
                className={styles.radio}
                value={option.value}
                checked={option.value === value}
                onChange={() => onChange(option.value)}
                required={required}
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
              />
              <span className={styles.text}>
                <span id={labelId}>{option.label}</span>
                {option.description && (
                  <span id={descriptionId} className={styles.description}>
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          )
        })}
      </div>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
