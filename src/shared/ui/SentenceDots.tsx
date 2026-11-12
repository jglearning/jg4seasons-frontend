import styles from './SentenceDots.module.css'

// S-05 문장 점(v0.2 지시문 §2.2-13). 들은 문장(표시용 80% 규칙 — 판정 아님) 채움, 지금 문장 흰 면 + 굵은 테두리, 남은 문장 옅은 점.
// 문장이 MAX_DOTS를 넘으면 그리지 않는다(숫자만). 장식이 아니라 그림 하나로 읽는다(role="img")
const MAX_DOTS = 14

type SentenceDotsProps = {
  count: number
  /** 지금 문장(0부터). 없으면 -1 */
  current: number
  heard: boolean[]
}

export function SentenceDots({ count, current, heard }: SentenceDotsProps) {
  if (count === 0 || count > MAX_DOTS) return null
  const label = current >= 0 ? `문장 ${count}개 중 ${current + 1}번째` : `문장 ${count}개`
  return (
    <div className={styles.dots} role="img" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={[
            styles.dot,
            i === current ? styles.current : heard[i] ? styles.heard : styles.rest,
          ].join(' ')}
          data-state={i === current ? 'current' : heard[i] ? 'heard' : 'rest'}
        />
      ))}
    </div>
  )
}
