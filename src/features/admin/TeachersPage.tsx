import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ButtonLink } from '../../shared/ui/Button'
import { Table, type Column } from '../../shared/ui/Table'
import { StaffLoadState } from '../../shared/ui/StaffLoadState'
import { classesQuery, teachersQuery, type AdminTeacher } from './adminApi'
import { koreaDateTime, roleLabel, teacherStatusLabel } from './format'
import styles from './Admin.module.css'

// A-03 교사 관리 — 목록(ADM-04). 담당 반 이름은 반 목록에서 찾는다(교사 응답에는 반 id만)
export function TeachersPage() {
  const teachers = useQuery(teachersQuery)
  const classes = useQuery(classesQuery)
  const className = (id: number) => classes.data?.items.find((c) => c.id === id)?.name ?? `반 ${id}`

  const columns: Column<AdminTeacher>[] = [
    {
      key: 'name',
      header: '이름',
      cell: (t) => <Link to={`/admin/teachers/${t.id}`}>{t.name}</Link>,
    },
    { key: 'loginId', header: '아이디', cell: (t) => t.loginId ?? '없음' },
    { key: 'role', header: '역할', cell: (t) => roleLabel(t.role) },
    { key: 'status', header: '상태', cell: (t) => teacherStatusLabel(t.status) },
    {
      key: 'classes',
      header: '담당 반',
      cell: (t) => (t.classIds.length === 0 ? '없음' : t.classIds.map(className).join(', ')),
    },
    {
      key: 'lastLogin',
      header: '마지막 로그인',
      cell: (t) => (t.lastLoginAt ? koreaDateTime(t.lastLoginAt) : '없음'),
    },
  ]

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>교사 관리</h1>
          {teachers.data && <p className={styles.sub}>{teachers.data.total}명</p>}
        </div>
        <ButtonLink to="/admin/teachers/new" size="teacher">
          교사 추가
        </ButtonLink>
      </div>
      {teachers.data ? (
        <Table
          caption="교사 목록"
          columns={columns}
          rows={teachers.data.items}
          rowKey={(t) => t.id}
          empty="등록된 교사 없음"
        />
      ) : (
        <StaffLoadState query={teachers} />
      )}
    </>
  )
}
