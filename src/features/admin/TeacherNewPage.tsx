import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '../../shared/ui/Button'
import { CheckboxGroup } from '../../shared/ui/CheckboxGroup'
import { SelectField } from '../../shared/ui/SelectField'
import { TextField } from '../../shared/ui/TextField'
import { classesQuery, createTeacher, type TeacherCreate } from './adminApi'
import { useSubmit } from './useSubmit'
import styles from './Admin.module.css'

// A-03 교사 추가(ADM-04, POST /admin/teachers). 비밀번호는 이 화면의 지역 state에만 두고 보낸 뒤 비운다
const ROLE_OPTIONS = [
  { value: 'teacher', label: '교사' },
  { value: 'admin', label: '관리자' },
]

export function TeacherNewPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const classes = useQuery(classesQuery)
  const [name, setName] = useState('')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<TeacherCreate['role']>('teacher')
  const [classIds, setClassIds] = useState<number[]>([])
  const submit = useSubmit()

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault()
    const created = await submit.run(() =>
      createTeacher({ name: name.trim(), loginId: loginId.trim(), password, role, classIds }),
    )
    setPassword('')
    if (created === undefined) return
    // 담당 반을 바꿨으니 반 목록(담당 교사)도 다시
    void queryClient.invalidateQueries({ queryKey: ['admin'] })
    navigate('/admin/teachers')
  }

  const FIELDS = ['name', 'loginId', 'password', 'classIds']
  const generalError = submit.formError(FIELDS, ['LOGIN_ID_TAKEN'])

  return (
    <>
      <Link to="/admin/teachers" className={styles.back}>
        ← 교사 관리
      </Link>
      <div className={styles.head}>
        <h1 className={styles.title}>교사 추가</h1>
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
        <TextField
          size="teacher"
          label="아이디"
          hint="영문·숫자·. _ - 3~30자"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={30}
          required
          error={submit.fieldError('loginId', ['LOGIN_ID_TAKEN'])}
        />
        <TextField
          size="teacher"
          type="password"
          label="비밀번호"
          hint="8자 이상"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          error={submit.fieldError('password')}
        />
        <SelectField
          label="역할"
          options={ROLE_OPTIONS}
          value={role}
          onChange={(e) => setRole(e.target.value as TeacherCreate['role'])}
        />
        <CheckboxGroup
          legend="담당 반"
          options={(classes.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
          selected={classIds}
          onChange={setClassIds}
          empty={classes.data ? '만든 반이 없습니다' : '반 목록 불러오는 중'}
          error={submit.fieldError('classIds')}
        />
        {generalError && (
          <p className={styles.formError} role="alert">
            {generalError}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit" size="teacher" disabled={submit.pending}>
            {submit.pending ? '추가 중' : '추가'}
          </Button>
        </div>
      </form>
    </>
  )
}
