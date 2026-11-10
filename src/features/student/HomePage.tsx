import { useQuery } from '@tanstack/react-query'
import { Settings } from 'lucide-react'
import { Link } from 'react-router'
import { meQuery } from '../../api/session'
import { ButtonLink } from '../../shared/ui/Button'
import { Card } from '../../shared/ui/Card'
import { LevelChip } from '../../shared/ui/LevelChip'
import { OverdueAlert, type OverdueItem } from '../../shared/ui/OverdueAlert'
import { ProgressBar } from '../../shared/ui/ProgressBar'
import { StatusPill, type Status } from '../../shared/ui/StatusPill'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { longDate, shortDate } from './dates'
import { HomeScreenHint } from './HomeScreenHint'
import { LoadState } from './LoadState'
import { StudentTabs } from './StudentTabs'
import { homeQuery, type StudentHome } from './studentApi'
import styles from './Student.module.css'
import { lessonNoLabel } from '../../shared/lessonLabel'

// S-03 홈(STU-01, 와이어프레임 Main). 진도·밀림·상태는 서버 값을 보여 주기만 한다

export function HomePage() {
  const home = useQuery(homeQuery)
  // 가드(RequireSession)가 이미 받아 둔 /me — 이름 표시에만 쓴다
  const me = useQuery(meQuery)

  // 데이터가 있으면 백그라운드 재조회가 실패해도 보던 화면을 유지한다
  if (home.data === undefined) {
    return (
      <StudentLayout>
        <LoadState query={home} />
        <StudentTabs home={undefined} />
      </StudentLayout>
    )
  }

  const data = home.data
  return (
    <StudentLayout levelColorHex={data.class.level.colorHex}>
      <header className={styles.header}>
        {/* 오른쪽: 레벨 칩 → 설정 아이콘(S07 검토 안 A, 11/9) */}
        <div className={styles.brandRow}>
          <h1 className={styles.brand}>제이G 4 Seasons</h1>
          <div className={styles.headEnd}>
            <LevelChip>
              {data.class.level.nameKo} · {data.class.book.season}
            </LevelChip>
            <Link to="/settings" className={styles.settingsLink} aria-label="설정">
              <Settings size={22} strokeWidth={2} aria-hidden />
            </Link>
          </div>
        </div>
        <p className={styles.who}>
          {data.class.name}
          {me.data !== undefined && ` · ${me.data.name}`}
        </p>
      </header>

      <div className={styles.sections}>
        <HomeScreenHint />
        <OverdueAlert items={data.overdue.map(overdueItem)} />
        <TodayCard today={data.today} />
        <div className={styles.pair}>
          {data.words !== null && <WordsCard words={data.words} today={data.today} />}
          {data.next !== null && <NextCard next={data.next} />}
        </div>
        <div className={styles.allLessons}>
          <Link to="/lessons" className={styles.textLink}>
            전체 회차 보기
          </Link>
          <span className={styles.stats}>
            완료 {data.stats.completedLessons} · 밀림 {data.stats.overdueLessons} · 전체{' '}
            {data.stats.totalLessons}
          </span>
        </div>
      </div>

      <StudentTabs home={data} />
    </StudentLayout>
  )
}

function overdueItem(o: StudentHome['overdue'][number]): OverdueItem {
  const when = `${shortDate(o.scheduledDate)} 수업`
  const where =
    o.kind === 'stopped'
      ? `지문 듣기 ${o.progress.passagesDone} / ${o.progress.passagesTotal}에서 멈춤`
      : '아직 시작 안 함'
  return {
    key: String(o.seq),
    title: o.lesson.title,
    detail: `${when} · ${where}`,
    action: { label: o.kind === 'stopped' ? '이어서' : '시작', to: `/lessons/${o.lesson.code}` },
  }
}

type Progress = NonNullable<StudentHome['today']>['progress']

type TodayLook = { status: Status; label: string; action: string }

const TODAY_STATUS: Record<Progress['status'], TodayLook> = {
  not_started: { status: 'open', label: '시작 전', action: '듣기 시작' },
  in_progress: { status: 'in_progress', label: '진행 중', action: '이어서 듣기' },
  completed: { status: 'completed', label: '완료', action: '다시 듣기' },
}

// 계약에 없는 상태 값이 오면 화면 전체를 죽이지 않고 상태 표시만 뺀다(코드·값만 기록)
function todayLook(status: Progress['status']): TodayLook | undefined {
  const look = (TODAY_STATUS as Partial<Record<string, TodayLook>>)[status]
  if (look === undefined) console.error('[student] unknown progress status', status)
  return look
}

function TodayCard({ today }: { today: StudentHome['today'] }) {
  if (today === null) {
    return (
      <Card aria-label="오늘 수업">
        <p className={styles.empty}>오늘은 수업이 없어요</p>
      </Card>
    )
  }
  const look = todayLook(today.progress.status)
  const done = today.progress.passagesDone
  const total = today.progress.passagesTotal
  return (
    <Card aria-labelledby="today-title">
      <p className={styles.eyebrow}>오늘 수업 · {longDate(today.scheduledDate)}</p>
      <div className={styles.metaRow}>
        <span className={styles.meta}>
          {today.groupLabel} · {lessonNoLabel(today.lesson.code)} ·{' '}
          <span className={styles.code}>{today.lesson.code}</span>
        </span>
        {look !== undefined && <StatusPill status={look.status}>{look.label}</StatusPill>}
      </div>
      <h2 id="today-title" className={styles.cardTitle}>
        {today.lesson.title}
      </h2>
      <ol className={styles.passages}>
        {today.lesson.passages.map((p) => (
          <li key={p.no}>{p.title}</li>
        ))}
      </ol>
      <div className={styles.progressRow}>
        <span>지문 듣기</span>
        <span className={styles.count}>
          {done} / {total}
        </span>
      </div>
      <ProgressBar value={done} max={total} label="지문 듣기" />
      <ButtonLink to={`/lessons/${today.lesson.code}`} block className={styles.mainAction}>
        {look?.action ?? '듣기'}
      </ButtonLink>
    </Card>
  )
}

function WordsCard({
  words,
  today,
}: {
  words: NonNullable<StudentHome['words']>
  today: StudentHome['today']
}) {
  const passages = today?.lesson.code === words.lessonCode ? today.lesson.passages : []
  const range =
    passages.length > 0 ? `지문 ${passages[0].no}~${passages[passages.length - 1].no} · ` : ''
  return (
    <Link to={`/lessons/${words.lessonCode}/words`} className={styles.smallCard}>
      <span className={styles.smallLabel}>오늘 단어</span>
      <span className={styles.smallValue}>{words.total}개</span>
      <span className={styles.smallSub}>
        {range}암기 {words.memKnown} / {words.total}
      </span>
    </Link>
  )
}

function NextCard({ next }: { next: NonNullable<StudentHome['next']> }) {
  return (
    <div className={styles.smallCard}>
      <span className={styles.smallLabel}>다음 수업</span>
      <span className={styles.smallValue}>{shortDate(next.scheduledDate)}</span>
      <span className={styles.smallSub}>{next.lesson.title}</span>
    </div>
  )
}
