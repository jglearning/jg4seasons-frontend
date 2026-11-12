import { useQuery } from '@tanstack/react-query'
import { CircleAlert, Settings } from 'lucide-react'
import { Link } from 'react-router'
import { meQuery } from '../../api/session'
import { coverArt, levelEnglish } from '../../shared/level'
import { lessonCircleNo } from '../../shared/lessonLabel'
import { ActionRow } from '../../shared/ui/ActionRow'
import { ButtonLink } from '../../shared/ui/Button'
import { CoverHeader } from '../../shared/ui/CoverHeader'
import { ProgressBar } from '../../shared/ui/ProgressBar'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { longDate, shortDate } from './dates'
import { HomeScreenHint } from './HomeScreenHint'
import { LicenseNotice } from './LicenseNotice'
import { LoadState } from './LoadState'
import { StudentTabs } from './StudentTabs'
import { homeQuery, type StudentHome } from './studentApi'
import styles from './HomePage.module.css'

// S-03 홈(STU-01, v0.2 지시문 §6.3 · 와이어프레임 Main·S03_HomeLevels).
// 표지 헤더(레벨 이름·오늘 회차 번호와 이름·설정·캐릭터) → 반·이름·오늘 수업 → 지문 진행 → 주 버튼
// → 밀린 수업 한 줄(→ S-04) → 오늘 단어·다음 수업 → 떠 있는 탭 바. 진도·밀림·상태는 서버 값을 보여 주기만 한다.
// 서버 today는 "수업일이 지난 회차 중 가장 늦은 것"이라 비는 때는 개강 전뿐 — 그때는 다음 수업(첫 수업)을 헤더에 쓴다

export function HomePage() {
  const home = useQuery(homeQuery)
  // 가드(RequireSession)가 이미 받아 둔 /me — 이름 표시에만 쓴다
  const me = useQuery(meQuery)

  // 데이터가 있으면 백그라운드 재조회가 실패해도 보던 화면을 유지한다
  if (home.data === undefined) {
    return (
      <StudentLayout tabBar>
        <div className={styles.loading}>
          <LoadState query={home} />
        </div>
        <StudentTabs home={undefined} />
      </StudentLayout>
    )
  }

  const data = home.data
  const level = data.class.level
  const headLesson = data.today?.lesson ?? data.next?.lesson
  const english = levelEnglish(level.code)

  return (
    <StudentLayout levelCode={level.code} tabBar>
      <CoverHeader
        art={coverArt(level.code, data.class.book.season)}
        action={
          <Link to="/settings" className={styles.settings} aria-label="설정">
            {/* 지름 40 받침(표지 색) — 캐릭터 그림 위에서도 톱니가 보이게(지시문 §6.3-6) */}
            <span className={styles.settingsBack} aria-hidden>
              <Settings size={24} strokeWidth={2} />
            </span>
          </Link>
        }
      >
        <div className={styles.cover}>
          <p className={styles.level}>{english ? `${english} ${level.nameKo}` : level.nameKo}</p>
          {headLesson && (
            <div className={styles.lesson}>
              <span className={styles.lessonNo} aria-hidden>
                {lessonCircleNo(headLesson.code)}
              </span>
              <h1 className={styles.lessonTitle}>{headLesson.title}</h1>
            </div>
          )}
        </div>
      </CoverHeader>

      <div className={styles.body}>
        {/* 사용 기간 안내는 지금 구성 그대로 헤더 바로 아래, 홈 화면 추가 안내는 맨 아래(지시문 §6.3, 11/12 밤) */}
        <LicenseNotice status={data.class.licenseStatus} />
        <div className={styles.who}>
          <p className={styles.whoName}>
            {data.class.name}
            {me.data !== undefined && ` · ${me.data.name}`}
          </p>
          <p className={styles.whoLesson}>{lessonLine(data)}</p>
        </div>

        {data.today && <TodayProgress today={data.today} />}

        <OverdueRow overdue={data.overdue} />

        <div className={styles.pair}>
          {data.words !== null && (
            <Link to={`/lessons/${data.words.lessonCode}/words`} className={styles.wordsCard}>
              <span className={styles.smallLabel}>오늘 단어</span>
              <span className={styles.smallValue}>{data.words.total}개</span>
            </Link>
          )}
          {data.next !== null && (
            <div className={styles.nextBox}>
              <span className={styles.smallLabel}>다음 수업</span>
              <span className={styles.smallValue}>{shortDate(data.next.scheduledDate)}</span>
            </div>
          )}
        </div>

        <HomeScreenHint />
      </div>

      <StudentTabs home={data} />
    </StudentLayout>
  )
}

/** 헤더 아래 둘째 줄: "오늘 수업 · 12월 19일 (금) · 겨울 1 · L2-B1-05" / 개강 전 "첫 수업 · 12월 22일 (월)" */
function lessonLine(data: StudentHome): string {
  if (data.today) {
    return `오늘 수업 · ${longDate(data.today.scheduledDate)} · ${data.today.groupLabel} · ${data.today.lesson.code}`
  }
  if (data.next) return `첫 수업 · ${longDate(data.next.scheduledDate)}`
  return '오늘은 수업이 없어요'
}

type Progress = NonNullable<StudentHome['today']>['progress']

const ACTION: Record<Progress['status'], string> = {
  not_started: '듣기 시작',
  in_progress: '이어서 듣기',
  completed: '다시 듣기',
}

function TodayProgress({ today }: { today: NonNullable<StudentHome['today']> }) {
  const done = today.progress.passagesDone
  const total = today.progress.passagesTotal
  // 계약에 없는 상태 값이 오면 화면 전체를 죽이지 않고 기본 글로(코드·값만 기록)
  const action = (ACTION as Partial<Record<string, string>>)[today.progress.status]
  if (action === undefined)
    console.error('[student] unknown progress status', today.progress.status)
  return (
    <>
      <div className={styles.progress}>
        <div className={styles.progressRow}>
          <span className={styles.progressLabel}>지문 듣기</span>
          <span className={styles.progressCount}>
            {done} / {total}
          </span>
        </div>
        <ProgressBar value={done} max={total} label="지문 듣기" />
      </div>
      <ButtonLink to={`/lessons/${today.lesson.code}`} block>
        {action ?? '듣기'}
      </ButtonLink>
    </>
  )
}

/** 밀린 수업 한 줄 요약 — 회차는 S-04에서 고른다. 없으면 그리지 않는다 */
function OverdueRow({ overdue }: { overdue: StudentHome['overdue'] }) {
  if (overdue.length === 0) return null
  return (
    <ActionRow
      to="/lessons"
      icon={<CircleAlert size={24} strokeWidth={2} className={styles.badIcon} />}
      title={`밀린 수업 ${overdue.length}개`}
      detail={overdueNames(overdue.map((o) => o.lesson.title))}
    />
  )
}

/** 보조 글 "Reading Day 3 · 4" — 첫 회차 이름 + 나머지는 번호만(이름 꼴이 다르면 그대로). 4개 이상이면 앞의 3개 + "외 n개" */
const SHOWN = 3
function overdueNames(titles: string[]): string {
  const shown = titles.slice(0, titles.length > SHOWN ? SHOWN : titles.length)
  const [first, ...rest] = shown
  const names = [first, ...rest.map((t) => t.replace(/^Reading Day /, ''))].join(' · ')
  const more = titles.length - shown.length
  return more > 0 ? `${names} 외 ${more}개` : names
}
