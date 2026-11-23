import { useEffect, useId, useRef } from 'react'
import { useBlocker } from 'react-router'
import { Button } from '../../../shared/ui/Button'
import { CodeTable, PrintSheets, type CardGroup } from '../CodeCards'
import { useCardPrint } from '../useCardPrint'
import adminStyles from '../Admin.module.css'
import type { RosterImportedClass, RosterResult } from './rosterApi'
import styles from './Roster.module.css'

// A-05 ⑥ 결과 — 반마다 머리(반 이름 · 새 반/기존 반 · 가입 코드 · 이 반 카드 인쇄) + 기존 CodeCards 표(동섭 결정 1).
// 개인 코드 평문은 이 컴포넌트에 넘어온 응답에만(부모 지역 state) — 떠나면 사라진다. 앱 안 이동은 한 번 묻는다(useBlocker)

export function ResultView({ result }: { result: RosterResult }) {
  const cards = useCardPrint()
  const groups: CardGroup[] = result.classes.map((c) => ({
    key: c.classId,
    klass: c,
    items: c.students,
  }))
  const existing = result.classes.filter((c) => !c.created)
  const created = result.classes.filter((c) => c.created)
  const count = (list: RosterImportedClass[]) => list.reduce((sum, c) => sum + c.students.length, 0)
  const sub = [
    existing.length > 0 && `기존 반 ${existing.length}개에 ${count(existing)}명을 넣었습니다.`,
    created.length > 0 && `새 반 ${created.length}개를 만들어 ${count(created)}명을 넣었습니다.`,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <LeaveGuard />
      <div className={adminStyles.head}>
        <div>
          <h1 className={adminStyles.title}>
            {result.createdClasses > 0 ? `반 ${result.createdClasses}개 · ` : ''}학생{' '}
            {result.createdStudents}명을 만들었습니다
          </h1>
          <p className={adminStyles.sub}>{sub}</p>
        </div>
        <Button size="teacher" onClick={() => cards.print()} disabled={!cards.ready}>
          모든 반 카드 인쇄
        </Button>
      </div>
      <p className={styles.codeNotice} role="note">
        <strong>개인 코드는 이 화면에서만 보입니다.</strong> 떠나기 전에 카드를 인쇄해 주세요.
        나중에는 학생 관리에서 재발급만 할 수 있습니다.
      </p>
      <div className={styles.cards}>
        {result.classes.map((c) => (
          <ResultClass
            key={c.classId}
            klass={c}
            onPrint={() => cards.print(c.classId)}
            ready={cards.ready}
          />
        ))}
      </div>
      <PrintSheets groups={groups} cards={cards} />
    </>
  )
}

function ResultClass({
  klass,
  onPrint,
  ready,
}: {
  klass: RosterImportedClass
  onPrint: () => void
  ready: boolean
}) {
  const id = useId()
  return (
    <section className={styles.card} aria-labelledby={id}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}>
          <h2 id={id} className={styles.cardTitle}>
            {klass.name}
          </h2>
          <span className={styles.tag}>
            {klass.created ? '새 반' : `기존 반 · ${klass.students.length}명 추가`}
          </span>
          <span className={styles.muted}>가입 코드</span>
          <span className={styles.joinCode}>{klass.accessCode}</span>
        </div>
        <Button
          variant="secondary"
          size="teacher"
          onClick={onPrint}
          disabled={!ready}
          aria-label={`${klass.name} 카드 인쇄`}
        >
          이 반 카드 인쇄
        </Button>
      </div>
      <CodeTable caption={`${klass.name} 개인 코드`} items={klass.students} />
    </section>
  )
}

/** 결과 화면에서 앱 안 다른 화면으로 가려 하면 한 번 묻는다(사이드바 클릭 — 개인 코드를 다시 볼 수 없음) */
function LeaveGuard() {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname,
  )
  const stay = useRef<HTMLButtonElement>(null)
  const blocked = blocker.state === 'blocked'
  useEffect(() => {
    if (blocked) stay.current?.focus()
  }, [blocked])
  if (!blocked) return null
  return (
    <div className={styles.leaveBox} role="alert">
      <p>
        <strong>이 화면을 떠나면 개인 코드를 다시 볼 수 없습니다.</strong> 카드를 인쇄했는지 확인해
        주세요.
      </p>
      <div className={styles.leaveActions}>
        <Button size="teacher" ref={stay} onClick={() => blocker.reset()}>
          머물기
        </Button>
        <Button variant="secondary" size="teacher" onClick={() => blocker.proceed()}>
          떠나기
        </Button>
      </div>
    </div>
  )
}
