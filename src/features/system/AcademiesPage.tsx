import { useQuery } from '@tanstack/react-query'
import { ButtonLink } from '../../shared/ui/Button'
import { StaffLoadState } from '../../shared/ui/StaffLoadState'
import { Table, type Column } from '../../shared/ui/Table'
import { academiesQuery, type Academy } from './systemApi'
import { academyStatusLabel, licenseModeLabel } from './systemCopy'
import styles from './System.module.css'

// O-01 학원 관리 — 목록(SYS-07, 7.1). 순서는 서버(id 순). 운영자 로그인 뒤 첫 화면
export function AcademiesPage() {
  const academies = useQuery(academiesQuery)

  const columns: Column<Academy>[] = [
    { key: 'name', header: '학원', cell: (a) => a.name },
    {
      key: 'slug',
      header: '학원 주소',
      cell: (a) => <span className={styles.mono}>{a.slug}</span>,
    },
    { key: 'license', header: '사용권', cell: (a) => licenseModeLabel(a.licenseEnforced) },
    { key: 'timezone', header: '타임존', cell: (a) => a.timezone },
    { key: 'status', header: '상태', cell: (a) => academyStatusLabel(a.status) },
  ]

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>학원 관리</h1>
          {academies.data && <p className={styles.sub}>{academies.data.items.length}개 학원</p>}
        </div>
        <ButtonLink to="/system/academies/new" size="teacher">
          학원 만들기
        </ButtonLink>
      </div>
      {academies.data ? (
        <Table
          caption="학원 목록"
          columns={columns}
          rows={academies.data.items}
          rowKey={(a) => a.id}
          empty="만든 학원 없음"
        />
      ) : (
        <StaffLoadState query={academies} />
      )}
    </>
  )
}
