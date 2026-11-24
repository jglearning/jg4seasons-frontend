import { Check, CircleHelp, Minus, X, type LucideIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { ActionRow } from '../../../shared/ui/ActionRow'
import { Button, ButtonLink } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'
import { NumberCircle, type NumberCircleState } from '../../../shared/ui/NumberCircle'
import { ProgressBar } from '../../../shared/ui/ProgressBar'
import type { WordTestItem, WordTestResult, WordTestSubmission } from './wordTestApi'
import styles from './WordTest.module.css'
import { COPY } from './wordTestCopy'

// 채점 결과(#173) — 다시 볼 것부터 묶는다: 틀림 → 안 씀 → 잘 안 보임 → 맞음(접힘).
// 문항 줄은 내가 쓴 것과 정답을 나란히(글자 차이 강조는 2단계 글자 확인 뒤 — 인식이 잘못된 글자까지 짚게 되므로).
// 판정·점수는 서버 값 그대로. 묶음 개수는 받은 items를 세어 보여 줄 뿐 판정에 쓰지 않는다.
// 맞음·틀림은 색만이 아니라 아이콘 모양(✓ ✕ − ?)과 묶음 제목 글자로도 구분한다

type Look = {
  /** 묶음 제목 앞말(개수가 뒤에 붙음) */
  heading: string
  /** 줄마다 읽어 주는 결과 */
  srText: string
  icon: LucideIcon
  circle: NumberCircleState
}

const LOOK: Record<WordTestResult, Look> = {
  wrong: { heading: '틀린 단어', srText: '틀림', icon: X, circle: 'overdue' },
  blank: { heading: '안 쓴 단어', srText: '안 씀', icon: Minus, circle: 'open' },
  unclear: { heading: '잘 안 보인 단어', srText: '판단 못 함', icon: CircleHelp, circle: 'open' },
  correct: { heading: '맞은 단어', srText: '맞음', icon: Check, circle: 'done' },
}

/** 펼쳐 보이는 묶음 순서. 맞은 단어는 따로 접어 둔다 */
const OPEN_ORDER: WordTestResult[] = ['wrong', 'blank', 'unclear']

export function ResultView({
  submission,
  code,
  onRetry,
}: {
  submission: WordTestSubmission & { score: number }
  code: string
  onRetry: () => void
}) {
  const items = submission.items ?? []
  const byResult = (result: WordTestResult) => items.filter((item) => item.result === result)
  // 서버가 이 화면이 모르는 result를 보내면(계약 밖) 묶음에서 빠진다 — 개발자 콘솔에만 남긴다
  const unknown = items.filter((item) => !(item.result in LOOK))
  if (unknown.length > 0) console.error('[wordtest] unknown item result', unknown.length)

  const wrongCount = byResult('wrong').length + byResult('blank').length
  const unclearCount = byResult('unclear').length

  return (
    <>
      <div className={styles.content}>
        <Card className={styles.score}>
          <p className={styles.scoreLabel}>{COPY.scoreLabel}</p>
          <p className={styles.scoreValue}>
            {submission.score} / {submission.total}
          </p>
          <ProgressBar
            value={submission.score}
            max={submission.total}
            label={`${COPY.scoreLabel} 점수`}
          />
          {unclearCount > 0 && <p className={styles.scoreNote}>{COPY.unclearNote(unclearCount)}</p>}
        </Card>

        {wrongCount === 0 && unclearCount === 0 && items.length > 0 && (
          <p className={styles.allCorrect}>{COPY.allCorrect}</p>
        )}

        {OPEN_ORDER.map((result) => (
          <ItemGroup key={result} result={result} items={byResult(result)} />
        ))}

        <CorrectGroup items={byResult('correct')} />
      </div>

      {/* 흰 버튼은 반쪽 폭이면 "다시 풀고 올리기"가 두 줄로 꺾여(390, 19px) 한 줄씩 쌓는다 */}
      <div className={`${styles.actions} ${styles.resultActions}`}>
        {wrongCount > 0 && (
          <ButtonLink to={`/lessons/${code}/words`} block>
            {COPY.reviewWords}
          </ButtonLink>
        )}
        <Button variant="secondary" block onClick={onRetry}>
          {COPY.retry}
        </Button>
        <ButtonLink to="/" variant="secondary" block>
          {COPY.home}
        </ButtonLink>
        <p className={styles.footnote}>{COPY.footnote}</p>
      </div>
    </>
  )
}

function ItemGroup({ result, items }: { result: WordTestResult; items: WordTestItem[] }) {
  const headingId = useId()
  if (items.length === 0) return null
  return (
    <section className={styles.group} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.groupTitle}>
        {LOOK[result].heading} {items.length}개
      </h2>
      <ItemList items={items} />
    </section>
  )
}

/** 맞은 단어 — 접어 두고 버튼으로 펼친다(다 맞은 학생도 확인할 수 있게) */
function CorrectGroup({ items }: { items: WordTestItem[] }) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  if (items.length === 0) return null
  return (
    <section className={styles.group} aria-label={`${LOOK.correct.heading} ${items.length}개`}>
      <ActionRow
        title={`${LOOK.correct.heading} ${items.length}개`}
        detail={open ? undefined : COPY.correctHidden}
        icon={<Check size={22} strokeWidth={2.4} className={styles.correctIcon} />}
        expanded={open}
        controls={listId}
        onToggle={() => setOpen((value) => !value)}
      />
      <div id={listId} hidden={!open}>
        {open && <ItemList items={items} />}
      </div>
    </section>
  )
}

function ItemList({ items }: { items: WordTestItem[] }) {
  return (
    <ul className={styles.itemList}>
      {items.map((item) => (
        <ItemRow key={item.no} item={item} />
      ))}
    </ul>
  )
}

function ItemRow({ item }: { item: WordTestItem }) {
  const look = LOOK[item.result]
  const Icon = look.icon
  return (
    <li className={styles.item} data-result={item.result}>
      <NumberCircle state={look.circle} size={32} fontSize={14}>
        {item.no}
      </NumberCircle>
      <div className={styles.itemBody}>
        <p className={styles.prompt}>
          <span className={styles.srOnly}>{item.no}번 </span>
          {item.prompt}
          <span className={styles.srOnly}> {look.srText}</span>
        </p>
        <ItemDetail item={item} />
      </div>
      <Icon size={22} strokeWidth={2.4} aria-hidden className={styles.itemIcon} />
    </li>
  )
}

function ItemDetail({ item }: { item: WordTestItem }) {
  switch (item.result) {
    case 'correct':
      return (
        <p className={styles.written} lang="en">
          {item.written}
        </p>
      )
    case 'unclear':
      return <p className={styles.muted}>{COPY.unclearItem}</p>
    case 'wrong':
    case 'blank':
      return (
        <dl className={styles.compare}>
          <div className={styles.compareRow}>
            <dt>{COPY.mine}</dt>
            {item.result === 'blank' || item.written === '' ? (
              <dd className={styles.muted}>{COPY.blank}</dd>
            ) : (
              <dd lang="en">{item.written}</dd>
            )}
          </div>
          <div className={styles.compareRow}>
            <dt>{COPY.answer}</dt>
            <dd lang="en" className={styles.answer}>
              {item.answer}
            </dd>
          </div>
        </dl>
      )
    default:
      return null
  }
}
