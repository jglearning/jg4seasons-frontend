import { useId, type ReactNode } from 'react'
import styles from './CheckboxGroup.module.css'

// 여러 개 고르기(요일·담당 교사·담당 반). <fieldset> + <legend> + <input type="checkbox"> + <label> — 키보드·스크린 리더 기본 동작 그대로
export type CheckboxOption<V extends string | number> = { value: V; label: string }

type CheckboxGroupProps<V extends string | number> = {
  legend: ReactNode
  options: CheckboxOption<V>[]
  selected: V[]
  onChange: (next: V[]) => void
  error?: ReactNode
  /** 고를 것이 없을 때 */
  empty?: string
  disabled?: boolean
}

export function CheckboxGroup<V extends string | number>({
  legend,
  options,
  selected,
  onChange,
  error,
  empty = '고를 수 있는 항목이 없습니다',
  disabled = false,
}: CheckboxGroupProps<V>) {
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
      {options.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        <div className={styles.options}>
          {options.map((option) => {
            const id = `${baseId}-${option.value}`
            const checked = selected.includes(option.value)
            return (
              <label key={option.value} htmlFor={id} className={styles.option}>
                <input
                  id={id}
                  type="checkbox"
                  className={styles.box}
                  checked={checked}
                  onChange={() =>
                    onChange(
                      checked
                        ? selected.filter((v) => v !== option.value)
                        : [...selected, option.value],
                    )
                  }
                />
                {option.label}
              </label>
            )
          })}
        </div>
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
