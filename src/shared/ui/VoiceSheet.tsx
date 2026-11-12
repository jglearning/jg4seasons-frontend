import { Check, ChevronDown, Volume2 } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import styles from './VoiceSheet.module.css'

// S-05 음성 고르기(v0.2 지시문 §2.2-7, §2.4, 와이어프레임 S05_VoiceSheet).
// VoiceButton: 듣기 카드 왼쪽 위 흰 턱 버튼(스피커 + 지금 음성 이름 + ∨). 이름은 늘 지금 고른 음성
// VoiceSheet: 아래에서 올라오는 흰 시트, 뒤는 어둡게. 2×2 라디오(고르기만 — 적용 안 함) + 주 버튼 "이 음성으로 듣기"(적용하고 닫힘).
//   바깥을 누르거나 Esc면 바꾸지 않고 닫힌다. 열리면 고른 칸에 포커스, Tab은 시트 안에서만 돌고, 닫히면 연 버튼으로 돌아간다.
//   라디오는 방향키로 옮긴다(roving tabindex). 어떤 음성을 낼지는 부르는 쪽이 정한다(이 부품은 값만 돌려준다)
export type VoiceOption<V extends string> = { value: V; label: string; sub: string }

export function VoiceButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={styles.trigger}
      aria-label={`음성 고르기, 지금 ${label}`}
      aria-haspopup="dialog"
      onClick={onClick}
      disabled={disabled}
    >
      <Volume2 size={18} strokeWidth={2.2} aria-hidden />
      <span>{label}</span>
      <ChevronDown size={16} strokeWidth={2.4} className={styles.chevron} aria-hidden />
    </button>
  )
}

type VoiceSheetProps<V extends string> = {
  open: boolean
  options: VoiceOption<V>[]
  selected: V
  onApply: (value: V) => void
  onClose: () => void
}

export function VoiceSheet<V extends string>(props: VoiceSheetProps<V>) {
  if (!props.open) return null
  return <OpenSheet {...props} />
}

function OpenSheet<V extends string>({ options, selected, onApply, onClose }: VoiceSheetProps<V>) {
  const titleId = useId()
  const [choice, setChoice] = useState<V>(selected)
  const sheetRef = useRef<HTMLDivElement>(null)
  const radioRefs = useRef(new Map<V, HTMLButtonElement>())

  // 열릴 때 고른 칸에 포커스, 닫힐 때 연 버튼(직전 포커스)으로
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    radioRefs.current.get(selected)?.focus()
    return () => opener?.focus?.()
    // 열릴 때 한 번
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function move(step: number) {
    const index = options.findIndex((o) => o.value === choice)
    const next = options[(index + step + options.length) % options.length]
    setChoice(next.value)
    radioRefs.current.get(next.value)?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    // Tab은 시트 안에서만
    const focusable = [
      ...(sheetRef.current?.querySelectorAll<HTMLElement>('button:not([tabindex="-1"])') ?? []),
    ]
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function onRadioKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
    }
  }

  return (
    <div className={styles.layer}>
      <div className={styles.backdrop} onClick={onClose} aria-hidden />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <span className={styles.grip} aria-hidden />
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            음성 고르기
          </h2>
          <p className={styles.sub}>고르면 지금 문장부터 그 음성으로 이어서 들려요</p>
        </div>
        <div className={styles.grid} role="radiogroup" aria-label="음성">
          {options.map((option) => {
            const checked = option.value === choice
            return (
              <button
                key={option.value}
                ref={(el) => {
                  if (el) radioRefs.current.set(option.value, el)
                  else radioRefs.current.delete(option.value)
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                className={[styles.option, checked && styles.checked].filter(Boolean).join(' ')}
                onClick={() => setChoice(option.value)}
                onKeyDown={onRadioKey}
              >
                <span className={styles.names}>
                  <span className={styles.name}>{option.label}</span>
                  <span className={styles.en} lang="en">
                    {option.sub}
                  </span>
                </span>
                {checked && (
                  <Check size={24} strokeWidth={3} className={styles.check} aria-hidden />
                )}
              </button>
            )
          })}
        </div>
        <button type="button" className={styles.apply} onClick={() => onApply(choice)}>
          이 음성으로 듣기
        </button>
      </div>
    </div>
  )
}
