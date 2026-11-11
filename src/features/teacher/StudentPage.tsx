import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { levelProps } from '../../shared/level'
import { Button } from '../../shared/ui/Button'
import { Card } from '../../shared/ui/Card'
import { StatusPill } from '../../shared/ui/StatusPill'
import { Table, type Column } from '../../shared/ui/Table'
import { groupByPassage, koreaTime, lessonLook, percent, playTime, trackName } from './format'
import {
  regeneratePersonalCode,
  studentDetailQuery,
  teacherClassesQuery,
  type StudentLesson,
  type StudentTrack,
} from './teacherApi'
import { TeacherLoadState } from './TeacherLoadState'
import { useSubmit } from './useSubmit'
import styles from './Teacher.module.css'

// T-04 학생 상세(03 §4.3). 열린 회차마다 지문 트랙별 청취(들은 구간·완료·재생 시간/길이·재생 횟수·마지막 청취)와
// 단어 학습 요약. 트랙은 지문 × 목소리 4개(모두 필수, BE #40)라 들은 목소리만 줄로, 안 들은 지문은 한 줄.
// 재생 시간/길이·재생 횟수는 제대로 들었는지 보는 보조 지표(TRK-05) — 서버 값 그대로 나란히 보이고
// 비율은 계산하지 않는다. 개인 코드 재발급(4.8)은 이 화면 지역 state에만 한 번 보인다
export function StudentPage() {
  const params = useParams()
  const classId = Number(params.id)
  const studentId = Number(params.studentId)
  const classes = useQuery(teacherClassesQuery)
  const detail = useQuery(studentDetailQuery(classId, studentId))
  const klass = classes.data?.items.find((c) => c.id === classId)

  return (
    <div {...levelProps(klass?.level.colorHex)}>
      <Link to={`/teacher/classes/${classId}`} className={styles.back}>
        ← {klass ? `${klass.name} 청취 현황` : '청취 현황'}
      </Link>
      {detail.data ? (
        <>
          <HeadWithRegenerate studentId={studentId} name={detail.data.student.name}>
            <div>
              <h1 className={styles.title}>{detail.data.student.name}</h1>
              <p className={styles.sub}>
                {[detail.data.student.school, detail.data.student.grade]
                  .filter(Boolean)
                  .join(' · ')}
                {detail.data.student.school || detail.data.student.grade ? ' · ' : ''}
                {detail.data.student.lastLoginAt
                  ? `마지막 로그인 ${koreaTime(detail.data.student.lastLoginAt)}`
                  : '로그인 기록 없음'}
              </p>
            </div>
          </HeadWithRegenerate>
          {detail.data.lessons.length === 0 ? (
            <p className={styles.notice}>아직 열린 회차가 없습니다</p>
          ) : (
            <div className={styles.lessons}>
              {detail.data.lessons.map((lesson) => (
                <LessonCard key={lesson.code} lesson={lesson} />
              ))}
            </div>
          )}
        </>
      ) : (
        <TeacherLoadState query={detail} />
      )}
    </div>
  )
}

/** 표 한 줄: 들은 목소리 트랙, 또는 하나도 안 들은 지문 */
type TrackRow = StudentTrack | { passageNo: number; unheard: true }

function LessonCard({ lesson }: { lesson: StudentLesson }) {
  const look = lessonLook(lesson.status, lesson.requiredDone, lesson.requiredTotal)
  // 목소리 4개를 다 보이면 지문마다 4줄 — 들은 목소리만, 하나도 안 들은 지문은 "안 들음" 한 줄
  const rows = groupByPassage(lesson.tracks).flatMap(({ passageNo, tracks }): TrackRow[] => {
    const heard = tracks.filter((t) => t.sessionCount > 0 || t.coverage > 0)
    return heard.length > 0 ? heard : [{ passageNo, unheard: true }]
  })
  const columns: Column<TrackRow>[] = [
    {
      key: 'track',
      header: '지문',
      cell: (t) =>
        'unheard' in t ? `지문 ${t.passageNo} · 안 들음` : trackName(t.passageNo, t.variant),
    },
    {
      key: 'coverage',
      header: '들은 구간',
      numeric: true,
      cell: (t) => ('unheard' in t ? '—' : percent(t.coverage)),
    },
    {
      key: 'completed',
      header: '완료',
      center: true,
      cell: (t) =>
        !('unheard' in t) && t.completed ? (
          <span className={styles.checkIcon}>
            <Check size={16} strokeWidth={3} aria-hidden />
            <span className={styles.srOnly}>완료</span>
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'play',
      header: '재생 / 길이',
      numeric: true,
      cell: (t) =>
        'unheard' in t ? '—' : `${playTime(t.totalPlayMs)} / ${playTime(t.durationMs)}`,
    },
    {
      key: 'count',
      header: '재생 횟수',
      numeric: true,
      cell: (t) => ('unheard' in t ? '—' : `${t.sessionCount}회`),
    },
    {
      key: 'last',
      header: '마지막 청취',
      cell: (t) => ('unheard' in t || !t.lastPlayedAt ? '—' : koreaTime(t.lastPlayedAt)),
    },
  ]
  const words = lesson.words
  return (
    <Card size="teacher" className={styles.lessonCard}>
      <div className={styles.lessonHead}>
        <h2 className={styles.lessonTitle}>{lesson.title}</h2>
        <StatusPill status={look.status}>{look.text}</StatusPill>
      </div>
      <Table
        caption={`${lesson.title} 지문 청취`}
        columns={columns}
        rows={rows}
        rowKey={(t) => `${t.passageNo}-${'unheard' in t ? 'none' : t.variant}`}
      />
      <p className={styles.words}>
        {/* 카드 학습(암기·리콜·스펠) 삭제(#64) — 본 카드 수만 */}
        단어 카드 {words.cardsViewed} / {words.total}
      </p>
    </Card>
  )
}

// 머리(왼쪽 제목 · 오른쪽 "개인 코드 재발급" 버튼) + 그 아래 확인 칸·결과 상자.
// 개인 코드 재발급 — 확인 한 번 뒤 요청, 새 코드는 이 컴포넌트 state에만(나가면 사라짐)
function HeadWithRegenerate({
  studentId,
  name,
  children,
}: {
  studentId: number
  name: string
  children: ReactNode
}) {
  const [step, setStep] = useState<'idle' | 'confirm'>('idle')
  const [code, setCode] = useState<string | null>(null)
  const submit = useSubmit()

  async function regenerate() {
    const issued = await submit.run(() => regeneratePersonalCode(studentId))
    if (issued !== undefined) {
      setCode(issued)
      setStep('idle')
    }
  }

  const error = submit.formError([])
  return (
    <>
      <div className={`${styles.head} ${styles.headWrap}`}>
        {children}
        {/* 확인 칸이 열려 있을 때만 숨김 — 결과 상자가 있어도 머리에 그대로 */}
        {step !== 'confirm' && (
          <Button
            variant="secondary"
            size="teacher"
            onClick={() => {
              setCode(null)
              setStep('confirm')
            }}
          >
            개인 코드 재발급
          </Button>
        )}
      </div>
      {(code !== null || step === 'confirm') && (
        <section className={styles.codeArea} aria-label="개인 코드">
          {code !== null && (
            <div className={styles.codeResult} role="status">
              <p className={styles.codeLine}>
                {name} 새 개인 코드 <strong className={styles.code}>{code}</strong>
              </p>
              <p className={styles.muted}>
                이 화면을 나가면 다시 볼 수 없습니다. 학생에게 바로 알려 주세요
              </p>
              <Button variant="secondary" size="teacher" onClick={() => setCode(null)}>
                코드 닫기
              </Button>
            </div>
          )}
          {step === 'confirm' && (
            <div className={styles.panel} role="group" aria-label="개인 코드 재발급 확인">
              <p className={styles.notice}>재발급하면 지금 개인 코드로는 들어갈 수 없습니다</p>
              {error && (
                <p className={styles.formError} role="alert">
                  {error}
                </p>
              )}
              <div className={styles.actions}>
                <Button size="teacher" onClick={() => void regenerate()} disabled={submit.pending}>
                  {submit.pending ? '재발급 중' : '재발급'}
                </Button>
                <Button
                  variant="secondary"
                  size="teacher"
                  onClick={() => {
                    submit.reset()
                    setStep('idle')
                  }}
                >
                  취소
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  )
}
