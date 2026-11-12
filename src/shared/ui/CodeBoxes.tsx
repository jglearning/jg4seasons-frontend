import { useId, useState, type Ref, type SyntheticEvent } from 'react'
import styles from './CodeBoxes.module.css'

// 학생 입장 코드 칸(지시문 §6.1). 칸은 보여 주기만 하고, 실제 입력은 칸 위에 투명하게 겹친 <input> 하나가 받는다
// (붙여넣기·지우기·자동 완성이 자연스럽고, 칸을 누르면 그 input에 포커스가 가서 폰 키보드가 뜬다).
//   join  가입 코드 8칸(4 + 4) — 영문·숫자, 소문자는 대문자로, 칸에 글자를 보인다
//   pin   개인 코드 4칸 — 숫자만, 칸에는 ink 점만(옆 사람에게 안 보이게), 폰 숫자 키보드
// - 전각 글자는 반각으로. maxLength를 두지 않는다 — 브라우저가 붙여 넣은 값을 거르기 전에 잘라 버리기 때문(" 1234" → "123")
// - 커서는 항상 끝에 둔다(투명 input이라 커서가 안 보여, 중간에 끼워 넣으면 칸 순서가 뒤섞인다)
// - 오류 글은 부르는 쪽이 칸 아래 한 줄에 그리고 그 id를 describedBy로 넘긴다(오류가 없어도 자리를 비워 두는 줄)
type Kind = 'join' | 'pin'

type CodeBoxesProps = {
  kind: Kind
  /** 칸 위에 보이는 이름("가입 코드") */
  label: string
  /** 입력의 읽는 이름("가입 코드 8자리") */
  ariaLabel: string
  value: string
  onChange: (value: string) => void
  /** 오류 모양: 칸 테두리 --bad 2px(지금 칸은 ink) */
  invalid?: boolean
  describedBy?: string
  inputRef?: Ref<HTMLInputElement>
  /** 화면에 없는 동안(다른 단계) — 탭으로 오지 않게. 포커스는 코드로만 옮길 수 있다 */
  inactive?: boolean
}

const LENGTH: Record<Kind, number> = { join: 8, pin: 4 }

function sanitizeCode(kind: Kind, raw: string): string {
  const half = raw.normalize('NFKC')
  const kept =
    kind === 'pin' ? half.replace(/\D/g, '') : half.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return kept.slice(0, LENGTH[kind])
}

function caretToEnd(event: SyntheticEvent<HTMLInputElement>) {
  const input = event.currentTarget
  const end = input.value.length
  if (input.selectionStart !== end || input.selectionEnd !== end) input.setSelectionRange(end, end)
}

export function CodeBoxes({
  kind,
  label,
  ariaLabel,
  value,
  onChange,
  invalid = false,
  describedBy,
  inputRef,
  inactive = false,
}: CodeBoxesProps) {
  const id = useId()
  const [focused, setFocused] = useState(false)
  const length = LENGTH[kind]
  // 지금 칸(ink 2px)이 곧 포커스 표시다(입력이 투명해 포커스 링이 안 보인다). 다 찼으면 마지막 칸 —
  // 오류일 때는 빼서 ③처럼 칸 전체가 --bad로 보이게(11/13 동섭)
  let activeIndex = -1
  if (focused) {
    if (value.length < length) activeIndex = value.length
    else if (!invalid) activeIndex = length - 1
  }

  const box = (i: number) => {
    const char = value[i]
    return (
      <span
        key={i}
        data-box=""
        className={[styles.box, i === activeIndex ? styles.active : invalid && styles.invalid]
          .filter(Boolean)
          .join(' ')}
      >
        {char === undefined ? null : kind === 'pin' ? <span className={styles.dot} /> : char}
      </span>
    )
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={`${styles.boxes} ${styles[kind]}`}>
        <div className={styles.cells} aria-hidden="true">
          {kind === 'join' ? (
            <>
              <span className={styles.group}>{[0, 1, 2, 3].map(box)}</span>
              <span className={styles.group}>{[4, 5, 6, 7].map(box)}</span>
            </>
          ) : (
            [0, 1, 2, 3].map(box)
          )}
        </div>
        <input
          ref={inputRef}
          id={id}
          className={styles.input}
          type="text"
          inputMode={kind === 'pin' ? 'numeric' : 'text'}
          pattern={kind === 'pin' ? '[0-9]*' : undefined}
          autoComplete="off"
          autoCapitalize={kind === 'join' ? 'characters' : 'off'}
          autoCorrect="off"
          spellCheck={false}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          tabIndex={inactive ? -1 : undefined}
          value={value}
          onChange={(event) => onChange(sanitizeCode(kind, event.target.value))}
          onFocus={(event) => {
            setFocused(true)
            caretToEnd(event)
          }}
          onBlur={() => setFocused(false)}
          onSelect={caretToEnd}
          onClick={caretToEnd}
        />
      </div>
    </div>
  )
}
