import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'
import styles from './TextField.module.css'

// 디자인 가이드 §5 Field. code는 가입 코드처럼 대문자·넓은 자간으로 보이는 입력
type TextFieldProps = Omit<ComponentPropsWithRef<'input'>, 'size'> & {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  size?: 'student' | 'teacher'
  code?: boolean
}

export function TextField({
  label,
  hint,
  error,
  size = 'student',
  code = false,
  id,
  className,
  ...rest
}: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        className={[styles.input, styles[size], code && styles.code].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  )
}
