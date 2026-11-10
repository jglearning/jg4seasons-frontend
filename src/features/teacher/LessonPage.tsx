import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { levelProps } from '../../shared/level'
import { StatusPill, type Status } from '../../shared/ui/StatusPill'
import { Table, type Column } from '../../shared/ui/Table'
import { groupByPassage, passageCell, percent, shortDate } from './format'
import { voiceLabel } from '../../shared/lessonLabel'
import {
  lessonDetailQuery,
  teacherClassesQuery,
  type LessonDetail,
  type LessonDetailRow,
} from './teacherApi'
import { TeacherLoadState } from './TeacherLoadState'
import styles from './Teacher.module.css'

// T-05 회차 상세(03 §4.4) — 수업 전에 빠르게 보는 학생 × 지문 표.
// 트랙은 지문 × 목소리 4개(BE #40)라 지문당 열 하나로 모은다: 완료한 목소리 ✓, 없으면 가장 많이 들은 목소리 %.
// 목소리별 자세한 값은 학생 상세(T-04). 칸은 서버 completed·coverage 그대로
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
  const passages = groupByPassage(data.tracks.filter((t) => t.required))
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
    ...passages.map(({ passageNo, tracks }): Column<LessonDetailRow> => ({
      key: `passage-${passageNo}`,
      header: `지문 ${passageNo}`,
      center: true,
      cell: (r) => {
        const result = passageCell(
          tracks.flatMap((track) => {
            const heard = r.byTrack[String(track.trackId)]
            return heard === undefined ? [] : [{ track, ...heard }]
          }),
        )
        const label = `${r.student.name} 지문 ${passageNo}`
        const voice = result === undefined ? '' : (voiceLabel(result.track.variant) ?? '')
        if (result?.completed === true)
          return (
            <StatusPill
              status="completed"
              shape="cell"
              srLabel={`${label} 완료 · ${voice} ${percent(result.coverage)}`}
            >
              <Check size={14} strokeWidth={3} />
            </StatusPill>
          )
        if (result !== undefined)
          return (
            <StatusPill
              status="in_progress"
              shape="cell"
              srLabel={`${label} 들은 구간 · ${voice} ${percent(result.coverage)}`}
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
