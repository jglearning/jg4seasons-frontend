import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type SubmitEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ApiError } from '../../api/errors'
import { Button } from '../../shared/ui/Button'
import { CodeBoxes } from '../../shared/ui/CodeBoxes'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { TextField } from '../../shared/ui/TextField'
import { loginStudent, verifyJoinCode } from './authApi'
import { JOIN_CODE_LENGTH, normalizeJoinCode, saveJoinCode } from './joinCode'
import { errorMessage } from '../../shared/errorMessage'
import { STUDENT_COPY } from './studentCopy'
import styles from './StudentEntry.module.css'
import { useMountedRef } from './useMountedRef'
import { entryReason } from './entry'
import { readQrJoinHash } from '../../shared/qrJoin'

const PERSONAL_CODE_LENGTH = 4
const JOIN_CODE_HINT = '대소문자 구분 없음 · 0/O, 1/I는 쓰지 않아요'

// S-01 코드로 들어가기: 가입 코드 8자 + 개인 코드 4자리 → 바로 홈(AUTH-01)
export function JoinPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const mounted = useMountedRef()
  const reason = entryReason(location.state)

  // 카드 QR(#38): `/join#c=…&p=…`로 열리면 두 칸을 채운다. 코드는 아래 state에만 두고 주소에서는 바로 지운다.
  // 자동 로그인은 하지 않는다 — 학생이 "들어가기"를 한 번 누른다
  const [joinCode, setJoinCode] = useState(() => readQrJoinHash(location.hash)?.joinCode ?? '')
  // 개인 코드는 이 state에만(요청 직후 비움)
  const [personalCode, setPersonalCode] = useState(
    () => readQrJoinHash(location.hash)?.personalCode ?? '',
  )
  const [fromQr, setFromQr] = useState(() => readQrJoinHash(location.hash) !== undefined)
  const [submitting, setSubmitting] = useState(false)
  const [loginError, setLoginError] = useState<ReactNode>()

  // 반 확인은 표시용(선택) — 실패해도 로그인은 할 수 있다(03 §1.1)
  const verify = useMutation({ mutationFn: verifyJoinCode })

  // 이 화면이 이미 열린 탭에 QR 주소가 다시 들어오면(같은 문서 안 # 이동 — 위 첫 값은 다시 돌지 않음) 그리는 중에 채운다.
  // 주소 이동마다 바뀌는 location.key로 알아챈다(코드가 든 주소를 state에 두지 않는다)
  const [seenKey, setSeenKey] = useState(location.key)
  if (location.key !== seenKey) {
    setSeenKey(location.key)
    const codes = readQrJoinHash(location.hash)
    if (codes !== undefined && !submitting) {
      setJoinCode(codes.joinCode ?? '')
      setPersonalCode(codes.personalCode ?? '')
      setFromQr(true)
      setLoginError(undefined)
    }
  }

  // `#` 뒤에 무엇이 있든(모양이 틀려도) 주소에서 지운다 — 뒤로 가기·주소창·공유에 개인 코드가 남지 않게
  useEffect(() => {
    if (location.hash === '') return
    void navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: location.state },
    )
  }, [location, navigate])

  // QR로 채운 가입 코드도 직접 친 것처럼 반을 확인한다. 같은 코드는 한 번만(개발 모드의 effect 두 번 실행 포함)
  const qrVerified = useRef<string>(undefined)
  useEffect(() => {
    if (!fromQr || joinCode.length !== JOIN_CODE_LENGTH) return
    if (qrVerified.current === joinCode || verify.variables === joinCode) return
    qrVerified.current = joinCode
    verify.mutate(joinCode)
  }, [fromQr, joinCode, verify])

  function clearCodes() {
    if (submitting) return
    setJoinCode('')
    setPersonalCode('')
    setFromQr(false)
    setLoginError(undefined)
  }
  const verified = verify.variables === joinCode ? verify : undefined
  const invalidCode = verified?.error instanceof ApiError && verified.error.code === 'INVALID_CODE'

  function changeJoinCode(raw: string) {
    const next = normalizeJoinCode(raw)
    if (next === joinCode || submitting) return
    setJoinCode(next)
    setLoginError(undefined)
    // 바로 앞에 확인한 코드면 다시 부르지 않는다(verify 레이트 리밋, 03 §0.5)
    if (next.length === JOIN_CODE_LENGTH && verify.variables !== next) verify.mutate(next)
  }

  // 제출 중에는 칸을 disabled로 바꾸지 않고 입력만 무시한다 — disabled가 되면 포커스가 사라져 실패 뒤 바로 다시 칠 수 없다
  function changePersonalCode(next: string) {
    if (submitting) return
    setPersonalCode(next)
    setLoginError(undefined)
  }

  const canSubmit =
    joinCode.length === JOIN_CODE_LENGTH &&
    personalCode.length === PERSONAL_CODE_LENGTH &&
    !invalidCode &&
    !submitting

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    const code = joinCode
    const request = loginStudent(code, personalCode)
    setPersonalCode('')
    setSubmitting(true)
    setLoginError(undefined)
    try {
      await request
    } catch (error) {
      setLoginError(errorMessage(error, STUDENT_COPY))
      setSubmitting(false)
      return
    }
    saveJoinCode(code)
    // 같은 기기를 다른 학생이 쓸 수 있다 — 이전 사용자의 캐시를 남기지 않는다(RejoinPage의 savedClass 키도 이 clear에 기댄다)
    queryClient.clear()
    // 응답을 기다리는 동안 링크로 다른 화면에 갔으면 끌고 오지 않는다
    if (mounted.current) await navigate('/', { replace: true })
  }

  let joinHint: ReactNode = JOIN_CODE_HINT
  let joinError: ReactNode
  if (invalidCode) {
    joinError = '없는 가입 코드예요. 카드의 코드를 다시 확인해 주세요'
  } else if (verified?.data) {
    joinHint = `${verified.data.class.name} · ${verified.data.class.academyName}`
  } else if (verified?.isError) {
    joinHint = '지금은 반을 확인하지 못했어요. 그대로 들어가도 돼요'
  } else if (joinCode === '' && reason === 'savedCodeInvalid') {
    joinError = '이 기기에 저장된 가입 코드를 쓸 수 없어요. 새 코드를 입력해 주세요'
  }

  return (
    <StudentLayout>
      <div className={styles.page}>
        <header>
          <p className={styles.brand}>제이G 4 SEASONS</p>
          <h1 className={styles.title}>
            코드 두 개로
            <br />
            바로 들어가요
          </h1>
          {fromQr && <p className={styles.qrNotice}>카드의 QR로 열었어요</p>}
          <p className={styles.lead}>
            선생님께 받은 카드에 둘 다 적혀 있어요.
            <br />
            처음 한 번만 입력하면 이 기기에서 자동으로 들어가요.
          </p>
          {reason === 'sessionExpired' && joinCode === '' && personalCode === '' && (
            <p className={styles.notice} role="status">
              로그인이 끝났어요. 다시 들어와 주세요.
            </p>
          )}
        </header>

        <form className={styles.form} onSubmit={submit} noValidate>
          <TextField
            code
            label={
              <>
                가입 코드 <span className={styles.labelNote}>· 반 공용 8자리</span>
              </>
            }
            value={joinCode}
            onChange={(event) => changeJoinCode(event.target.value)}
            hint={joinError ? undefined : joinHint}
            error={joinError}
            readOnly={submitting}
          />
          <CodeBoxes
            label={
              <>
                개인 코드 <span className={styles.labelNote}>· 나만의 숫자 4자리</span>
              </>
            }
            value={personalCode}
            onChange={changePersonalCode}
            error={loginError}
            masked={fromQr}
          />
          <Button type="submit" block disabled={!canSubmit}>
            {submitting ? '들어가는 중' : '들어가기'}
          </Button>
          {fromQr && (
            <button type="button" className={styles.textButton} onClick={clearCodes}>
              다른 코드로 들어가기
            </button>
          )}
          <p className={styles.note}>
            코드를 잃어버렸으면 담당 선생님께 물어보세요. 개인 코드는 친구에게 알려 주지 마세요.
          </p>
        </form>

        <p className={styles.footer}>
          선생님이신가요?
          <Link to="/teacher/login" className={styles.link}>
            교사 로그인
          </Link>
        </p>
      </div>
    </StudentLayout>
  )
}
