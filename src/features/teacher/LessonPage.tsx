import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { levelProps } from '../../shared/level'
import { StatusPill, type Status } from '../../shared/ui/StatusPill'
import { Table, type Column } from '../../shared/ui/Table'
import { percent, shortDate } from './format'
import {
  lessonDetailQuery,
  teacherClassesQuery,
  type LessonDetail,
  type LessonDetailRow,
} from './teacherApi'
import { TeacherLoadState } from './TeacherLoadState'
import styles from './Teacher.module.css'

// T-05 회차 상세(03 §4.4) — 수업 전에 빠르게 보는 학생 × 필수 지문 표.
// 선택 속도(0.8·1.2)는 열이 18개가 되지 않게 빼고 학생 상세(T-04)에서 본다. 칸은 서버 completed·coverage 그대로
export function LessonPage() {
  const params = useParams()
  const classId = Number(params.id)
  const code = params.code ?? ''
  const classes = useQuery(teacherClassesQuery)
  const detail = useQuery(lessonDetailQuery(classId, code))
  const klass = classes.data?.items.find((c) => c.id === classId)

  return (
    <div {...levelProps(klass?.level.colorHex)}>
      <Link to={`/teacher/classes/${classId}`} className={styles.back}>
        ← {klass ? `${klass.name} 청취 현황` : '청취 현황'}
      </Link>
      {detail.data ? (
        <>
          <div className={styles.head}>
            <div>
              <h1 className={styles.title}>{detail.data.lesson.title}</h1>
              {/* 진도표에 이 회차가 휴강 행으로만 있으면 날짜가 null(BE #28) */}
              <p className={styles.sub}>
                {detail.data.lesson.scheduledDate === null
                  ? '수업일 없음'
                  : `${shortDate(detail.data.lesson.scheduledDate)} 수업`}{' '}
                · {detail.data.lesson.code}
              </p>
            </div>
          </div>
          <LessonTable classId={classId} data={detail.data} />
          <p className={styles.footnote}>필수 속도 파일만 보입니다. 다른 속도는 학생 상세에서</p>
        </>
      ) : (
        <TeacherLoadState query={detail} />
      )}
    </div>
  )
}

const STATUS = {
  completed: { status: 'completed', text: '완료' },
  in_progress: { status: 'in_progress', text: '진행 중' },
  not_started: { status: 'open', text: '미시작' },
} as const satisfies Record<LessonDetailRow['status'], { status: Status; text: string }>

function LessonTable({ classId, data }: { classId: number; data: LessonDetail }) {
  const required = data.tracks.filter((t) => t.required)
  const columns: Column<LessonDetailRow>[] = [
    {
      key: 'student',
      header: '학생',
      cell: (r) => (
        <Link to={`/teacher/classes/${classId}/students/${r.student.id}`}>{r.student.name}</Link>
      ),
    },
    {
      key: 'status',
      header: '상태',
      // 4.4에는 필수 완료 수가 없어 상태 글자만
      cell: (r) => (
        <StatusPill status={STATUS[r.status].status}>{STATUS[r.status].text}</StatusPill>
      ),
    },
    ...required.map((t): Column<LessonDetailRow> => ({
      key: `track-${t.trackId}`,
      header: `지문 ${t.passageNo}`,
      center: true,
      cell: (r) => {
        const result = r.byTrack[String(t.trackId)]
        const label = `${r.student.name} 지문 ${t.passageNo}`
        if (result?.completed === true)
          return (
            <StatusPill
              status="completed"
              shape="cell"
              srLabel={`${label} 완료 ${percent(result.coverage)}`}
            >
              <Check size={14} strokeWidth={3} />
            </StatusPill>
          )
        if (result !== undefined && result.coverage > 0)
          return (
            <StatusPill
              status="in_progress"
              shape="cell"
              srLabel={`${label} 들은 구간 ${percent(result.coverage)}`}
            >
              {percent(result.coverage)}
            </StatusPill>
          )
        return (
          <StatusPill status="open" shape="cell" srLabel={`${label} 안 들음`}>
            —
          </StatusPill>
        )
      },
    })),
  ]
  return (
    <Table
      caption={`${data.lesson.title} 학생별 지문 완료`}
      columns={columns}
      rows={data.rows}
      rowKey={(r) => r.student.id}
      empty="학생이 없습니다"
    />
  )
}
