import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../../shared/ui/Button'
import { CheckboxGroup } from '../../shared/ui/CheckboxGroup'
import { SelectField } from '../../shared/ui/SelectField'
import { TextField } from '../../shared/ui/TextField'
import { StaffLoadState } from '../../shared/ui/StaffLoadState'
import {
  classesQuery,
  teachersQuery,
  updateTeacher,
  type AdminTeacher,
  type TeacherUpdate,
} from './adminApi'
import { koreaDateTime, roleLabel } from './format'
import { useSubmit } from '../../shared/useSubmit'
import { ADMIN_COPY } from './adminCopy'
import styles from './Admin.module.css'

// A-03 교사 수정(PATCH /admin/teachers/{id}): 이름·담당 반·상태·비밀번호 재설정. 바뀐 칸만 보낸다.
// 교사 한 명을 받는 API가 없어 목록에서 찾는다
const STATUS_OPTIONS = [
  { value: 'active', label: '활성' },
  { value: 'inactive', label: '비활성(로그인 불가)' },
]
const FIELDS = ['name', 'classIds', 'status', 'password']

export function TeacherDetailPage() {
  const id = Number(useParams().id)
  const teachers = useQuery(teachersQuery)
  const teacher = teachers.data?.items.find((t) => t.id === id)

  return (
    <>
      <Link to="/admin/teachers" className={styles.back}>
        ← 교사 관리
      </Link>
      {teacher ? (
        // 다른 교사로 옮기면 폼을 새로(지역 state 초기값)
        <TeacherForm key={teacher.id} teacher={teacher} />
      ) : teachers.data ? (
        <p className={styles.notice} role="alert">
          교사를 찾을 수 없습니다
        </p>
      ) : (
        <StaffLoadState query={teachers} />
      )}
    </>
  )
}

function TeacherForm({ teacher }: { teacher: AdminTeacher }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const classes = useQuery(classesQuery)
  const [name, setName] = useState(teacher.name)
  const [classIds, setClassIds] = useState<number[]>(teacher.classIds)
  const [status, setStatus] = useState(teacher.status)
  const [password, setPassword] = useState('')
  const submit = useSubmit(ADMIN_COPY)

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault()
    const body: TeacherUpdate = {}
    if (name.trim() !== teacher.name) body.name = name.trim()
    if (!sameIds(classIds, teacher.classIds)) body.classIds = [...classIds].sort((a, b) => a - b)
    if (status !== teacher.status) body.status = status
    if (password !== '') body.password = password
    if (Object.keys(body).length === 0) {
      navigate('/admin/teachers')
      return
    }
    const updated = await submit.run(() => updateTeacher(teacher.id, body))
    setPassword('')
    if (updated === undefined) return
    void queryClient.invalidateQueries({ queryKey: ['admin'] })
    navigate('/admin/teachers')
  }

  const generalError = submit.formError(FIELDS, ['SELF_CHANGE_NOT_ALLOWED'])

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{teacher.name}</h1>
          <p className={styles.sub}>
            {teacher.loginId ?? '아이디 없음'} · {roleLabel(teacher.role)} · 마지막 로그인{' '}
            {teacher.lastLoginAt ? koreaDateTime(teacher.lastLoginAt) : '없음'}
          </p>
        </div>
      </div>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <TextField
          size="teacher"
          label="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          required
          error={submit.fieldError('name')}
        />
        <CheckboxGroup
          legend="담당 반"
          options={(classes.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
          selected={classIds}
          onChange={setClassIds}
          empty={classes.data ? '만든 반이 없습니다' : '반 목록 불러오는 중'}
          error={submit.fieldError('classIds')}
        />
        <SelectField
          label="상태"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => setStatus(e.target.value as AdminTeacher['status'])}
          error={submit.fieldError('status', ['SELF_CHANGE_NOT_ALLOWED'])}
        />
        <TextField
          size="teacher"
          type="password"
          label="새 비밀번호"
          hint="바꿀 때만 입력(8자 이상). 바꾸면 그 교사는 다시 로그인"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          error={submit.fieldError('password')}
        />
        {generalError && (
          <p className={styles.formError} role="alert">
            {generalError}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit" size="teacher" disabled={submit.pending}>
            {submit.pending ? '저장 중' : '저장'}
          </Button>
        </div>
      </form>
    </>
  )
}

function sameIds(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id))
}
