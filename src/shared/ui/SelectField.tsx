import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'
import styles from './SelectField.module.css'

// 디자인 가이드 §5 Field와 같은 모양의 고르기 칸(교사 40 / 학생 56). 브라우저 기본 <select>를 쓴다(키보드·스크린 리더 그대로)
export type SelectOption = { value: string; label: string }

type SelectFieldProps = Omit<ComponentPropsWithRef<'select'>, 'size'> & {
  label: ReactNode
  options: SelectOption[]
  error?: ReactNode
  size?: 'student' | 'teacher'
}

export function SelectField({
  label,
  options,
  error,
  size = 'teacher',
  id,
  className,
  ...rest
}: SelectFieldProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  const errorId = error ? `${selectId}-error` : undefined
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={selectId} className={styles.label}>
        {label}
      </label>
      <select
        id={selectId}
        className={[styles.select, styles[size]].join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
