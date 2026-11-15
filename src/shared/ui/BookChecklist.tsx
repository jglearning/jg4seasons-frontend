import { useId, type ReactNode } from 'react'
import type { BookGroup } from '../books'
import styles from './BookChecklist.module.css'

// 교재 여러 권 고르기(O-03 사용권 지정). 레벨 한 줄 = [세트] 체크 + 권 체크, 위에 [전체].
// 학원은 교재를 보통 전부 또는 레벨 한 세트로 사서 세트·전체를 한 번에 고르게 했다.
// <fieldset> + <legend> + <input type="checkbox"> + <label> — 세트·전체는 일부만 골라지면 중간 상태(indeterminate)
type BookChecklistProps = {
  legend: ReactNode
  groups: BookGroup[]
  /** 고른 권 코드 */
  selected: string[]
  onChange: (next: string[]) => void
  /** 권 옆에 덧붙일 글자(지정된 기간·저장 결과) — 없으면 undefined */
  note?: (code: string) => ReactNode
  error?: ReactNode
  disabled?: boolean
}

export function BookChecklist({
  legend,
  groups,
  selected,
  onChange,
  note,
  error,
  disabled = false,
}: BookChecklistProps) {
  const baseId = useId()
  const errorId = error ? `${baseId}-error` : undefined
  const allCodes = groups.flatMap((g) => g.books.map((b) => b.code))
  const picked = new Set(selected)

  // 묶음(세트·전체) 체크: 다 골라졌으면 모두 빼고, 아니면 모두 넣는다. 순서는 늘 레벨·권 순
  function toggleMany(codes: string[]) {
    const every = codes.every((c) => picked.has(c))
    const next = new Set(picked)
    for (const code of codes) {
      if (every) next.delete(code)
      else next.add(code)
    }
    onChange(allCodes.filter((c) => next.has(c)))
  }

  function bulkBox(id: string, codes: string[], label: string) {
    const count = codes.filter((c) => picked.has(c)).length
    return (
      <label htmlFor={id} className={styles.bulk}>
        <input
          id={id}
          type="checkbox"
          className={styles.box}
          checked={count === codes.length}
          ref={(el) => {
            if (el) el.indeterminate = count > 0 && count < codes.length
          }}
          onChange={() => toggleMany(codes)}
        />
        {label}
      </label>
    )
  }

  return (
    <fieldset
      className={styles.group}
      aria-invalid={error ? true : undefined}
      aria-describedby={errorId}
      disabled={disabled}
    >
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.all}>
        {bulkBox(`${baseId}-all`, allCodes, `전체 ${allCodes.length}권`)}
      </div>
      <div className={styles.rows}>
        {groups.map((group) => {
          const codes = group.books.map((b) => b.code)
          const notes = group.books
            .map((book) => ({ book, text: note?.(book.code) }))
            .filter((n) => n.text !== undefined && n.text !== null && n.text !== false)
          return (
            <div key={group.level} className={styles.row}>
              <div className={styles.level}>
                {codes.length > 1 ? (
                  bulkBox(`${baseId}-${group.level}`, codes, `${group.name} 세트`)
                ) : (
                  <span className={styles.levelName}>{group.name}</span>
                )}
              </div>
              <div className={styles.books}>
                <div className={styles.options}>
                  {group.books.map((book) => {
                    const id = `${baseId}-${book.code}`
                    const hasNote = notes.some((n) => n.book.code === book.code)
                    return (
                      <label key={book.code} htmlFor={id} className={styles.option}>
                        <input
                          id={id}
                          type="checkbox"
                          className={styles.box}
                          value={book.code}
                          checked={picked.has(book.code)}
                          aria-label={book.label}
                          aria-describedby={hasNote ? `${id}-note` : undefined}
                          onChange={() => toggleMany([book.code])}
                        />
                        {book.season}
                      </label>
                    )
                  })}
                </div>
                {notes.map(({ book, text }) => (
                  <p key={book.code} id={`${baseId}-${book.code}-note`} className={styles.note}>
                    {book.season} — {text}
                  </p>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
