import { useQuery } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { Table, type Column } from '../../shared/ui/Table'
import { AdminLoadState } from './AdminLoadState'
import { licensesQuery, type AdminLicense } from './adminApi'
import { licenseBookLabel, licenseStatusLabel, shortDate } from './format'
import styles from './Admin.module.css'

// A-05 교재 사용권(#66, BE #48 7.5). 보기만 — 바꾸기는 운영자(O-03).
// 상태·남은 날·학생 수는 서버 값 그대로(남은 날은 마지막 날이 1). 순서도 서버(레벨·권 순).
// 직영 학원(licenseEnforced false)은 모든 권이 무제한이라 표 대신 한 줄. 메뉴는 직영에도 늘 보인다(이슈에서 정함)
export function LicensesPage() {
  const licenses = useQuery(licensesQuery)
  const data = licenses.data

  const columns: Column<AdminLicense>[] = [
    { key: 'book', header: '교재', cell: (l) => licenseBookLabel(l.book.code, l.book.season) },
    { key: 'period', header: '기간', cell: (l) => `${l.startDate} ~ ${l.endDate}` },
    { key: 'status', header: '상태', cell: (l) => licenseStatusLabel(l.status) },
    {
      key: 'daysLeft',
      header: '남은 날',
      cell: (l) => (l.daysLeft === null ? '—' : `${l.daysLeft}일`),
    },
    {
      key: 'seats',
      header: '학생 수',
      cell: (l) =>
        l.usedSeats > l.seats ? (
          // 색만으로 구분하지 않는다 — 아이콘 + 글자
          <span className={styles.over}>
            {l.usedSeats} / {l.seats} <TriangleAlert size={16} strokeWidth={2} aria-hidden />
            한도 넘음
          </span>
        ) : (
          `${l.usedSeats} / ${l.seats}`
        ),
    },
  ]

  const overAny = data?.items.some((l) => l.usedSeats > l.seats) ?? false

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>교재 사용권</h1>
          {data && <p className={styles.sub}>기준일 {shortDate(data.today)}</p>}
        </div>
      </div>
      {!data ? (
        <AdminLoadState query={licenses} />
      ) : !data.licenseEnforced ? (
        <p className={styles.notice}>직영 학원 — 모든 교재 제한 없이 사용</p>
      ) : (
        <>
          <Table
            caption="교재 사용권"
            columns={columns}
            rows={data.items}
            rowKey={(l) => l.book.code}
            empty="지정된 교재 없음"
          />
          {overAny && (
            <p className={styles.licenseNote}>
              한도를 넘은 교재는 그 교재 반으로 새 등록·반 이동만 막힘(지금 학생은 그대로)
            </p>
          )}
          <p className={styles.licenseNote}>사용권 변경은 운영자에게 요청</p>
        </>
      )}
    </>
  )
}
