import { useQuery } from '@tanstack/react-query'
import { Check, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { levelProps } from '../../shared/level'
import { ButtonLink } from '../../shared/ui/Button'
import { LevelChip } from '../../shared/ui/LevelChip'
import { ModeTabs } from '../../shared/ui/ModeTabs'
import { StatusPill } from '../../shared/ui/StatusPill'
import { Table, type Column } from '../../shared/ui/Table'
import { cellLook, GROUP_SIZE, matrixGroups, monthDay, shortDate } from './format'
import {
  matrixQuery,
  sessionsQuery,
  teacherClassesQuery,
  type Matrix,
  type MatrixSession,
  type MatrixStudent,
  type SeqRange,
} from './teacherApi'
import { TeacherLoadState } from './TeacherLoadState'
import styles from './Teacher.module.css'
import { lessonDayLabel } from '../../shared/lessonLabel'

// T-03 반 청취 현황(03 §4.2). 학생 × 회차 표, 8회차 묶음(겨울 1·2·3)씩.
// 칸 상태(완료·진행·미시작·밀림·수업 전)는 서버 값을 모양으로만 바꾼다(format.ts cellLook).
// 머리글 요약(반 이름·레벨·계절·지금 회차 수)은 반 목록(4.1) 응답을 쓴다 — 4.2의 class에는 계절·인원 수가 없다.
// 묶음 = 진도표 seq 8개. 묶음 수는 진도표(4.5)의 마지막 seq로 정한다(format.ts matrixGroups)
function groupRange(group: number): SeqRange {
  return { fromSeq: (group - 1) * GROUP_SIZE + 1, toSeq: group * GROUP_SIZE }
}

export function MatrixPage() {
  const classId = Number(useParams().id)
  // 처음에는 범위 없이 요청(서버가 지금 회차가 든 묶음을 고른다). 탭을 누르면 그 묶음
  const [group, setGroup] = useState<number | undefined>(undefined)
  const classes = useQuery(teacherClassesQuery)
  const matrix = useQuery(matrixQuery(classId, group === undefined ? undefined : groupRange(group)))
  const sessions = useQuery(sessionsQuery(classId))
  const klass = classes.data?.items.find((c) => c.id === classId)
  const groups = matrixGroups(sessions.data?.items.at(-1)?.seq)

  // 지금 보이는 묶음 = 응답의 첫 회차가 든 묶음(서버 기본 범위를 그대로 표시)
  const firstSeq = matrix.data?.sessions[0]?.seq
  const shownGroup =
    group ?? (firstSeq === undefined ? undefined : Math.ceil(firstSeq / GROUP_SIZE))

  // 담당이 아니거나 없는 반이면 목록에 없다 → 머리글은 비우고, 매트릭스 응답(403·404) 문구를 보인다
  return (
    <div {...levelProps(klass?.level.colorHex)}>
      <Link to="/teacher" className={styles.back}>
        ← 반 목록
      </Link>
      <div className={styles.head}>
        <div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{klass ? `${klass.name} 청취 현황` : '청취 현황'}</h1>
            {klass && (
              <LevelChip>
                {klass.level.nameKo} · {klass.book.season}
              </LevelChip>
            )}
          </div>
          {klass && <p className={styles.sub}>학생 {klass.studentCount}명</p>}
        </div>
        <ButtonLink to={`/teacher/classes/${classId}/sessions`} variant="secondary" size="teacher">
          진도표
        </ButtonLink>
      </div>

      {klass?.current && (
        <ul className={styles.summary} aria-label="지금 회차 요약">
          <li>
            현재 {klass.current.lesson.title} · {shortDate(klass.current.scheduledDate)}
          </li>
          <li>
            완료 {klass.current.completed} / {klass.studentCount}
          </li>
          <li>진행 중 {klass.current.inProgress}</li>
          <li>미시작 {klass.current.notStarted}</li>
          {klass.overdueStudents > 0 && (
            <li className={styles.summaryDanger}>
              <TriangleAlert size={16} strokeWidth={2} aria-hidden />
              밀린 학생 {klass.overdueStudents}명
            </li>
          )}
        </ul>
      )}

      {/* 탭 이름(겨울 1)은 반 목록 응답의 계절이 와야 그린다 — 오기 전에 "1·2·3"만 보이지 않게 */}
      {klass && (
        <div className={styles.groups}>
          <ModeTabs
            label="회차 묶음"
            options={groups.map((g) => ({
              id: g,
              label: `${klass.book.season} ${g}`,
              sub: `${(g - 1) * GROUP_SIZE + 1}~${g * GROUP_SIZE}회`,
            }))}
            selected={shownGroup ?? 0}
            onSelect={setGroup}
          />
        </div>
      )}

      {matrix.data ? (
        <MatrixTable classId={classId} data={matrix.data} />
      ) : (
        <TeacherLoadState query={matrix} />
      )}

      <Legend />
    </div>
  )
}

function MatrixTable({ classId, data }: { classId: number; data: Matrix }) {
  const columns: Column<MatrixStudent>[] = [
    {
      key: 'student',
      header: '학생',
      // 이름 → T-04 학생 상세
      cell: (s) => (
        <Link to={`/teacher/classes/${classId}/students/${s.id}`} className={styles.studentName}>
          {s.name}
        </Link>
      ),
    },
    ...data.sessions.map((session): Column<MatrixStudent> => ({
      key: `seq-${session.seq}`,
      // 회차 머리글 → T-05 회차 상세. 휴강 행은 열로 오지 않는다(BE #28)
      header: (
        <Link
          to={`/teacher/classes/${classId}/lessons/${session.lesson.code}`}
          className={styles.headLink}
        >
          <SessionHeader session={session} />
        </Link>
      ),
      center: true,
      current: session.isCurrent,
      cell: (student) => {
        const look = cellLook(session, data.cells[String(student.id)]?.[session.lesson.code])
        return (
          <StatusPill
            status={look.status}
            shape="cell"
            srLabel={`${student.name} ${session.lesson.title} ${look.label}`}
          >
            {look.status === 'completed' ? <Check size={14} strokeWidth={3} /> : look.text}
          </StatusPill>
        )
      },
    })),
  ]

  return (
    <Table
      caption="학생별 회차 청취 현황"
      columns={columns}
      rows={data.students}
      rowKey={(s) => s.id}
      empty="학생이 없습니다"
    />
  )
}

// 머리글은 수업 순번(seq)이 아니라 교재 회차 번호(Day n) — 칸이 회차 기준이라, 휴강으로 수업이 밀려도
// 머리글과 칸 내용이 어긋나지 않는다(11/7 동섭 승인). 날짜는 그 회차를 수업하는 날
function SessionHeader({ session }: { session: MatrixSession }) {
  return (
    <span className={styles.sessionHead}>
      <span>{lessonDayLabel(session.lesson.code)}</span>{' '}
      <span className={styles.sessionDate}>{monthDay(session.scheduledDate)}</span>
      {session.isCurrent && <span className={styles.srOnly}> 지금 회차</span>}
    </span>
  )
}

// 범례 — 색 없이도 읽히게 모양과 글자를 같이 보인다
function Legend() {
  return (
    <ul className={styles.legend} aria-label="칸 모양 설명">
      <li>
        <StatusPill status="completed" shape="cell">
          <Check size={14} strokeWidth={3} aria-hidden />
        </StatusPill>
        완료
      </li>
      <li>
        <StatusPill status="in_progress" shape="cell">
          3/6
        </StatusPill>
        진행 중(필수 지문)
      </li>
      <li>
        <StatusPill status="open" shape="cell">
          —
        </StatusPill>
        미시작
      </li>
      <li>
        <StatusPill status="overdue" shape="cell">
          밀림
        </StatusPill>
        다음 수업 전까지 못 끝냄
      </li>
      <li>
        <StatusPill status="locked" shape="cell">
          {null}
        </StatusPill>
        수업 전
      </li>
    </ul>
  )
}
