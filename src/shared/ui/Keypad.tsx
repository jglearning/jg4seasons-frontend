import { Delete } from 'lucide-react'
import styles from './Keypad.module.css'

// 디자인 가이드 §5 Field — S-02의 화면 숫자 키패드(56px 키). 폰 키보드를 띄우지 않고 누른다
type KeypadProps = {
  onDigit: (digit: string) => void
  onDelete: () => void
  onClear: () => void
  disabled?: boolean
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function Keypad({ onDigit, onDelete, onClear, disabled }: KeypadProps) {
  return (
    <div className={styles.keypad}>
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          className={styles.key}
          disabled={disabled}
          onClick={() => onDigit(digit)}
        >
          {digit}
        </button>
      ))}
      <button
        type="button"
        className={`${styles.key} ${styles.action}`}
        disabled={disabled}
        onClick={onClear}
      >
        모두 지움
      </button>
      <button type="button" className={styles.key} disabled={disabled} onClick={() => onDigit('0')}>
        0
      </button>
      <button
        type="button"
        className={`${styles.key} ${styles.action}`}
        disabled={disabled}
        aria-label="한 글자 지우기"
        onClick={onDelete}
      >
        <Delete size={22} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
