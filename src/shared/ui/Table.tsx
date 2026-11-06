import type { ReactNode } from 'react'
import styles from './Table.module.css'

// 디자인 가이드 §5 교사 표: 행 40, 헤더 surface, 셀 패딩 8/14. 좁으면 가로 스크롤 + 첫 열 고정(sticky).
// 열 정의(머리글·셀 그리기)는 쓰는 쪽이 넘긴다
export type Column<T> = {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** 숫자 열(오른쪽 맞춤·고정폭 숫자) */
  numeric?: boolean
}

type TableProps<T> = {
  /** 표 이름(스크린 리더·스크롤 영역 이름) */
  caption: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  /** 행이 없을 때 */
  empty?: string
}

export function Table<T>({ caption, columns, rows, rowKey, empty = '없음' }: TableProps<T>) {
  return (
    // 가로 스크롤 영역은 키보드로도 움직일 수 있게 포커스를 받는다
    <div className={styles.scroll} role="region" aria-label={caption} tabIndex={0}>
      <table className={styles.table}>
        <caption className={styles.caption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={column.numeric ? styles.numeric : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} className={column.numeric ? styles.numeric : undefined}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
