import { Volume2 } from 'lucide-react'
import styles from './WordCard.module.css'

// 디자인 가이드 §5 WordCard(S-06·S-06b 암기). 카드 전체가 버튼 — 탭하면 뒷면(뜻), 뒷면에서 탭하면 화면이 정한 다음 동작.
// 3D 플립 없음: 면이 바뀌면 150ms 페이드로 내용만 바꾼다. 앞면 흰 / 뒷면 surface
type WordCardProps = {
  side: 'front' | 'back'
  /** 왼쪽 위 작은 칩(단어 출처 "어휘책"·"추가 단어") */
  sourceLabel: string
  english: string
  posLabel: string
  korean: string
  /** 예문을 그 단어 앞·단어·뒤로 나눈 것(단어는 레벨 색 굵게) */
  example: { before: string; match: string; after: string }
  /** 예문 해석. 없으면(null) 영어 예문만 */
  exampleKo: string | null
  onTap: () => void
  /** 앞면에 "발음 자동 재생" 표시 */
  autoplay?: boolean
  /** 오른쪽 위 작은 글자(예: "다시 1번째") */
  corner?: string
  frontHint?: string
  backHint?: string
  /** 뒷면에서 영단어를 가린다(S-06 3단계, 가이드 11/6): 뜻만 보이고 예문 속 그 단어는 ____ */
  hideWord?: boolean
}

export function WordCard({
  side,
  sourceLabel,
  english,
  posLabel,
  korean,
  example,
  exampleKo,
  onTap,
  autoplay = false,
  corner,
  frontHint = '탭하면 뜻이 보여요',
  backHint,
  hideWord = false,
}: WordCardProps) {
  const back = side === 'back'
  return (
    <button
      type="button"
      className={[styles.card, back && styles.back].filter(Boolean).join(' ')}
      onClick={onTap}
    >
      <span className={styles.source}>{sourceLabel}</span>
      {corner && <span className={styles.corner}>{corner}</span>}
      {back ? (
        <span key="back" className={styles.face}>
          {hideWord ? (
            <span className={styles.pos}>{posLabel}</span>
          ) : (
            <span className={styles.headRow}>
              <span className={styles.smallWord} lang="en">
                {english}
              </span>
              <span className={styles.pos}>{posLabel}</span>
            </span>
          )}
          <span className={styles.meaning}>{korean}</span>
          <span className={styles.rule} aria-hidden />
          <span className={styles.label}>예문</span>
          <span className={styles.example} lang="en">
            {example.before}
            {example.match &&
              (hideWord ? (
                <strong className={styles.match}>
                  <span aria-hidden>{'_'.repeat(Math.max(3, example.match.length))}</span>
                  <span className={styles.srOnly}>빈칸</span>
                </strong>
              ) : (
                <strong className={styles.match}>{example.match}</strong>
              ))}
            {example.after}
          </span>
          {exampleKo !== null && <span className={styles.exampleKo}>{exampleKo}</span>}
          {backHint && <span className={styles.hint}>{backHint}</span>}
        </span>
      ) : (
        <span key="front" className={styles.face}>
          <span className={styles.pos}>{posLabel}</span>
          <span className={styles.word} lang="en">
            {english}
          </span>
          {autoplay && (
            <span className={styles.autoplay}>
              <Volume2 size={16} strokeWidth={2} aria-hidden />
              발음 자동 재생
            </span>
          )}
          <span className={styles.hint}>{frontHint}</span>
        </span>
      )}
    </button>
  )
}
