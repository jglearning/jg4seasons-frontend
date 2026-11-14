import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type ReactNode, type SubmitEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Button } from '../../shared/ui/Button'
import { TextField } from '../../shared/ui/TextField'
import { loginStaff } from './authApi'
import { errorMessage } from '../../shared/errorMessage'
import { STAFF_COPY } from './staffCopy'
import styles from './TeacherLoginPage.module.css'
import { useMountedRef } from './useMountedRef'
import { entryReason } from './entry'
import { homePathFor } from '../../shared/roleHome'

// T-01 교사·관리자·운영자 로그인(AUTH-04). 비밀번호는 이 화면 state에만 두고, 실패하면 비운다
export function TeacherLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const mounted = useMountedRef()
  const passwordRef = useRef<HTMLInputElement>(null)
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loginError, setLoginError] = useState<ReactNode>()

  const canSubmit = loginId.trim() !== '' && password !== '' && !submitting

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    const request = loginStaff(loginId.trim(), password)
    setSubmitting(true)
    setLoginError(undefined)
    let role: Awaited<typeof request>['user']['role']
    try {
      role = (await request).user.role
    } catch (error) {
      setPassword('')
      setLoginError(errorMessage(error, STAFF_COPY))
      setSubmitting(false)
      // 로그인 버튼을 눌렀다면 버튼이 disabled가 되며 포커스를 잃었다 — 바로 다시 칠 수 있게
      passwordRef.current?.focus()
      return
    }
    queryClient.clear()
    // 운영자(superadmin, 학원 없음)는 학원 화면 API가 모두 403 — 운영자 화면(O-01)으로(BE #48)
    if (mounted.current) await navigate(homePathFor(role), { replace: true })
  }

  // 제출 중 칸은 disabled 대신 readOnly — 포커스를 잃지 않는다
  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <header>
          <p className={styles.brand}>제이G 4 SEASONS</p>
          <h1 className={styles.title}>교사 로그인</h1>
          {entryReason(location.state) === 'sessionExpired' &&
            loginId === '' &&
            password === '' &&
            loginError === undefined && (
              <p className={styles.notice} role="status">
                로그인 시간이 지났습니다. 다시 로그인해 주세요.
              </p>
            )}
        </header>
        <form className={styles.form} onSubmit={submit} noValidate>
          <TextField
            size="teacher"
            label="아이디"
            value={loginId}
            onChange={(event) => {
              setLoginId(event.target.value)
              setLoginError(undefined)
            }}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            readOnly={submitting}
            autoFocus
          />
          <TextField
            ref={passwordRef}
            size="teacher"
            type="password"
            label="비밀번호"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setLoginError(undefined)
            }}
            autoComplete="current-password"
            error={loginError}
            readOnly={submitting}
          />
          <Button type="submit" size="teacher" block disabled={!canSubmit}>
            {submitting ? '로그인 중' : '로그인'}
          </Button>
        </form>
        <p className={styles.footer}>
          학생은{' '}
          <Link to="/join" className={styles.link}>
            코드로 들어가기
          </Link>
        </p>
      </div>
    </main>
  )
}
