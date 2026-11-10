import { skipToken, useQuery } from '@tanstack/react-query'
import { Check, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { StatusPill, type Status } from '../../shared/ui/StatusPill'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { dateRange } from './dates'
import { LoadState } from './LoadState'
import { StudentTabs } from './StudentTabs'
import { homeQuery, lessonsQuery, type LessonState, type StudentLessons } from './studentApi'
import styles from './Student.module.css'
import { lessonTileNo } from '../../shared/lessonLabel'

// S-04 회차 목록(STU-02, 와이어프레임 S04_Lessons). 반 id·머리글·레벨 색은 홈 응답에서,
// 회차 상태(state)는 서버 값 그대로 — 날짜로 열림·밀림을 계산하지 않는다

type Look = { status: Status; tag: string; icon?: ReactNode }

const LOOK: Record<LessonState, Look> = {
  completed: {
    status: 'completed',
    tag: '완료',
    icon: <Check size={14} strokeWidth={2.5} aria-hidden />,
  },
  today: { status: 'today', tag: '오늘' },
  overdue: {
    status: 'overdue',
    tag: '밀림',
    icon: <TriangleAlert size={14} strokeWidth={2} aria-hidden />,
  },
  open: { status: 'open', tag: '열림' },
  locked: { status: 'locked', tag: '잠김' },
}

const LEGEND: LessonState[] = ['completed', 'today', 'overdue', 'locked']

// 계약에 없는 state가 오면 그 타일만 중립 모양(열 수 없음)으로 두고 코드·값만 기록한다 — 목록 전체를 죽이지 않는다
function lookOf(lesson: { code: string; state: LessonState }): Look | undefined {
  const look = (LOOK as Partial<Record<string, Look>>)[lesson.state]
  if (look === undefined) console.error('[student] unknown lesson state', lesson.code, lesson.state)
  return look
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

  if (home.data === undefined) {
    return (
      <StudentLayout>
        <LoadState query={home} />
        <StudentTabs home={undefined} />
      </StudentLayout>
    )
  }

  const { class: klass, stats } = home.data
  const hasOpen = lessons.data?.groups.some((g) => g.lessons.some((l) => l.state === 'open'))
  const legend = hasOpen ? [...LEGEND.slice(0, 3), 'open' as const, 'locked' as const] : LEGEND

  return (
    <StudentLayout levelColorHex={klass.level.colorHex}>
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>
          {klass.book.season} · {klass.book.label}
        </h1>
        <p className={styles.who}>
          전체 {stats.totalLessons}회 · 완료 {stats.completedLessons} · 밀림 {stats.overdueLessons}
        </p>
        <ul className={styles.legend} aria-label="회차 상태">
          {legend.map((state) => (
            <li key={state}>
              <StatusPill status={LOOK[state].status}>{LOOK[state].tag}</StatusPill>
            </li>
          ))}
        </ul>
      </header>

      {lessons.data === undefined ? (
        <LoadState query={lessons} homeLink />
      ) : (
        <div className={styles.sections}>
          {lessons.data.groups.map((group) => (
            <LessonGroup key={group.module} group={group} />
          ))}
        </div>
      )}

      <StudentTabs home={home.data} />
    </StudentLayout>
  )
}

function LessonGroup({ group }: { group: StudentLessons['groups'][number] }) {
  const headingId = `group-${group.module}`
  return (
    <section aria-labelledby={headingId}>
      <div className={styles.groupHead}>
        <h2 id={headingId} className={styles.groupTitle}>
          {group.label}
        </h2>
        <span className={styles.groupRange}>{dateRange(group.range.from, group.range.to)}</span>
      </div>
      <ul className={styles.tiles}>
        {group.lessons.map((lesson) => (
          <li key={lesson.code}>
            <LessonTile lesson={lesson} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function LessonTile({ lesson }: { lesson: StudentLessons['groups'][number]['lessons'][number] }) {
  const look = lookOf(lesson)
  const tile = (
    <StatusPill status={look?.status ?? 'open'} shape="tile">
      <span className={styles.tileTop}>
        <span className={styles.tileNo}>{lessonTileNo(lesson.code)}</span>
        {look !== undefined && lesson.state !== 'locked' && (
          <span className={styles.tileTag} aria-hidden={lesson.state === 'open' || undefined}>
            {look.icon}
            {/* 열림은 가이드 §5대로 "—"(읽을 때는 이름의 "열림") */}
            {lesson.state === 'open' ? '—' : look.tag}
          </span>
        )}
      </span>
      <span className={styles.tileTitle}>{lesson.title}</span>
    </StatusPill>
  )
  const name = look === undefined ? lesson.title : `${lesson.title} · ${look.tag}`
  // 잠긴 회차는 제목만 보이고 열 수 없다(03 §2.2 — 상세는 423). 모르는 상태도 열지 않는다
  if (look === undefined || lesson.state === 'locked') {
    return (
      <div className={styles.tileBox} aria-label={name} role="group">
        {tile}
      </div>
    )
  }
  return (
    <Link to={`/lessons/${lesson.code}`} className={styles.tileBox} aria-label={name}>
      {tile}
    </Link>
  )
}
