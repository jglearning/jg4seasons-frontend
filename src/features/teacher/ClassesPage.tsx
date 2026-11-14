import { useQuery } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { levelProps } from '../../shared/level'
import { Card } from '../../shared/ui/Card'
import { LevelChip } from '../../shared/ui/LevelChip'
import { ClassJoinActions } from './ClassJoin'
import { shortDate } from '../../shared/dates'
import { koreaTime } from './format'
import { teacherClassesQuery, type TeacherClass } from './teacherApi'
import { StaffLoadState } from '../../shared/ui/StaffLoadState'
import styles from './Teacher.module.css'

// T-02 반 목록(03 §4.1). 반마다 카드 하나 — 지금 회차의 완료·진행·미시작, 밀린 학생, 로그인 실패 경고, 다음 수업.
// 숫자는 모두 서버 값. 반 이름을 누르면 T-03 매트릭스
export function ClassesPage() {
  const classes = useQuery(teacherClassesQuery)

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>반 목록</h1>
          {classes.data && <p className={styles.sub}>반 {classes.data.items.length}개</p>}
        </div>
      </div>
      {classes.data ? (
        classes.data.items.length === 0 ? (
          <p className={styles.notice}>담당 반이 없습니다</p>
        ) : (
          <ul className={styles.cards}>
            {classes.data.items.map((c) => (
              <li key={c.id}>
                <ClassCard klass={c} />
              </li>
            ))}
          </ul>
        )
      ) : (
        <StaffLoadState query={classes} />
      )}
    </>
  )
}

function ClassCard({ klass }: { klass: TeacherClass }) {
  const { current } = klass
  return (
    <Card size="teacher" className={styles.card} {...levelProps(klass.level.colorHex)}>
      <div className={styles.cardHead}>
        <LevelChip>
          {klass.level.nameKo} · {klass.book.season}
        </LevelChip>
        <span className={styles.count}>학생 {klass.studentCount}명</span>
      </div>
      <h2 className={styles.cardTitle}>
        <Link to={`/teacher/classes/${klass.id}`}>{klass.name}</Link>
      </h2>

      {current === null ? (
        <p className={styles.line}>수업 전</p>
      ) : (
        <>
          <p className={styles.line}>
            현재 {current.lesson.title} · {shortDate(current.scheduledDate)}
          </p>
          <p className={styles.counts}>
            완료 {current.completed} · 진행 중 {current.inProgress} · 미시작 {current.notStarted}
          </p>
        </>
      )}

      {klass.overdueStudents > 0 ? (
        <p className={styles.danger}>
          <TriangleAlert size={18} strokeWidth={2} aria-hidden />
          밀린 학생 {klass.overdueStudents}명
        </p>
      ) : (
        <p className={styles.muted}>밀린 학생 없음</p>
      )}

      {klass.loginAlert !== null && (
        <p className={styles.warning}>
          <TriangleAlert size={18} strokeWidth={2} aria-hidden />
          개인 코드 입력 실패 {klass.loginAlert.failures}회 · {koreaTime(klass.loginAlert.since)}
          부터
        </p>
      )}

      <p className={styles.next}>
        {klass.next === null
          ? '다음 수업 없음'
          : `다음 수업 ${shortDate(klass.next.scheduledDate)}`}
        {' · '}
        <Link to={`/teacher/classes/${klass.id}/sessions`} aria-label={`${klass.name} 진도표`}>
          진도표
        </Link>
      </p>

      <ClassJoinActions className={klass.name} accessCode={klass.accessCode} />
    </Card>
  )
}
