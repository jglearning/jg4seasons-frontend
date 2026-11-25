import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { lessonCircleNo } from '../../../shared/lessonLabel'
import { ButtonLink } from '../../../shared/ui/Button'
import { NumberCircle } from '../../../shared/ui/NumberCircle'
import { StudentLayout } from '../../../shared/ui/StudentLayout'
import { LoadState } from '../LoadState'
import { StudentTabs } from '../StudentTabs'
import { homeQuery } from '../studentApi'
import {
  useWordTestList,
  type LessonTest,
  type WordTestGroup,
  type WordTestLesson,
} from './useWordTestList'
import { SECTION_SPELLING, wordTestPath, type WordTestSection } from './wordTestApi'
import styles from './WordTest.module.css'
import { COPY } from './wordTestCopy'
import { latestDetail, sectionLabel, stampOf } from './wordTestText'

// 단어시험 목록(#185) — 하단 탭 "시험". S-04 회차 목록과 같은 모양(동섭 11/25 A안):
// 맨 위 카드 = 지금 낼 시험 + 주 버튼, 아래 = 진도표 묶음마다 회차 동그라미 4열.
// 시험지 있는 회차만 누를 수 있다 — 결과가 있으면 채운 동그라미 + "44/48", 아니면 흰 동그라미 + 상태 한 단어.
// 시험지 없는·잠긴 회차는 옅은 동그라미(누를 수 없음). 상태·점수는 서버 값 그대로(useWordTestList 하나에서만).
// 영역은 지금 B 하나 — 영역이 늘면 머리 아래에 영역 고르기를 두고 같은 판을 그 영역으로 그린다
const SECTION = SECTION_SPELLING

export function WordTestsPage() {
  const home = useQuery(homeQuery)
  const list = useWordTestList()

  const tests = list.state === 'ready' ? testsOf(list.groups, SECTION) : []
  const featured = list.state === 'ready' ? featuredOf(list.groups, SECTION) : undefined

  return (
    <StudentLayout levelCode={home.data?.class.level.code} tabBar>
      <header className={styles.listHeader}>
        <h1 className={styles.listTitle}>{COPY.listTitle}</h1>
        {list.state === 'ready' && tests.length > 0 && (
          <p className={styles.listSub}>
            {sectionLabel(SECTION)} · {COPY.listCount(tests.length)}
          </p>
        )}
      </header>

      {list.state === 'waiting' ? (
        <LoadState query={list.query} homeLink />
      ) : list.state === 'checking' ? (
        <p className={styles.listNote} role="status">
          {COPY.listLoading}
        </p>
      ) : tests.length === 0 ? (
        <section className={styles.listEmpty} aria-label={COPY.listEmpty}>
          <p className={styles.listEmptyTitle}>{COPY.listEmpty}</p>
          <p className={styles.listEmptySub}>{COPY.listEmptySub}</p>
        </section>
      ) : (
        <div className={styles.board}>
          {featured !== undefined && <FeaturedTest lesson={featured} section={SECTION} />}
          {list.groups.map((group) => (
            <TestGroup key={group.module} group={group} section={SECTION} />
          ))}
        </div>
      )}

      <StudentTabs home={home.data} />
    </StudentLayout>
  )
}

function testsOf(groups: WordTestGroup[], section: WordTestSection): LessonTest[] {
  return groups.flatMap((g) => g.lessons.flatMap((l) => l.tests[section] ?? []))
}

/**
 * 맨 위 카드에 보일 회차: 오늘 회차(시험 있음) → 아직 안 낸 가장 최근 회차 → 시험 있는 가장 최근 회차.
 * 서버 state·최근 제출로 고를 뿐 날짜를 보지 않는다(S-04 오늘 카드와 같은 규칙)
 */
function featuredOf(groups: WordTestGroup[], section: WordTestSection): WordTestLesson | undefined {
  const lessons = groups.flatMap((g) => g.lessons).filter((l) => l.tests[section] !== undefined)
  return (
    lessons.find((l) => l.state === 'today') ??
    lessons.findLast((l) => l.tests[section]?.latest === null) ??
    lessons.at(-1)
  )
}

function FeaturedTest({ lesson, section }: { lesson: WordTestLesson; section: WordTestSection }) {
  const test = lesson.tests[section]!
  const action = test.latest === null ? COPY.take : COPY.openResult
  const detail = test.latest === null ? COPY.featuredNew : latestDetail(test.latest)
  return (
    <section className={styles.featured} aria-labelledby="featured-test">
      <div className={styles.featuredHead}>
        <h2 id="featured-test" className={styles.featuredTitle}>
          {lesson.title}
        </h2>
        <span className={styles.featuredTag}>
          {lesson.state === 'today' ? `${COPY.today} · ` : ''}
          {sectionLabel(section)}
        </span>
      </div>
      <p className={styles.featuredDetail}>{detail}</p>
      <ButtonLink
        to={wordTestPath(lesson.code, section)}
        block
        className={styles.featuredAction}
        aria-label={`${lesson.title} ${sectionLabel(section)} ${action}`}
      >
        {action}
      </ButtonLink>
    </section>
  )
}

function TestGroup({ group, section }: { group: WordTestGroup; section: WordTestSection }) {
  const headingId = `test-group-${group.module}`
  const withTest = group.lessons.filter((l) => l.tests[section] !== undefined)
  // 묶음 진행: 시험 있는 회차 중 채점 결과가 있는 수를 세어 보여 줄 뿐(판정 아님)
  const done = withTest.filter((l) => stampOf(l.tests[section]!.latest).done).length
  const total = withTest.length
  return (
    <section aria-labelledby={headingId} className={styles.group}>
      <div className={styles.groupHead}>
        <h2 id={headingId} className={styles.groupTitle}>
          {group.label}
        </h2>
        {total > 0 && (
          <>
            <span
              className={styles.groupBar}
              role="img"
              aria-label={`시험 ${total}개 중 ${done}개 채점 결과`}
            >
              <span className={styles.groupFill} style={{ width: `${(done / total) * 100}%` }} />
            </span>
            <span className={styles.groupCount} aria-hidden>
              {done} / {total}
            </span>
          </>
        )}
      </div>
      <ul className={styles.grid}>
        {group.lessons.map((lesson) => (
          <li key={lesson.code} className={styles.cell}>
            <TestStamp lesson={lesson} section={section} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function TestStamp({ lesson, section }: { lesson: WordTestLesson; section: WordTestSection }) {
  const test = lesson.tests[section]
  const no = lessonCircleNo(lesson.code)

  // 시험 없음(시험지 없음·잠김·기능 꺼짐): 옅은 동그라미, 누를 수 없음 — 링크·버튼이 아니라 읽기만
  if (test === undefined) {
    return (
      <span className={styles.stamp} role="img" aria-label={`${lesson.title}, ${COPY.stampNone}`}>
        <NumberCircle state="lockedSoft" size={44} fontSize={18}>
          {no}
        </NumberCircle>
        <span className={styles.stampCaption} aria-hidden />
      </span>
    )
  }

  const stamp = stampOf(test.latest)
  return (
    <Link
      to={wordTestPath(lesson.code, section)}
      className={styles.stamp}
      aria-label={`${lesson.title} ${sectionLabel(section)}, ${latestDetail(test.latest)}`}
      aria-current={lesson.state === 'today' ? 'date' : undefined}
    >
      <NumberCircle state={stamp.done ? 'done' : 'open'} size={44} fontSize={18} pressable>
        {no}
      </NumberCircle>
      <span className={styles.stampCaption} aria-hidden>
        {stamp.caption}
      </span>
    </Link>
  )
}
