import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../api/errors'
import { StaffLoadState } from '../../shared/ui/StaffLoadState'
import { StatusPill } from '../../shared/ui/StatusPill'
import { Table, type Column } from '../../shared/ui/Table'
import { koreaTime } from './format'
import styles from './Teacher.module.css'
import { classWordTestsQuery, type TeacherWordTestList } from './wordTestApi'
import { NOT_SUBMITTED, statusLook } from './wordTestFormat'

// T-05 회차 상세 아래 단어시험 결과(#175, 1단계 시연용) — 학생별 최근 제출 한 줄: 이름 / 점수 / 상태 / 회차 / 제출 시각.
// 이름을 누르면 제출 상세. 점수·상태는 서버 값 그대로.
// 기능이 꺼진 학원(404 FEATURE_DISABLED)이면 이 묶음을 통째로 숨겨 기존 T-05 그대로. 그 밖의 오류는 교사에게 보인다

type Row = TeacherWordTestList['students'][number]

export function WordTestSection({ classId, lessonCode }: { classId: number; lessonCode: string }) {
  const headingId = useId()
  const list = useQuery(classWordTestsQuery(classId, lessonCode))
  if (list.error instanceof ApiError && list.error.code === 'FEATURE_DISABLED') return null

  return (
    <section className={styles.wordTest} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.sectionTitle}>
        단어시험 · 철자 쓰기
      </h2>
      {list.data ? (
        <WordTestTable classId={classId} data={list.data} />
      ) : (
        <StaffLoadState query={list} />
      )}
    </section>
  )
}

function WordTestTable({ classId, data }: { classId: number; data: TeacherWordTestList }) {
  const columns: Column<Row>[] = [
    {
      key: 'student',
      header: '학생',
      cell: (r) =>
        r.submission === null ? (
          r.name
        ) : (
          <Link to={`/teacher/classes/${classId}/word-tests/${r.submission.id}`}>{r.name}</Link>
        ),
    },
    {
      key: 'score',
      header: '점수',
      numeric: true,
      cell: (r) =>
        r.submission?.score == null ? '—' : `${r.submission.score} / ${r.submission.total}`,
    },
    {
      key: 'status',
      header: '상태',
      cell: (r) => {
        const look = r.submission === null ? NOT_SUBMITTED : statusLook(r.submission.status)
        return <StatusPill status={look.status}>{look.text}</StatusPill>
      },
    },
    {
      key: 'attempt',
      header: '회차',
      numeric: true,
      cell: (r) => (r.submission === null ? '—' : `${r.submission.attemptNo}회째`),
    },
    {
      key: 'submittedAt',
      header: '제출 시각',
      cell: (r) => (r.submission === null ? '—' : koreaTime(r.submission.submittedAt)),
    },
  ]
  return (
    <Table
      caption="학생별 단어시험(철자 쓰기) 결과"
      columns={columns}
      rows={data.students}
      rowKey={(r) => r.studentId}
      empty="학생이 없습니다"
    />
  )
}
