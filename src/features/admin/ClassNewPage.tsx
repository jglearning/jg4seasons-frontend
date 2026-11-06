import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '../../shared/ui/Button'
import { CheckboxGroup } from '../../shared/ui/CheckboxGroup'
import { SelectField } from '../../shared/ui/SelectField'
import { TextField } from '../../shared/ui/TextField'
import { createClass, teachersQuery } from './adminApi'
import { BOOK_OPTIONS, WEEKDAY_OPTIONS } from './format'
import { useSubmit } from './useSubmit'
import styles from './Admin.module.css'

// A-01 반 만들기(ADM-01, POST /admin/classes). 서버가 24회차 진도표와 가입 코드를 만든다.
// 권·개강일·요일은 만든 뒤 바꿀 수 없다(새 반으로) — 화면에 미리 알린다
const FIELDS = ['name', 'bookCode', 'startDate', 'weekdays', 'teacherIds']

export function ClassNewPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const teachers = useQuery(teachersQuery)
  const [name, setName] = useState('')
  const [bookCode, setBookCode] = useState('')
  const [startDate, setStartDate] = useState('')
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [teacherIds, setTeacherIds] = useState<number[]>([])
  const submit = useSubmit()

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault()
    const created = await submit.run(() =>
      createClass({
        name: name.trim(),
        bookCode,
        startDate,
        weekdays: [...weekdays].sort((a, b) => a - b),
        teacherIds: [...teacherIds].sort((a, b) => a - b),
      }),
    )
    if (created === undefined) return
    void queryClient.invalidateQueries({ queryKey: ['admin'] })
    // 만든 반의 가입 코드를 바로 보여 준다
    navigate(`/admin/classes/${created.id}`)
  }

  // 새로 넣을 수 있는 교사는 활성 교사·관리자만(서버 규칙)
  const teacherOptions = (teachers.data?.items ?? [])
    .filter((t) => t.status === 'active')
    .map((t) => ({ value: t.id, label: t.name }))
  const generalError = submit.formError(FIELDS)

  return (
    <>
      <Link to="/admin/classes" className={styles.back}>
        ← 반 관리
      </Link>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>반 만들기</h1>
          <p className={styles.sub}>권·개강일·수업 요일은 만든 뒤 바꿀 수 없음</p>
        </div>
      </div>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <TextField
          size="teacher"
          label="반 이름"
          placeholder="겨울 그린 A반"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          required
          error={submit.fieldError('name')}
        />
        <SelectField
          label="권"
          options={[{ value: '', label: '고르기' }, ...BOOK_OPTIONS]}
          value={bookCode}
          onChange={(e) => setBookCode(e.target.value)}
          required
          error={submit.fieldError('bookCode')}
        />
        <TextField
          size="teacher"
          type="date"
          label="개강일"
          hint="이날이 수업 요일이면 1회차"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
          error={submit.fieldError('startDate')}
        />
        <CheckboxGroup
          legend="수업 요일"
          options={WEEKDAY_OPTIONS}
          selected={weekdays}
          onChange={setWeekdays}
          error={submit.fieldError('weekdays')}
        />
        <CheckboxGroup
          legend="담당 교사"
          options={teacherOptions}
          selected={teacherIds}
          onChange={setTeacherIds}
          empty={teachers.data ? '활성 교사가 없습니다' : '교사 목록 불러오는 중'}
          error={submit.fieldError('teacherIds')}
        />
        {generalError && (
          <p className={styles.formError} role="alert">
            {generalError}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit" size="teacher" disabled={submit.pending}>
            {submit.pending ? '만드는 중' : '만들기'}
          </Button>
        </div>
      </form>
    </>
  )
}
