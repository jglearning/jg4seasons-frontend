import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Table, type Column } from '../../shared/ui/Table'
import { StaffLoadState } from '../../shared/ui/StaffLoadState'
import { shortDate } from '../../shared/dates'
import { dashboardQuery, type Dashboard } from './studentsApi'
import styles from './Admin.module.css'

// A-04 학원 현황(03 §5.4, ADM-05 간단히). 완료율은 서버 값(0~1)을 퍼센트로 보이기만 한다(계산하지 않음).
// 퍼센트는 교사·관리자 화면에서만 쓴다(카피 규칙)
type DashboardClass = Dashboard['classes'][number]

export function DashboardPage() {
  const dashboard = useQuery(dashboardQuery)

  const columns: Column<DashboardClass>[] = [
    {
      key: 'name',
      header: '반 이름',
      cell: (c) => <Link to={`/admin/classes/${c.id}`}>{c.name}</Link>,
    },
    {
      key: 'current',
      header: '현재 회차',
      cell: (c) =>
        c.current ? `${c.current.lesson.title} · ${shortDate(c.current.scheduledDate)}` : '수업 전',
    },
    {
      key: 'rate',
      header: '완료율',
      numeric: true,
      cell: (c) => `${Math.round(c.completedRate * 100)}%`,
    },
  ]

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>학원 현황</h1>
          {/* 서버 activeStudentsToday = 오늘(학원 날짜) 한 번이라도 들은 학생(BE #30) */}
          {dashboard.data && (
            <p className={styles.sub}>오늘 들은 학생 {dashboard.data.activeStudentsToday}명</p>
          )}
        </div>
      </div>
      {dashboard.data ? (
        <Table
          caption="반별 완료율"
          columns={columns}
          rows={dashboard.data.classes}
          rowKey={(c) => c.id}
          empty="운영 중인 반 없음"
        />
      ) : (
        <StaffLoadState query={dashboard} />
      )}
    </>
  )
}
