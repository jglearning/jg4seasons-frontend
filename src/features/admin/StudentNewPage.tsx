import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type SubmitEvent } from 'react'
import { Link, useParams } from 'react-router'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { TextField } from '../../shared/ui/TextField'
import { AdminLoadState } from './AdminLoadState'
import { classQuery, type AdminClass } from './adminApi'
import { CodeCards } from './CodeCards'
import { createStudents, type NewStudent, type PersonalCodeItem } from './studentsApi'
import { useSubmit } from './useSubmit'
import styles from './Admin.module.css'

// A-02 학생 추가(03 §5.2 POST, ADM-02). 한 줄에 학생 하나 — 이름은 필수, 학교·학년은 선택.
// 빈 줄은 보내지 않는다. 결과의 개인 코드 평문은 이 화면 지역 state에만 두고 카드로 인쇄한다(떠나면 사라짐).
// CSV 업로드는 백엔드 답을 기다린다(1차에 넣을지 질문함)
const START_ROWS = 3
const MAX_ROWS = 50

type Row = { key: number; name: string; school: string; grade: string }

export function StudentNewPage() {
  const classId = Number(useParams().id)
  const klass = useQuery(classQuery(classId))

  return (
    <>
      <Link to={`/admin/classes/${classId}/students`} className={styles.back}>
        ← 학생 명단
      </Link>
      {klass.data ? <AddStudents klass={klass.data} /> : <AdminLoadState query={klass} />}
    </>
  )
}

function AddStudents({ klass }: { klass: AdminClass }) {
  const queryClient = useQueryClient()
  const nextKey = useRef(START_ROWS)
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: START_ROWS }, (_, key) => ({ key, name: '', school: '', grade: '' })),
  )
  const [empty, setEmpty] = useState(false)
  const [created, setCreated] = useState<PersonalCodeItem[] | null>(null)
  const submit = useSubmit()

  function update(key: number, field: keyof Omit<Row, 'key'>, value: string) {
    setRows((before) => before.map((r) => (r.key === key ? { ...r, [field]: value } : r)))
  }

  function addRow() {
    setRows((before) => [...before, { key: nextKey.current++, name: '', school: '', grade: '' }])
  }

  function removeRow(key: number) {
    setRows((before) => before.filter((r) => r.key !== key))
  }

  // 보낼 줄: 칸이 하나라도 차 있는 줄. 서버 오류 칸(students[i].name)의 i는 이 목록 기준이다
  const filled = rows.filter((r) => r.name.trim() || r.school.trim() || r.grade.trim())

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (filled.length === 0) {
      setEmpty(true)
      return
    }
    setEmpty(false)
    const students: NewStudent[] = filled.map((r) => ({
      name: r.name.trim(),
      ...(r.school.trim() && { school: r.school.trim() }),
      ...(r.grade.trim() && { grade: r.grade.trim() }),
    }))
    const result = await submit.run(() => createStudents(klass.id, students))
    if (result === undefined) return
    setCreated(result)
    void queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  if (created) {
    return (
      <>
        <div className={styles.head}>
          <h1 className={styles.title}>{klass.name} 학생 추가</h1>
        </div>
        <CodeCards title={`등록 결과 ${created.length}명`} klass={klass} items={created} />
        <div className={styles.actions}>
          <ButtonLink to={`/admin/classes/${klass.id}/students`} variant="secondary" size="teacher">
            학생 명단으로
          </ButtonLink>
        </div>
      </>
    )
  }

  const fieldIndex = (key: number) => filled.findIndex((r) => r.key === key)
  const generalError = submit.formError(filled.map((_, i) => `students[${i}].name`))

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{klass.name} 학생 추가</h1>
          <p className={styles.sub}>이름은 필수, 학교·학년은 선택. 등록하면 개인 코드가 나옴</p>
        </div>
      </div>
      <form className={styles.addForm} onSubmit={onSubmit} noValidate>
        {rows.map((row, i) => {
          const at = fieldIndex(row.key)
          // 라벨은 첫 줄 위에만 보인다. 2번 줄부터는 읽는 이름만 "2번 학생 이름"(18명이면 라벨 반복으로 화면이 두 배 — 11/8)
          const bare = i > 0
          const label = (field: string) => (bare ? `${i + 1}번 학생 ${field}` : field)
          return (
            <div
              key={row.key}
              className={bare ? `${styles.studentRow} ${styles.studentRowBare}` : styles.studentRow}
              role="group"
              aria-label={`${i + 1}번 학생`}
            >
              <span className={styles.rowNo} aria-hidden="true">
                {i + 1}
              </span>
              <TextField
                size="teacher"
                label={label('이름')}
                labelHidden={bare}
                value={row.name}
                onChange={(e) => update(row.key, 'name', e.target.value)}
                maxLength={30}
                autoComplete="off"
                error={at >= 0 ? submit.fieldError(`students[${at}].name`) : undefined}
              />
              <TextField
                size="teacher"
                label={label('학교')}
                labelHidden={bare}
                value={row.school}
                onChange={(e) => update(row.key, 'school', e.target.value)}
                maxLength={50}
                autoComplete="off"
              />
              <TextField
                size="teacher"
                label={label('학년')}
                labelHidden={bare}
                value={row.grade}
                onChange={(e) => update(row.key, 'grade', e.target.value)}
                maxLength={10}
                autoComplete="off"
              />
              <div className={styles.rowRemove}>
                <Button
                  variant="secondary"
                  size="teacher"
                  aria-label={`${i + 1}번 줄 지우기`}
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length === 1}
                >
                  지우기
                </Button>
              </div>
            </div>
          )
        })}
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="teacher"
            onClick={addRow}
            disabled={rows.length >= MAX_ROWS}
          >
            줄 추가
          </Button>
        </div>
        {empty && (
          <p className={styles.formError} role="alert">
            학생 이름을 하나 이상 입력
          </p>
        )}
        {generalError && (
          <p className={styles.formError} role="alert">
            {generalError}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit" size="teacher" disabled={submit.pending}>
            {submit.pending ? '등록 중' : filled.length > 0 ? `${filled.length}명 등록` : '등록'}
          </Button>
        </div>
      </form>
    </>
  )
}
