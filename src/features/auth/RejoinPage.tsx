import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { ApiError } from '../../api/errors'
import { CodeBoxes } from '../../shared/ui/CodeBoxes'
import { Keypad } from '../../shared/ui/Keypad'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { loginStudent, verifyJoinCode } from './authApi'
import { clearJoinCode, readJoinCode } from './joinCode'
import { entryReason, type EntryState } from './entry'
import { errorMessage } from '../../shared/errorMessage'
import { STUDENT_COPY } from './studentCopy'
import styles from './StudentEntry.module.css'
import { useMountedRef } from './useMountedRef'

const PERSONAL_CODE_LENGTH = 4

// S-02 다시 들어오기: 기기에 저장된 반 + 개인 코드 4자리(AUTH-02). 4자리가 차면 바로 로그인한다
export function RejoinPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const mounted = useMountedRef()
  const [savedCode] = useState(readJoinCode)
  const [personalCode, setPersonalCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loginError, setLoginError] = useState<ReactNode>()

  // 반 이름은 저장하지 않고 매번 서버에서 받는다. 키에 코드를 넣지 않는다 —
  // 기기에 저장되는 코드는 하나이고, 로그인에 성공하면 캐시를 비우므로 다른 코드의 결과가 남지 않는다
  const savedClass = useQuery({
    queryKey: ['auth', 'savedClass'],
    queryFn: () => verifyJoinCode(savedCode!),
    enabled: savedCode !== undefined,
    staleTime: Infinity,
  })
  const savedCodeInvalid =
    savedClass.error instanceof ApiError && savedClass.error.code === 'INVALID_CODE'

  useEffect(() => {
    if (!savedCodeInvalid) return
    // 반이 없어졌거나 가입 코드가 재발급됐다 → 저장값을 지우고 S-01에서 새 코드를 받는다
    clearJoinCode()
    const state: EntryState = { reason: 'savedCodeInvalid' }
    void navigate('/join', { replace: true, state })
  }, [savedCodeInvalid, navigate])

  if (savedCode === undefined) return <Navigate to="/join" replace />

  async function submit(code: string, personal: string) {
    const request = loginStudent(code, personal)
    setSubmitting(true)
    setLoginError(undefined)
    try {
      await request
    } catch (error) {
      setLoginError(errorMessage(error, STUDENT_COPY))
      setSubmitting(false)
      return
    }
    queryClient.clear()
    if (mounted.current) await navigate('/', { replace: true })
  }

  // 제출 중 입력은 무시한다(칸을 disabled로 바꾸면 포커스가 사라진다 — JoinPage와 같은 이유)
  function changePersonalCode(next: string) {
    if (submitting || savedCode === undefined) return
    setLoginError(undefined)
    if (next.length < PERSONAL_CODE_LENGTH) {
      setPersonalCode(next)
      return
    }
    // 개인 코드는 이 state에만(요청 직후 비움)
    setPersonalCode('')
    void submit(savedCode, next.slice(0, PERSONAL_CODE_LENGTH))
  }

  let savedName: ReactNode
  if (savedClass.data) {
    savedName = (
      <p className={styles.savedName}>
        {savedClass.data.class.name} · {savedClass.data.class.academyName}
      </p>
    )
  } else {
    savedName = (
      <p className={styles.savedName} data-muted="">
        {savedClass.isError ? '반 정보를 불러오지 못했어요' : '반을 확인하는 중'}
      </p>
    )
  }

  return (
    <StudentLayout>
      <div className={styles.page}>
        <header>
          <p className={styles.brand}>제이G 4 SEASONS</p>
          <h1 className={styles.title}>
            개인 코드만
            <br />
            입력해요
          </h1>
          {entryReason(location.state) === 'sessionExpired' &&
            personalCode === '' &&
            loginError === undefined && (
              <p className={styles.notice} role="status">
                로그인이 끝났어요. 다시 들어와 주세요.
              </p>
            )}
        </header>

        <section className={styles.saved} aria-label="이 기기에 저장된 반">
          <div>
            <p className={styles.savedLabel}>이 기기에 저장된 반</p>
            {savedName}
          </div>
          <Link to="/join" className={styles.link}>
            다른 반
          </Link>
        </section>

        <div className={styles.form}>
          <CodeBoxes
            label="개인 코드"
            value={personalCode}
            onChange={changePersonalCode}
            error={loginError}
            inputMode="none"
            showNext
            autoFocus
          />
          <Keypad
            disabled={submitting}
            onDigit={(digit) => changePersonalCode(personalCode + digit)}
            onDelete={() => changePersonalCode(personalCode.slice(0, -1))}
            onClear={() => changePersonalCode('')}
          />
          <p className={styles.note}>보통은 이 화면 없이 바로 홈으로 가요.</p>
        </div>
      </div>
    </StudentLayout>
  )
}
