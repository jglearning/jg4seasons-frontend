import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ButtonLink } from '../../shared/ui/Button'
import { Table, type Column } from '../../shared/ui/Table'
import { AdminLoadState } from './AdminLoadState'
import { classesQuery, type AdminClass } from './adminApi'
import { bookLabel, classStatusLabel, weekdaysText } from './format'
import styles from './Admin.module.css'

// A-01 반 관리 — 목록(ADM-01·03). 가입 코드는 학생에게 나눠 주는 값이라 표에 바로 보인다
export function ClassesPage() {
  const classes = useQuery(classesQuery)

  const columns: Column<AdminClass>[] = [
    {
      key: 'name',
      header: '반 이름',
      cell: (c) => <Link to={`/admin/classes/${c.id}`}>{c.name}</Link>,
    },
    { key: 'book', header: '권', cell: (c) => bookLabel(c.bookCode, c.levelCode, c.season) },
    { key: 'weekdays', header: '수업 요일', cell: (c) => weekdaysText(c.weekdays) },
    { key: 'start', header: '개강일', cell: (c) => c.startDate },
    {
      key: 'teachers',
      header: '담당 교사',
      cell: (c) => (c.teachers.length === 0 ? '없음' : c.teachers.map((t) => t.name).join(', ')),
    },
    { key: 'students', header: '학생', numeric: true, cell: (c) => `${c.studentCount}명` },
    {
      key: 'code',
      header: '가입 코드',
      cell: (c) => <span className={styles.mono}>{c.accessCode}</span>,
    },
    { key: 'status', header: '상태', cell: (c) => classStatusLabel(c.status) },
  ]

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>반 관리</h1>
          {classes.data && <p className={styles.sub}>{classes.data.total}개 반</p>}
        </div>
        <ButtonLink to="/admin/classes/new" size="teacher">
          반 만들기
        </ButtonLink>
      </div>
      {classes.data ? (
        <Table
          caption="반 목록"
          columns={columns}
          rows={classes.data.items}
          rowKey={(c) => c.id}
          empty="만든 반 없음"
        />
      ) : (
        <AdminLoadState query={classes} />
      )}
    </>
  )
}
