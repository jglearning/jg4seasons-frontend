import { Check } from 'lucide-react'
import styles from './Steps.module.css'

// 단계 표시(교사·관리자 화면 — A-05 명단 가져오기). <ol aria-label="단계">, 지금 단계는 aria-current="step".
// 지난 단계는 체크 + 눌러서 돌아감(onGo), 다음 단계는 누를 수 없음. 끝남·지금은 모양(체크·굵게)과 글자로도 구분한다
type StepsProps = {
  steps: string[]
  /** 지금 단계(0부터) */
  current: number
  /** 지난 단계를 눌렀을 때 — 없거나 locked면 지난 단계도 누를 수 없다 */
  onGo?: (index: number) => void
  /** 보내는 중처럼 돌아가면 안 될 때 */
  locked?: boolean
}

export function Steps({ steps, current, onGo, locked = false }: StepsProps) {
  return (
    <ol className={styles.steps} aria-label="단계">
      {steps.map((label, i) => {
        const done = i < current
        const state = done ? 'done' : i === current ? 'current' : 'next'
        const mark = (
          <>
            <span className={styles.mark} aria-hidden="true">
              {done ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className={styles.label}>{label}</span>
            {done && <span className={styles.srOnly}> (끝남)</span>}
          </>
        )
        return (
          <li
            key={label}
            className={styles.step}
            data-state={state}
            aria-current={i === current ? 'step' : undefined}
          >
            {done && onGo && !locked ? (
              <button type="button" className={styles.item} onClick={() => onGo(i)}>
                {mark}
              </button>
            ) : (
              <span className={styles.item}>{mark}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
