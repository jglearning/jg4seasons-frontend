import { useQueryClient } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ApiError } from '../../api/errors'
import { errorMessage, NETWORK_MESSAGE, type Copy } from '../../shared/errorMessage'
import { levelEnglish } from '../../shared/level'
import { readQrJoinHash } from '../../shared/qrJoin'
import { Button } from '../../shared/ui/Button'
import { CodeBoxes } from '../../shared/ui/CodeBoxes'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { isTimeout, loginStudent, verifyJoinCode } from './authApi'
import { entryReason } from './entry'
import { JOIN_CODE_LENGTH, clearJoinCode, readJoinCode, saveJoinCode } from './joinCode'
import { STUDENT_COPY } from './studentCopy'
import { useMountedRef } from './useMountedRef'
import { useVisualViewport } from './useVisualViewport'
import styles from './EntryPage.module.css'

// 들어가기(S-01·S-02를 화면 하나로, 지시문 §6.1 + 11/13 동섭 답). 한 번에 하나, 설명 글 없음.
//   ① join  가입 코드 8칸. 8자리가 차면 반을 확인(POST /auth/code/verify)
//   ② pin   반 카드 + 개인 코드 4칸. 4자리가 차면 바로 로그인(카드 QR로 채워졌을 때만 "들어가기" 버튼 — BE ADR 0033)
// 반 확인 결과: 맞음 → 반 카드(레벨 색) / 404 INVALID_CODE → ③ "없는 코드" / 429·네트워크·5xx → 회색 카드로 ②(로그인은 된다).
// 같은 코드로는 확인을 다시 부르지 않는다(IP당 1분 10회 한도 — 교실 공인 IP 하나에서 여럿이 들어온다).
// 시작: 주소에 QR 가입 코드 → ②, 기기에 저장된 가입 코드 → ②(다시 들어오기), 그 밖 → ①.
// 아이폰은 사용자 동작 밖의 focus()로 키보드를 띄우지 않는다 → 8번째 글자 입력 이벤트 안에서 개인 코드 입력으로 포커스를 옮긴다.
// 그래서 두 입력은 늘 DOM에 있고, 지금 단계가 아닌 쪽은 화면 밖(투명·탭 정지 없음)에 둔다. ②가 나타나기 전 숫자는 받지 않는다.
// 개인 코드는 이 화면의 지역 state에만 두고 로그인 요청 직후 비운다

type ClassInfo = Awaited<ReturnType<typeof verifyJoinCode>>['class']
type ClassResult =
  { status: 'ok'; klass: ClassInfo } | { status: 'unknown' } | { status: 'invalid' }
type Stage = 'join' | 'pin'
type Message = { tone: 'error' | 'muted'; text: ReactNode }

const PIN_LENGTH = 4
const SLOW_CHECK_MS = 1000
const LEAVE_MS = 160

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

const NOT_FOUND = '없는 코드예요. 선생님께 물어봐요'
const SAVED_INVALID = '저장된 코드를 쓸 수 없어요. 다시 입력해요'
const WRONG_PIN = '개인 코드가 달라요. 다시 눌러요'
const CLASS_UNKNOWN = '지금은 반을 확인하지 못했어요. 그대로 들어가도 돼요'
const SESSION_EXPIRED = '로그인이 끝났어요. 다시 들어와 주세요.'
const CHECKING = '확인하는 중'

type Start = { stage: Stage; joinCode: string; pin: string; cardPin: boolean; fromSaved: boolean }

function startFrom(hash: string): Start {
  const qr = readQrJoinHash(hash)
  if (qr?.joinCode !== undefined) {
    const pin = qr.personalCode ?? ''
    return { stage: 'pin', joinCode: qr.joinCode, pin, cardPin: pin !== '', fromSaved: false }
  }
  const saved = readJoinCode()
  if (saved !== undefined) {
    return { stage: 'pin', joinCode: saved, pin: '', cardPin: false, fromSaved: true }
  }
  return { stage: 'join', joinCode: '', pin: '', cardPin: false, fromSaved: false }
}

export function EntryPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const mounted = useMountedRef()
  const viewport = useVisualViewport()

  // 시작값은 state마다 따로 꺼내고 객체는 버린다 — 카드 QR의 개인 코드가 pin state 밖(시작값 객체)에 남지 않게
  const [stage, setStage] = useState<Stage>(() => startFrom(location.hash).stage)
  const [joinCode, setJoinCode] = useState(() => startFrom(location.hash).joinCode)
  const [pin, setPin] = useState(() => startFrom(location.hash).pin)
  const [cardPin, setCardPin] = useState(() => startFrom(location.hash).cardPin)
  // 저장된 코드로 시작한 ②에서 그 코드가 무효면 ①로 보내며 안내
  const [fromSaved, setFromSaved] = useState(() => startFrom(location.hash).fromSaved)
  // 직접 친 8번째 글자 — 그 코드의 확인이 끝나면 ②로 넘어간다
  const [advanceFor, setAdvanceFor] = useState<string>()
  const [results, setResults] = useState<Record<string, ClassResult>>({})
  const [joinMessage, setJoinMessage] = useState<Message>()
  const [pinError, setPinError] = useState<ReactNode>()
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState(false)
  const [slowFor, setSlowFor] = useState<string>()
  // 단계가 사용자 동작으로 바뀐 뒤에만 움직인다(처음 열 때는 움직이지 않음)
  const [moved, setMoved] = useState(false)
  // ① 묶음이 사라지는 중(①→② 앞 160ms)
  const [leaving, setLeaving] = useState(false)
  // 로고 파일이 없으면(원장님 확인 전 — 파일을 아직 넣지 않음) 아무것도 보이지 않게
  const [logo, setLogo] = useState<'loading' | 'shown' | 'missing'>('loading')

  const joinRef = useRef<HTMLInputElement>(null)
  const pinRef = useRef<HTMLInputElement>(null)
  const inflight = useRef(new Set<string>())
  const sending = useRef(false)

  const complete = joinCode.length === JOIN_CODE_LENGTH
  const result = complete ? results[joinCode] : undefined

  // 이 화면이 이미 열린 탭에 QR 주소가 다시 들어오면(같은 문서 안 # 이동) 그리는 중에 처음부터 다시 시작한다
  const [seenKey, setSeenKey] = useState(location.key)
  if (location.key !== seenKey) {
    setSeenKey(location.key)
    const qr = readQrJoinHash(location.hash)
    if (qr?.joinCode !== undefined && !submitting) {
      const next = startFrom(location.hash)
      setStage(next.stage)
      setJoinCode(next.joinCode)
      setPin(next.pin)
      setCardPin(next.cardPin)
      setFromSaved(false)
      setAdvanceFor(undefined)
      setJoinMessage(undefined)
      setPinError(undefined)
    }
  }

  // 확인 결과에 따라 단계를 옮긴다(그리는 중에 — 결과가 바뀐 그 렌더에서 바로).
  // ①→②는 먼저 "가입 코드" 이름표와 8칸이 8px 올라가며 사라지고(160ms) 그다음 ②가 나타난다. 움직임 줄이기면 바로
  if (stage === 'join' && advanceFor === joinCode && result && result.status !== 'invalid') {
    setAdvanceFor(undefined)
    setMoved(true)
    if (prefersReducedMotion()) setStage('pin')
    else setLeaving(true)
  }
  if (stage === 'pin' && result?.status === 'invalid') {
    setStage('join')
    setPin('')
    setCardPin(false)
    if (fromSaved) {
      setJoinCode('')
      setJoinMessage({ tone: 'error', text: SAVED_INVALID })
      setFromSaved(false)
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

  // 8자리 코드는 한 번만 확인한다(결과는 이 화면에 남겨 "바꾸기" 뒤 같은 코드를 다시 쳐도 부르지 않는다)
  useEffect(() => {
    if (!complete || results[joinCode] !== undefined || inflight.current.has(joinCode)) return
    const code = joinCode
    inflight.current.add(code)
    verifyJoinCode(code)
      .then(
        (data) => ({ status: 'ok', klass: data.class }) as const,
        (error: unknown) => {
          if (error instanceof ApiError && error.code === 'INVALID_CODE') {
            // 반이 없어졌거나 가입 코드가 재발급됐다 → 기기의 저장값이면 지운다
            if (readJoinCode() === code) clearJoinCode()
            return { status: 'invalid' } as const
          }
          // 화면은 회색 카드로 넘어가지만, 배포 설정 실수(HTML 200·5xx·없는 라우트)가 묻히지 않게 남긴다. 가입 코드 값은 남기지 않는다
          if (error instanceof ApiError) {
            console.error('[api] verify', {
              status: error.status,
              code: error.code,
              requestId: error.requestId,
            })
          } else {
            console.error('[api] verify', error)
          }
          return { status: 'unknown' } as const
        },
      )
      .then((next: ClassResult) => {
        inflight.current.delete(code)
        if (mounted.current) setResults((prev) => ({ ...prev, [code]: next }))
      })
  }, [complete, joinCode, results, mounted])

  // ① 묶음이 다 사라지면 ②로
  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => {
      setLeaving(false)
      setStage('pin')
    }, LEAVE_MS)
    return () => clearTimeout(timer)
  }, [leaving])

  // 확인이 1초를 넘으면 "확인하는 중"(①의 오류 줄, 다시 들어오기·QR로 ②에서 시작했으면 이름표 아래).
  // 10초가 넘으면 요청을 끊고 회색 카드로 넘어간다(authApi ENTRY_TIMEOUT_MS)
  const checking = complete && result === undefined
  useEffect(() => {
    if (!checking) return
    const code = joinCode
    const timer = setTimeout(() => setSlowFor(code), SLOW_CHECK_MS)
    return () => clearTimeout(timer)
  }, [checking, joinCode])

  // 포커스: 없는 코드면 가입 코드로 되돌리고, ②가 사용자 동작 없이 나타났으면(다시 들어오기·QR) 개인 코드로
  const pinReady = stage === 'pin' && result !== undefined && result.status !== 'invalid'
  useEffect(() => {
    if (stage === 'join' && result?.status === 'invalid') joinRef.current?.focus()
  }, [stage, result])
  useEffect(() => {
    if (pinReady && document.activeElement !== pinRef.current) pinRef.current?.focus()
  }, [pinReady])

  function changeJoinCode(next: string) {
    if (submitting || stage !== 'join' || leaving || next === joinCode) return
    setTouched(true)
    setJoinCode(next)
    setJoinMessage(undefined)
    if (next.length !== JOIN_CODE_LENGTH) {
      setAdvanceFor(undefined)
      return
    }
    setAdvanceFor(next)
    // 아이폰 숫자 키보드: 이 입력 이벤트 안에서 옮겨야 키보드가 바뀐다. 없는 코드로 이미 아는 값이면 옮기지 않는다
    if (results[next]?.status !== 'invalid') pinRef.current?.focus()
  }

  function changePin(next: string) {
    if (submitting || !pinReady) return
    setTouched(true)
    setPinError(undefined)
    if (cardPin || next.length < PIN_LENGTH) {
      setPin(next)
      return
    }
    void submit(next)
  }

  async function submit(personal: string) {
    // 같은 렌더 안의 두 번째 누름(버튼 두 번 누르기)도 막는다 — state는 다음 렌더에야 바뀐다
    if (sending.current || personal.length !== PIN_LENGTH) return
    sending.current = true
    const code = joinCode
    const request = loginStudent(code, personal)
    // 개인 코드는 요청 직후 비운다
    setPin('')
    setCardPin(false)
    setSubmitting(true)
    try {
      await request
    } catch (error) {
      sending.current = false
      setPinError(isTimeout(error) ? NETWORK_MESSAGE : errorMessage(error, loginCopy(result)))
      setSubmitting(false)
      // 카드 QR "들어가기"를 누른 경우 버튼이 사라져 포커스를 잃는다 — 이제 직접 칠 개인 코드 입력으로
      pinRef.current?.focus()
      return
    }
    saveJoinCode(code)
    // 같은 기기를 다른 학생이 쓸 수 있다 — 이전 사용자의 캐시를 남기지 않는다
    queryClient.clear()
    // 응답을 기다리는 동안 링크로 다른 화면에 갔으면 끌고 오지 않는다
    if (mounted.current) await navigate('/', { replace: true })
  }

  // "바꾸기": ①로. 기기에 저장된 가입 코드는 지우지 않는다(새 코드로 로그인에 성공하면 그때 바뀐다)
  function changeClass() {
    if (submitting) return
    setStage('join')
    setJoinCode('')
    setPin('')
    setCardPin(false)
    setFromSaved(false)
    setAdvanceFor(undefined)
    setJoinMessage(undefined)
    setPinError(undefined)
    setMoved(true)
    joinRef.current?.focus()
  }

  const sessionNotice: Message | undefined =
    entryReason(location.state) === 'sessionExpired' && !touched
      ? { tone: 'muted', text: SESSION_EXPIRED }
      : undefined

  const slow = checking && slowFor === joinCode
  let joinLine: Message | undefined = joinMessage ?? sessionNotice
  if (stage === 'join' && result?.status === 'invalid')
    joinLine = { tone: 'error', text: NOT_FOUND }
  else if (stage === 'join' && slow) joinLine = { tone: 'muted', text: CHECKING }

  let pinLine: Message | undefined
  if (pinError !== undefined) pinLine = { tone: 'error', text: pinError }
  else if (submitting) pinLine = { tone: 'muted', text: '들어가는 중' }
  else if (result?.status === 'unknown') pinLine = { tone: 'muted', text: CLASS_UNKNOWN }
  else pinLine = sessionNotice

  const klass = stage === 'pin' && result?.status === 'ok' ? result.klass : undefined
  const pinHidden = !pinReady

  return (
    <StudentLayout levelCode={klass?.level.code}>
      <div
        className={styles.screen}
        style={{ top: viewport.top, height: viewport.height }}
        data-stage={stage}
        data-moved={moved ? '' : undefined}
      >
        {logo !== 'missing' && (
          <img
            className={styles.symbol}
            src="/brand/jg-symbol.svg"
            alt="제이G"
            height={34}
            data-loaded={logo === 'shown' ? '' : undefined}
            onLoad={() => setLogo('shown')}
            onError={() => setLogo('missing')}
          />
        )}
        {stage === 'join' && (
          <Link to="/teacher/login" className={styles.teacher}>
            교사
          </Link>
        )}

        <div className={styles.center}>
          <div className={styles.brand}>
            <span className={styles.dots} aria-hidden="true">
              {(['mint', 'green', 'blue', 'navy', 'black'] as const).map((name) => (
                <span key={name} className={styles.dot} data-color={name} />
              ))}
            </span>
            <h1 className={styles.title}>4 Seasons</h1>
          </div>
          {stage === 'pin' && !pinReady && (
            <MessageLine
              id="wait-line"
              message={slow ? { tone: 'muted', text: CHECKING } : undefined}
            />
          )}

          <section
            className={[styles.step, stage !== 'join' && styles.offstage, leaving && styles.leaving]
              .filter(Boolean)
              .join(' ')}
            aria-hidden={stage === 'join' ? undefined : true}
            data-step="join"
          >
            <CodeBoxes
              kind="join"
              label="가입 코드"
              ariaLabel="가입 코드 8자리"
              value={joinCode}
              onChange={changeJoinCode}
              invalid={stage === 'join' && joinLine?.tone === 'error'}
              describedBy="join-line"
              inputRef={joinRef}
              inactive={stage !== 'join'}
            />
            <MessageLine id="join-line" message={stage === 'join' ? joinLine : undefined} />
          </section>

          <section
            className={pinHidden ? `${styles.step} ${styles.offstage}` : styles.step}
            aria-hidden={pinHidden ? true : undefined}
            data-step="pin"
          >
            {stage === 'pin' && result?.status === 'ok' && (
              <ClassCard klass={result.klass} onChange={changeClass} />
            )}
            {stage === 'pin' && result?.status === 'unknown' && (
              <CodeCard code={joinCode} onChange={changeClass} />
            )}
            <div className={styles.pinField}>
              <CodeBoxes
                kind="pin"
                label="개인 코드"
                ariaLabel="개인 코드 숫자 4자리"
                value={pin}
                onChange={changePin}
                invalid={pinLine?.tone === 'error'}
                describedBy="pin-line"
                inputRef={pinRef}
                inactive={pinHidden}
              />
              <MessageLine id="pin-line" message={pinHidden ? undefined : pinLine} />
            </div>
            {cardPin && pinReady && (
              <Button
                block
                className={styles.enter}
                disabled={pin.length !== PIN_LENGTH}
                onClick={() => void submit(pin)}
              >
                들어가기
              </Button>
            )}
          </section>
        </div>
      </div>
    </StudentLayout>
  )
}

/** 로그인 실패 문구 — 반을 확인했으면 틀린 쪽은 개인 코드뿐이다(서버는 어느 쪽인지 알려 주지 않는다) */
function loginCopy(result: ClassResult | undefined): Copy {
  if (result?.status !== 'ok') return STUDENT_COPY
  return { ...STUDENT_COPY, codes: { ...STUDENT_COPY.codes, INVALID_CREDENTIALS: WRONG_PIN } }
}

/**
 * 오류·안내 한 줄. 내용이 없어도 자리를 비워 둔다(오류가 뜰 때 내용이 튀지 않게).
 * alert 영역과 status 영역을 따로 늘 두고 글만 바꾼다 — 한 영역의 role이 내용과 같은 순간에 바뀌면 낭독기가 놓칠 수 있다
 */
function MessageLine({ id, message }: { id: string; message: Message | undefined }) {
  const error = message?.tone === 'error'
  return (
    <div id={id} className={styles.line}>
      <p className={styles.lineError} role="alert">
        {error && (
          <>
            <CircleAlert size={18} strokeWidth={2.4} className={styles.lineIcon} aria-hidden />
            {message.text}
          </>
        )}
      </p>
      <p className={styles.lineMuted} role="status">
        {message?.tone === 'muted' && message.text}
      </p>
    </div>
  )
}

/** 반 카드 — --L 면 + --L-on 글자, 크림 동그라미에 레벨 이름 첫 글자 */
function ClassCard({ klass, onChange }: { klass: ClassInfo; onChange: () => void }) {
  const english = levelEnglish(klass.level.code)
  const name = [english, klass.level.nameKo].filter(Boolean).join(' ')
  return (
    <div className={styles.card}>
      <span className={styles.cardMark} aria-hidden="true">
        {(english ?? klass.level.nameKo).slice(0, 1)}
      </span>
      <span className={styles.cardText}>
        <span className={styles.cardName}>{name}</span>{' '}
        <span className={styles.cardClass} title={klass.name}>
          {klass.name}
        </span>
      </span>
      <ChangeButton onChange={onChange} />
    </div>
  )
}

/** 반을 확인하지 못했을 때(429·네트워크·5xx) — 회색 카드에 입력한 가입 코드. 크기는 반 카드와 같게 */
function CodeCard({ code, onChange }: { code: string; onChange: () => void }) {
  return (
    <div className={`${styles.card} ${styles.codeCard}`}>
      <span className={styles.cardText}>
        <span className={`${styles.cardName} ${styles.cardCode}`}>
          {code.slice(0, 4)} {code.slice(4)}
        </span>{' '}
        <span className={styles.cardClass}>가입 코드</span>
      </span>
      <ChangeButton onChange={onChange} />
    </div>
  )
}

/** "바꾸기" 알약(높이 32) — 누르는 자리는 44 */
function ChangeButton({ onChange }: { onChange: () => void }) {
  return (
    <button
      type="button"
      className={styles.change}
      onClick={onChange}
      aria-label="다른 반 코드로 바꾸기"
    >
      <span className={styles.pill}>바꾸기</span>
    </button>
  )
}
