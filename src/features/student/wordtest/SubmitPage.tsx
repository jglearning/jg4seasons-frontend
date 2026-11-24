import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ScanText, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { ApiError, isPermanentError } from '../../../api/errors'
import { lessonLevelCode } from '../../../shared/lessonLabel'
import {
  loadStateOf,
  RETRY_STATUS,
  useServerErrorLog,
  WAIT_ICON,
  type LoadQuery,
} from '../../../shared/loadState'
import { Button, ButtonLink } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'
import { NumberCircle } from '../../../shared/ui/NumberCircle'
import { StatusPanel } from '../../../shared/ui/StatusPanel'
import { StudentLayout } from '../../../shared/ui/StudentLayout'
import { resizeImage } from './resizeImage'
import { ResultView } from './ResultView'
import {
  isSettled,
  latestQuery,
  newSubmissionId,
  SECTION_SPELLING,
  sendPhoto,
  submissionQuery,
  type WordTestSection,
  type WordTestStatus,
  type WordTestSubmission,
} from './wordTestApi'
import styles from './WordTest.module.css'
import { COPY, POLL_MS, SLOW_MS } from './wordTestCopy'

// 단어시험 사진 제출(#171)과 결과(#173, 1단계 시연용) — 책의 B 철자 쓰기 쪽을 찍어 올리고,
// 채점을 기다려 문항별 결과(ResultView)를 보인다.
// 와이어프레임 없음: v0.2 부품(턱 버튼·번호 동그라미·진행 바·흰 카드·상태 안내)만으로 조립.
// 화면은 서버 status 하나로 가른다(StatusView). 2단계에서 confirming·rejected 전용 화면을 그 자리에 끼운다.
// 다시 들어오면 회차의 최근 제출(latest)로 이어 간다 — 채점 중이면 다시 조회, 끝났으면 그 결과

export function SubmitPage() {
  const code = useParams().code ?? ''
  return (
    <StudentLayout levelCode={lessonLevelCode(code)}>
      <div className={styles.screen}>
        <Head code={code} />
        <SubmitBody key={code} code={code} section={SECTION_SPELLING} />
      </div>
    </StudentLayout>
  )
}

// 머리 줄: 뒤로 + 제목 + 회차 코드(S-06 머리와 같은 모양, 탭 바 없음)
function Head({ code }: { code: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  // 앱 안에서 왔으면 한 칸 뒤로, 주소로 바로 열었으면 홈(진입 자리)으로
  function goBack() {
    if (location.key !== 'default') void navigate(-1)
    else void navigate('/')
  }
  return (
    <header className={styles.header}>
      <button type="button" className={styles.iconButton} aria-label="뒤로" onClick={goBack}>
        <ChevronLeft size={24} strokeWidth={2} aria-hidden />
      </button>
      <div className={styles.headText}>
        <h1 className={styles.title}>{COPY.title}</h1>
        <p className={styles.sub}>{code}</p>
      </div>
    </header>
  )
}

type Sent = { id: number; status: WordTestStatus }

function SubmitBody({ code, section }: { code: string; section: WordTestSection }) {
  const queryClient = useQueryClient()
  const latest = useQuery(latestQuery(code, section))
  // 이 화면에서 방금 낸 제출. 있으면 latest보다 먼저
  const [sent, setSent] = useState<Sent | null>(null)
  // 실패 화면 "다시 찍기"나 결과 화면 "다시 풀고 올리기"를 누름 → 찍기 화면
  const [retaking, setRetaking] = useState(false)

  const seed = sent === null ? latest.data : undefined
  const id = sent?.id ?? seed?.id ?? null
  // 이미 끝난 최근 제출은 다시 부르지 않는다
  const watching = id !== null && !(seed !== undefined && seed !== null && isSettled(seed.status))
  const poll = useQuery({
    ...submissionQuery(id ?? 0),
    enabled: watching,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status !== undefined && isSettled(status)) return false
      if (isPermanentError(query.state.error)) return false
      return POLL_MS
    },
  })

  // 조회한 제출(채점 중이든 끝났든 서버 값 그대로)은 최근 제출 캐시에도 — 홈 진입 줄과 다시 들어왔을 때
  // 옛 제출 대신 이 제출을 보인다(다시 풀고 올린 뒤 옛 결과가 보이던 문제, #173 리뷰)
  const polled = poll.data
  useEffect(() => {
    if (polled !== undefined) queryClient.setQueryData(latestQuery(code, section).queryKey, polled)
  }, [polled, queryClient, code, section])

  // 일시 오류(5xx·끊김)는 2초 조회가 계속 다시 시도하므로 기록만, 다시 해도 같은 오류(4xx)면 아래에서 안내로
  const pollState = loadStateOf(poll)
  useServerErrorLog(pollState, poll.error)

  if (retaking || (sent === null && latest.data === null)) {
    return (
      <CaptureView
        code={code}
        section={section}
        onSent={(result) => {
          // 조회 응답이 오기 전에 떠나도 옛 결과를 새것으로 믿지 않게 — 다음에 쓸 때 다시 받는다
          void queryClient.invalidateQueries({
            queryKey: latestQuery(code, section).queryKey,
            refetchType: 'none',
          })
          setSent(result)
          setRetaking(false)
        }}
      />
    )
  }
  if (sent === null && latest.data === undefined) return <LatestLoadState query={latest} />
  // 제출 조회가 다시 해도 같은 오류(지워진 제출 404 등)면 "채점 중"에 갇히지 않게 서버 문구 + 홈으로
  if (poll.data === undefined && poll.isError && isPermanentError(poll.error)) {
    return <LatestLoadState query={poll} />
  }

  const submission = poll.data ?? (sent === null ? latest.data : undefined)
  const status = submission?.status ?? sent?.status ?? 'pending'
  return (
    <StatusView
      status={status}
      submission={submission ?? undefined}
      code={code}
      onRetake={() => {
        setSent(null)
        setRetaking(true)
      }}
    />
  )
}

const KNOWN_STATUS = [
  'pending',
  'grading',
  'confirming',
  'graded',
  'rejected',
  'failed',
] as const satisfies readonly WordTestStatus[]

/**
 * 서버 status 하나로 화면을 가른다. 2단계 confirming·rejected와 모르는 값은 조회를 멈추고(isSettled)
 * 나갈 길이 있는 대기 화면으로 받는다 — 2단계에서 전용 화면을 이 자리에
 */
function StatusView({
  status,
  submission,
  code,
  onRetake,
}: {
  status: WordTestStatus
  submission: WordTestSubmission | undefined
  code: string
  onRetake: () => void
}) {
  // 계약에 없는 status는 화면은 대기로 받고 원인을 알 수 있게 기록만(status 글자는 개인정보가 아니다)
  useEffect(() => {
    if (!(KNOWN_STATUS as readonly string[]).includes(status))
      console.warn('[wordtest] unknown status', status)
  }, [status])

  switch (status) {
    case 'pending':
    case 'grading':
      return <WaitingView />
    case 'graded':
      // 점수 없는 graded는 계약 밖 — 조회가 멈췄으니 갇히지 않게 대기 화면
      return submission !== undefined && submission.score !== null ? (
        <ResultView
          submission={{ ...submission, score: submission.score }}
          code={code}
          onRetry={onRetake}
        />
      ) : (
        <HeldView />
      )
    case 'failed':
      return <FailedView onRetake={onRetake} />
    case 'confirming': // 2단계: 글자 확인 화면
    case 'rejected': // 2단계: 다시 찍기 안내 화면
    default:
      return <HeldView />
  }
}

/**
 * 조회를 멈춘 대기 — 1단계에는 오지 않는 상태의 안전장치. 다시 들어오면 최근 제출을 받아 이어 간다
 * (최근 제출 캐시는 30초 staleTime — 그 안이면 캐시 그대로)
 */
function HeldView() {
  return (
    <>
      <div className={styles.center}>
        <StatusPanel
          icon={ScanText}
          tone="muted"
          role="status"
          title={COPY.held}
          detail={COPY.heldDetail}
        />
      </div>
      <div className={styles.actions}>
        <ButtonLink to="/" variant="secondary" block>
          {COPY.home}
        </ButtonLink>
      </div>
    </>
  )
}

function CaptureView({
  code,
  section,
  onSent,
}: {
  code: string
  section: WordTestSection
  onSent: (result: Sent) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  // 줄인 사진과 그 미리보기 주소, 제출 멱등 키(같은 사진으로 다시 시도하면 같은 값)
  const [photo, setPhoto] = useState<{ blob: Blob; url: string; clientId: string } | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const send = useMutation({
    mutationFn: sendPhoto,
    onSuccess: (result) => onSent(result),
    onError: (err) => {
      setError(sendErrorText(err))
      logSendError(err)
    },
  })

  // 미리보기 주소는 사진이 바뀌거나 화면을 떠날 때 풀어 준다
  useEffect(() => {
    if (photo === null) return
    return () => URL.revokeObjectURL(photo.url)
  }, [photo])

  const busy = preparing || send.isPending

  // 잠금은 disabled 대신 aria-disabled + 누름 무시 — disabled는 누른 버튼에서 포커스를 빼 버린다(S-06 WordsLoadState와 같음)
  function openCamera() {
    if (busy) return
    input.current?.click()
  }

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // 같은 파일을 다시 골라도 change가 오게 비운다
    event.target.value = ''
    if (file === undefined) return
    setError(null)
    setPreparing(true)
    try {
      const blob = await resizeImage(file)
      setPhoto({ blob, url: URL.createObjectURL(blob), clientId: newSubmissionId() })
    } catch (err) {
      // 실기기에서 원인(HEIC 해독 실패·캔버스 한도 등)을 가르려고 이름과 메시지만 남긴다 —
      // resizeImage의 메시지는 코드에 고정된 글이라 사진·개인 정보가 없다
      console.error('[wordtest] photo prepare failed', {
        name: err instanceof Error ? err.name : typeof err,
        message: err instanceof Error ? err.message : undefined,
      })
      setError(COPY.badImage)
    } finally {
      setPreparing(false)
    }
  }

  function submit() {
    if (photo === null || busy) return
    setError(null)
    send.mutate({
      lessonCode: code,
      section,
      photo: photo.blob,
      clientSubmissionId: photo.clientId,
    })
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.fileInput}
        tabIndex={-1}
        aria-hidden
        onChange={(event) => void onPick(event)}
        data-testid="photo-input"
      />
      <div className={styles.content}>
        {photo === null ? (
          <Card className={styles.guide} aria-label="찍는 방법">
            <ol className={styles.guideList}>
              {COPY.guide.map((line, i) => (
                <li key={line} className={styles.guideItem}>
                  <NumberCircle state="open" size={28} fontSize={14}>
                    {i + 1}
                  </NumberCircle>
                  {line}
                </li>
              ))}
            </ol>
          </Card>
        ) : (
          <img src={photo.url} alt="찍은 답안지" className={styles.preview} />
        )}
      </div>
      {/* 오류 줄 자리는 늘 둔다 — 글이 생길 때 읽어 주고, 버튼이 밀리지 않게 */}
      <p className={styles.error} role="alert">
        {error}
      </p>
      <div className={styles.actions}>
        {photo === null ? (
          <Button block onClick={openCamera} aria-disabled={busy || undefined}>
            {COPY.take}
          </Button>
        ) : (
          <div className={styles.pair}>
            <Button variant="secondary" onClick={openCamera} aria-disabled={busy || undefined}>
              {COPY.retake}
            </Button>
            <Button onClick={submit} aria-disabled={busy || undefined}>
              {COPY.send}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}

function sendErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_IMAGE') return COPY.badImage
    if (error.code === 'DAILY_LIMIT') return COPY.dailyLimit
  }
  return COPY.sendFailed
}

/** 서버 로그와 맞춰 볼 수 있게 상태·code·requestId만(메시지·사진 정보는 남기지 않는다) */
function logSendError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_IMAGE' || error.code === 'DAILY_LIMIT') return
    console.error('[wordtest] send failed', {
      status: error.status,
      code: error.code,
      requestId: error.requestId,
    })
  } else {
    console.error('[wordtest] send failed', {
      name: error instanceof Error ? error.name : typeof error,
    })
  }
}

function WaitingView() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div className={`${styles.center} ${styles.waiting}`}>
      <StatusPanel
        icon={ScanText}
        tone="muted"
        role="status"
        title={COPY.grading}
        detail={slow ? COPY.gradingSlow : COPY.gradingDetail}
      />
    </div>
  )
}

function FailedView({ onRetake }: { onRetake: () => void }) {
  return (
    <>
      <div className={styles.center}>
        <StatusPanel
          icon={TriangleAlert}
          tone="bad"
          role="alert"
          title={COPY.failed}
          detail={COPY.failedDetail}
        />
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" block onClick={onRetake}>
          {COPY.retake}
        </Button>
      </div>
    </>
  )
}

/** 최근 제출을 못 받았을 때 — S-05·S-06과 같은 상태 안내(shared/loadState) */
function LatestLoadState({ query }: { query: LoadQuery }) {
  const state = loadStateOf(query)
  useServerErrorLog(state, query.error)
  if (state === 'loading' || state === 'none') return null
  if (state === 'offline' || state === 'server') {
    return (
      <>
        <div className={styles.center}>
          <StatusPanel tone="bad" role="alert" {...RETRY_STATUS[state]} />
        </div>
        <div className={styles.actions}>
          <Button block onClick={() => void query.refetch()}>
            다시 시도
          </Button>
        </div>
      </>
    )
  }
  const problem = query.error instanceof ApiError ? query.error : undefined
  return (
    <>
      <div className={styles.center}>
        <StatusPanel
          icon={WAIT_ICON[state]}
          tone="muted"
          role="status"
          title={problem?.title ?? ''}
          detail={problem?.detail}
        />
      </div>
      <div className={styles.actions}>
        <ButtonLink to="/" variant="secondary" block>
          {COPY.home}
        </ButtonLink>
      </div>
    </>
  )
}
