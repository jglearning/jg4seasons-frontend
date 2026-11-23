import { Info } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { Button } from '../../../shared/ui/Button'
import { groupStudents, toStudents } from './build'
import type { ColumnRole, ParsedRow } from './parse'
import styles from './Roster.module.css'

// A-05 ① 붙여넣기 · ② 열 고르기

const EXAMPLE = [
  ['겨울 그린 A', '김하늘', 'A중', '중1'],
  ['겨울 그린 A', '이도윤', 'A중', '중1'],
  ['겨울 그린 A', '박서아', 'B중', '중1'],
  ['겨울 블루 B', '최지호', 'A중', '중2'],
]

type PasteStepProps = {
  text: string
  onText: (next: string) => void
  hasHeader: boolean
  onHeader: (next: boolean) => void
  onNext: () => void
}

export function PasteStep({ text, onText, hasHeader, onHeader, onNext }: PasteStepProps) {
  const id = useId()
  const area = useRef<HTMLTextAreaElement>(null)
  useEffect(() => area.current?.focus(), [])
  const empty = text.trim() === ''

  return (
    <>
      <div className={styles.pasteGrid}>
        <div className={styles.pasteMain}>
          <label htmlFor={id} className={styles.label}>
            명단
          </label>
          <textarea
            id={id}
            ref={area}
            className={styles.textarea}
            value={text}
            onChange={(e) => onText(e.target.value)}
            placeholder={
              '엑셀이나 구글 시트에서 학생 칸을 골라 복사(Ctrl+C)한 뒤 여기에 붙여넣어 주세요(Ctrl+V).\n한 줄에 학생 한 명씩, 칸은 탭이나 쉼표로 나뉘어 있으면 됩니다.'
            }
            spellCheck={false}
            autoComplete="off"
          />
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={(e) => onHeader(e.target.checked)}
            />
            첫 줄은 제목입니다 (반·이름 같은 머리글)
          </label>
        </div>
        <aside className={styles.example} aria-labelledby={`${id}-example`}>
          <h2 id={`${id}-example`} className={styles.label}>
            이런 모양이면 됩니다
          </h2>
          <table className={styles.exampleTable}>
            <thead>
              <tr>
                <th scope="col">반</th>
                <th scope="col">이름</th>
                <th scope="col">학교</th>
                <th scope="col">학년</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLE.map((cells) => (
                <tr key={cells[1]}>
                  {cells.map((c, i) => (
                    <td key={i}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className={styles.hints}>
            <li>이름 칸은 꼭 있어야 합니다. 반 칸이 없으면 모두 한 반으로 넣을 수 있습니다</li>
            <li>
              전화번호 같은 칸이 섞여 있어도 됩니다. 다음 단계에서 빼면 서버로 보내지 않습니다
            </li>
            <li>한 번에 반 30개, 학생 500명까지 가져올 수 있습니다</li>
          </ul>
        </aside>
      </div>
      <div className={styles.footer}>
        <span />
        <div className={styles.footerEnd}>
          <Button size="teacher" onClick={onNext} disabled={empty}>
            다음 · 열 고르기
          </Button>
        </div>
      </div>
    </>
  )
}

const ROLE_OPTIONS: Array<{ value: ColumnRole; label: string }> = [
  { value: 'name', label: '이름' },
  { value: 'class', label: '반' },
  { value: 'school', label: '학교' },
  { value: 'grade', label: '학년' },
  { value: 'skip', label: '쓰지 않음' },
]

type ColumnsStepProps = {
  table: { rows: ParsedRow[]; header: string[] | undefined }
  roles: ColumnRole[]
  onRoles: (next: ColumnRole[]) => void
  oneClass: boolean
  onOneClass: (next: boolean) => void
  onBack: () => void
  onNext: () => void
}

export function ColumnsStep({
  table,
  roles,
  onRoles,
  oneClass,
  onOneClass,
  onBack,
  onNext,
}: ColumnsStepProps) {
  const { rows, header } = table
  const hasName = roles.includes('name')
  const hasClass = oneClass || roles.includes('class')
  const groupCount = groupStudents(toStudents(rows, roles, oneClass)).length
  const blocked = !hasName
    ? '이름 열을 골라 주세요'
    : !hasClass
      ? "반 열을 고르거나 '모두 한 반으로'를 켜 주세요"
      : null

  // 같은 뜻은 한 열에만 — 다른 열에서 고르면 앞의 것은 쓰지 않음으로
  function choose(column: number, role: ColumnRole) {
    onRoles(roles.map((r, i) => (i === column ? role : role !== 'skip' && r === role ? 'skip' : r)))
  }

  function toggleOneClass(next: boolean) {
    onOneClass(next)
    if (next) onRoles(roles.map((r) => (r === 'class' ? 'skip' : r)))
  }

  const options = oneClass ? ROLE_OPTIONS.filter((o) => o.value !== 'class') : ROLE_OPTIONS

  return (
    <>
      <div className={styles.columnsHead}>
        <p className={styles.summary}>
          <strong>
            학생 {rows.length}명 · 열 {roles.length}개
          </strong>
          {header && <span className={styles.muted}> 첫 줄(제목)은 빼고 셌습니다</span>}
        </p>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={oneClass}
            onChange={(e) => toggleOneClass(e.target.checked)}
          />
          반 칸 없이 모두 한 반으로 넣습니다
        </label>
      </div>
      <div className={styles.previewScroll} role="region" aria-label="붙여넣은 명단" tabIndex={0}>
        <table className={styles.preview}>
          <caption className={styles.srOnly}>붙여넣은 명단 — 열마다 뜻 고르기</caption>
          <thead>
            <tr>
              <th scope="col" className={styles.lineCol}>
                <span className={styles.srOnly}>줄</span>
              </th>
              {roles.map((role, i) => {
                const title = header?.[i]
                return (
                  <th key={i} scope="col" data-skip={role === 'skip' || undefined}>
                    <label className={styles.colLabel}>
                      <span className={styles.colTitle}>
                        {i + 1}열{title ? ` · 제목 '${title}'` : ''}
                      </span>
                      <select
                        className={styles.colSelect}
                        value={role}
                        onChange={(e) => choose(i, e.target.value as ColumnRole)}
                      >
                        {options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.line}>
                <td className={styles.lineCol}>{row.line}</td>
                {row.cells.map((cell, i) => (
                  <td key={i} data-skip={roles[i] === 'skip' || undefined}>
                    {cell === '' && roles[i] === 'name' ? (
                      <span className={styles.muted}>(빈 칸)</span>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.footer}>
        <Button variant="secondary" size="teacher" onClick={onBack}>
          ← 붙여넣기
        </Button>
        <div className={styles.footerEnd}>
          {blocked ? (
            <span className={styles.blocked}>
              <Info size={16} aria-hidden="true" />
              {blocked}
            </span>
          ) : (
            <span className={styles.muted}>반 {groupCount}개로 나뉩니다</span>
          )}
          <Button size="teacher" onClick={onNext} disabled={blocked !== null}>
            다음 · 반 정하기
          </Button>
        </div>
      </div>
    </>
  )
}
