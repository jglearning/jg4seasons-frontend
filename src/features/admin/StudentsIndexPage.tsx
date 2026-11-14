import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Table, type Column } from '../../shared/ui/Table'
import { StaffLoadState } from '../../shared/ui/StaffLoadState'
import { classesQuery, type AdminClass } from './adminApi'
import { bookLabel } from '../../shared/books'
import { classStatusLabel } from './format'
import styles from './Admin.module.css'

// A-02 학생 관리 첫 화면 — 반 고르기. 명단 API가 반 단위(03 §5.2)라 반을 먼저 고른다.
// 학원 전체 이름 검색(POST /admin/students/search)은 2차
export function StudentsIndexPage() {
  const classes = useQuery(classesQuery)

  const columns: Column<AdminClass>[] = [
    {
      key: 'name',
      header: '반 이름',
      cell: (c) => <Link to={`/admin/classes/${c.id}/students`}>{c.name}</Link>,
    },
    { key: 'book', header: '권', cell: (c) => bookLabel(c.bookCode, c.levelCode, c.season) },
    { key: 'students', header: '학생', numeric: true, cell: (c) => `${c.studentCount}명` },
    { key: 'status', header: '상태', cell: (c) => classStatusLabel(c.status) },
  ]

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>학생 관리</h1>
          <p className={styles.sub}>반을 고르면 명단·추가·개인 코드 재발급</p>
        </div>
      </div>
      {classes.data ? (
        <Table
          caption="반 고르기"
          columns={columns}
          rows={classes.data.items}
          rowKey={(c) => c.id}
          empty="만든 반 없음"
        />
      ) : (
        <StaffLoadState query={classes} />
      )}
    </>
  )
}
