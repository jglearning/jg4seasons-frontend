import { skipToken, useQuery } from '@tanstack/react-query'
import { Check, ChevronLeft } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { lessonCircleNo } from '../../shared/lessonLabel'
import { ButtonLink } from '../../shared/ui/Button'
import { NumberCircle, type NumberCircleState } from '../../shared/ui/NumberCircle'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { Toast } from '../../shared/ui/Toast'
import { dateRange, shortDate } from './dates'
import { LicenseNotice } from './LicenseNotice'
import { LoadState } from './LoadState'
import { StudentTabs } from './StudentTabs'
import { homeQuery, lessonsQuery, type LessonState, type StudentLessons } from './studentApi'
import styles from './LessonsPage.module.css'

// S-04 회차 목록(STU-02, 지시문 §6.4 · 와이어프레임 v0.2 S04_Lessons) — 도장판.
// 맨 위 오늘 회차 카드, 묶음마다 흰 상자에 회차 동그라미 4열. 회차 상태(state)·진도는 서버 값 그대로 —
// 날짜로 열림·밀림을 계산하지 않는다. 완료·밀림 수는 홈 응답 stats

type Group = StudentLessons['groups'][number]
type Lesson = Group['lessons'][number]

type Look = { circle: NumberCircleState; tag: string; word: string }

// tag: 카드 오른쪽 글("오늘 · 12/19 (금)"), word: 동그라미 읽는 이름("Reading Day 3, 밀림")
const LOOK: Record<LessonState, Look> = {
  completed: { circle: 'done', tag: '완료', word: '완료' },
  today: { circle: 'current', tag: '오늘', word: '오늘' },
  overdue: { circle: 'overdue', tag: '밀림', word: '밀림' },
  open: { circle: 'open', tag: '열림', word: '열림' },
  locked: { circle: 'lockedSoft', tag: '잠김', word: '아직 열리지 않음' },
}

const TOAST_MS = 2000

// 계약에 없는 state가 오면 그 회차만 잠김처럼(열 수 없게) 두고 코드·값만 기록한다 — 목록 전체를 죽이지 않는다
function lookOf(lesson: { code: string; state: LessonState }): Look | undefined {
  const look = (LOOK as Partial<Record<string, Look>>)[lesson.state]
  if (look === undefined) console.error('[student] unknown lesson state', lesson.code, lesson.state)
  return look
}

/** 머리 줄 둘째 줄 앞부분: "Reading Day 1~24", 보충 회차가 있으면 " · 보충 4" — 받은 회차 코드를 읽기만 한다 */
function rangeLabel(groups: Group[]): string | undefined {
  const lessons = groups.flatMap((g) => g.lessons)
  const numbers = lessons
    .filter((l) => l.type !== 'supplement')
    .map((l) => Number(lessonCircleNo(l.code)))
    .filter((n) => Number.isInteger(n))
  if (numbers.length === 0) return undefined
  const supplements = lessons.filter((l) => l.type === 'supplement').length
  const range = `Reading Day ${Math.min(...numbers)}~${Math.max(...numbers)}`
  return supplements > 0 ? `${range} · 보충 ${supplements}` : range
}

/**
 * 맨 위 카드에 보일 회차(§6.4 동작 1): 오늘 → 가장 오래된 밀린 회차 → 가장 최근에 열린 회차.
 * 서버 state로 고를 뿐 날짜를 보지 않는다. 목록은 진도표 순서
 */
function featuredLesson(groups: Group[]): Lesson | undefined {
  const lessons = groups.flatMap((g) => g.lessons)
  return (
    lessons.find((l) => l.state === 'today') ??
    lessons.find((l) => l.state === 'overdue') ??
    lessons.findLast((l) => l.state === 'completed' || l.state === 'open')
  )
}

export function LessonsPage() {
  const home = useQuery(homeQuery)
  const classId = home.data?.class.id
  // 반 id(홈 응답)가 오기 전에는 부르지 않는다
  const lessons = useQuery(
    classId === undefined
      ? { queryKey: ['student', 'lessons', 'none'], queryFn: skipToken }
      : lessonsQuery(classId),
  )
  const groups = lessons.data?.groups

  // 잠긴 회차 안내: 누를 때마다 2초를 새로 센다
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const showLocked = (lesson: Lesson) => {
    clearTimeout(timer.current)
    setToast(`${shortDate(lesson.scheduledDate)}에 열려요`)
    timer.current = setTimeout(() => setToast(null), TOAST_MS)
  }

  if (home.data === undefined) {
    return (
      <StudentLayout tabBar>
        <LoadState query={home} />
        <StudentTabs home={undefined} />
      </StudentLayout>
    )
  }

  const { class: klass, stats } = home.data
  const range = groups === undefined ? undefined : rangeLabel(groups)
  const counts = `완료 ${stats.completedLessons} · 밀림 ${stats.overdueLessons}`
  const featured = groups === undefined ? undefined : featuredLesson(groups)

  return (
    <StudentLayout levelCode={klass.level.code} tabBar>
      <header className={styles.header}>
        <BackLink />
        <div className={styles.headText}>
          <h1 className={styles.title}>
            {klass.book.season} · {klass.book.label}
          </h1>
          <p className={styles.sub}>{range === undefined ? counts : `${range} · ${counts}`}</p>
        </div>
      </header>

      {lessons.data === undefined ? (
        <LoadState query={lessons} homeLink />
      ) : (
        <div className={styles.board}>
          {/* 이 목록 응답의 사용 상태로(홈 응답보다 새 값) */}
          <LicenseNotice status={lessons.data.class.licenseStatus} />
          {featured !== undefined && <FeaturedCard lesson={featured} />}
          {lessons.data.groups.map((group) => (
            <LessonGroup key={group.module} group={group} onLocked={showLocked} />
          ))}
        </div>
      )}

      <Toast message={toast} />
      <StudentTabs home={home.data} />
    </StudentLayout>
  )
}

// 뒤로: 앱 안에서 들어왔으면 들어온 화면으로, 주소로 바로 열었으면(돌아갈 곳 없음) 홈으로.
// 링크(href "/")로 두어 새 탭 열기·읽는 이름이 그대로 동작한다
function BackLink() {
  const location = useLocation()
  const navigate = useNavigate()
  const hasPrevious = location.key !== 'default'
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!hasPrevious || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    void navigate(-1)
  }
  return (
    <Link to="/" className={styles.back} aria-label="뒤로" onClick={onClick}>
      <ChevronLeft size={24} strokeWidth={2} aria-hidden />
    </Link>
  )
}

/** 버튼 글: 진도(서버 progress.status)대로 "이어서 듣기 · 4 / 6" · "듣기 시작" · "다시 듣기" */
function actionLabel({ progress }: Lesson): string {
  if (progress.status === 'completed') return '다시 듣기'
  if (progress.status === 'not_started') return '듣기 시작'
  return `이어서 듣기 · ${progress.passagesDone} / ${progress.passagesTotal}`
}

function FeaturedCard({ lesson }: { lesson: Lesson }) {
  const look = lookOf(lesson)
  const action = actionLabel(lesson)
  return (
    <section className={styles.featured} aria-labelledby="featured-lesson">
      <div className={styles.featuredHead}>
        <h2 id="featured-lesson" className={styles.featuredTitle}>
          {lesson.title}
        </h2>
        <span className={styles.featuredState}>
          {look?.tag ?? '잠김'} · {shortDate(lesson.scheduledDate)}
        </span>
      </div>
      <ButtonLink
        to={`/lessons/${lesson.code}`}
        block
        className={styles.featuredAction}
        aria-label={`${lesson.title} ${action}`}
      >
        {action}
      </ButtonLink>
    </section>
  )
}

function LessonGroup({ group, onLocked }: { group: Group; onLocked: (lesson: Lesson) => void }) {
  const headingId = `group-${group.module}`
  // 묶음 진행: 서버 state가 완료인 회차 수를 세어 보여 줄 뿐(판정 아님)
  const total = group.lessons.length
  const done = group.lessons.filter((l) => l.state === 'completed').length
  const percent = total === 0 ? 0 : (done / total) * 100
  return (
    <section aria-labelledby={headingId} className={styles.group}>
      <div className={styles.groupHead}>
        <h2 id={headingId} className={styles.groupTitle}>
          {group.label}
        </h2>
        <span className={styles.groupRange}>{dateRange(group.range.from, group.range.to)}</span>
        <span className={styles.groupBar} role="img" aria-label={`${total}개 중 ${done}개 완료`}>
          <span className={styles.groupFill} style={{ width: `${percent}%` }} />
        </span>
        <span className={styles.groupCount} aria-hidden>
          {done} / {total}
        </span>
      </div>
      <ul className={styles.grid}>
        {group.lessons.map((lesson) => (
          <li key={lesson.code} className={styles.cell}>
            <LessonStamp lesson={lesson} onLocked={onLocked} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function LessonStamp({ lesson, onLocked }: { lesson: Lesson; onLocked: (lesson: Lesson) => void }) {
  const look = lookOf(lesson)
  const locked = look === undefined || lesson.state === 'locked'
  const review = lesson.type === 'module_review' ? ' 정리' : ''
  const label = `${lesson.title}${review}, ${look?.word ?? LOOK.locked.word}`
  const circle = (
    <NumberCircle state={look?.circle ?? 'lockedSoft'} size={48} fontSize={20} pressable={!locked}>
      {lesson.state === 'completed' ? (
        <Check size={22} strokeWidth={3} aria-hidden />
      ) : (
        lessonCircleNo(lesson.code)
      )}
    </NumberCircle>
  )

  // 잠긴 회차는 이동하지 않고 열리는 날을 안내한다(03 §2.2 — 상세는 423). 모르는 상태도 열지 않는다
  if (locked) {
    return (
      <button
        type="button"
        className={styles.stamp}
        aria-label={label}
        onClick={() => onLocked(lesson)}
      >
        {circle}
      </button>
    )
  }
  return (
    <Link
      to={`/lessons/${lesson.code}`}
      className={styles.stamp}
      aria-label={label}
      aria-current={lesson.state === 'today' ? 'date' : undefined}
    >
      {circle}
    </Link>
  )
}
