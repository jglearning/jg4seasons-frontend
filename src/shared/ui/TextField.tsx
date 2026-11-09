import { useId, type ComponentPropsWithRef, type ReactNode } from 'react'
import styles from './TextField.module.css'

// 디자인 가이드 §5 Field. code는 가입 코드처럼 대문자·넓은 자간으로 보이는 입력.
// code의 대문자는 보이는 모양(text-transform)과 모바일 키보드(autoCapitalize)뿐이다 —
// 서버로 보낼 값의 대문자 변환은 쓰는 화면의 onChange에서 한다
type TextFieldProps = Omit<ComponentPropsWithRef<'input'>, 'size'> & {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  size?: 'student' | 'teacher'
  code?: boolean
  /** 라벨을 눈에서만 숨긴다(읽는 이름은 그대로) — 같은 칸이 줄마다 반복될 때 첫 줄만 보이게 */
  labelHidden?: boolean
}

const CODE_INPUT_PROPS = {
  autoCapitalize: 'characters',
  autoCorrect: 'off',
  autoComplete: 'off',
  spellCheck: false,
} as const

export function TextField({
  label,
  hint,
  error,
  size = 'student',
  code = false,
  labelHidden = false,
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
      <label htmlFor={inputId} className={labelHidden ? styles.srOnly : styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        className={[styles.input, styles[size], code && styles.code].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...(code ? CODE_INPUT_PROPS : {})}
        {...rest}
      />
      {error && (
        <p id={errorId} className={styles.error} role="alert">
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
