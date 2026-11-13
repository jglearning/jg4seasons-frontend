import { Check } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { ButtonLink } from '../../shared/ui/Button'
import { CoverHeader } from '../../shared/ui/CoverHeader'
import { StatTile } from '../../shared/ui/StatTile'
import styles from './LessonComplete.module.css'

// S-08 회차 완료(지시문 §6.6, 와이어프레임 S08_Complete). S-05 위에 전체 화면으로 덮는다 — 주소는 따로 없고,
// 여는 쪽이 같은 주소로 history 한 칸을 쌓아 뒤로 가기 = 닫기.
// 표지 색 면(크림 동그라미 안 체크 + "Reading Day n 완료") → 통계 칸 → 버튼(오늘 단어 → S-06, 홈 → S-03).
// "들은 시간"은 서버 값이 아직 없어(백엔드 질문 7) 빼고 "지문 n / n" 한 칸을 폭 가득.
// 값은 모두 서버 값(회차 완료·지문 수·단어 수). 열리면 제목으로 포커스를 옮겨 스크린 리더가 바로 읽게 한다
type LessonCompleteProps = {
  title: string
  passagesDone: number
  passagesTotal: number
  wordsTotal: number
  wordsTo: string
}

const TITLE_ID = 'lesson-complete-title'

export function LessonComplete({
  title,
  passagesDone,
  passagesTotal,
  wordsTotal,
  wordsTo,
}: LessonCompleteProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const hasWords = wordsTotal > 0

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={TITLE_ID} className={styles.overlay}>
      <div className={styles.sheet}>
        <CoverHeader className={styles.cover}>
          <span className={styles.check} aria-hidden>
            <Check size={64} strokeWidth={3} />
          </span>
          <h1 id={TITLE_ID} ref={headingRef} tabIndex={-1} className={styles.title}>
            {title} 완료
          </h1>
        </CoverHeader>

        <div className={styles.stats}>
          <StatTile label="지문" value={`${passagesDone} / ${passagesTotal}`} />
        </div>

        <div className={styles.actions}>
          {hasWords && (
            <ButtonLink to={wordsTo} block>
              오늘 단어 {wordsTotal}개 보기
            </ButtonLink>
          )}
          <ButtonLink to="/" variant={hasWords ? 'secondary' : 'primary'} block>
            홈으로
          </ButtonLink>
        </div>
      </div>
    </div>
  )
}
