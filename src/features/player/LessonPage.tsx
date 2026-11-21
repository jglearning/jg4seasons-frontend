import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  CalendarX,
  ChevronLeft,
  CircleAlert,
  House,
  Lock,
  TriangleAlert,
  WifiOff,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/errors'
import { meQuery } from '../../api/session'
import { lessonLevelCode } from '../../shared/lessonLabel'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { HeardBar } from '../../shared/ui/HeardBar'
import { NudgeCard } from '../../shared/ui/NudgeCard'
import { PassageTabs } from '../../shared/ui/PassageTabs'
import { PlayControls } from '../../shared/ui/PlayControls'
import { SegmentGroup } from '../../shared/ui/SegmentGroup'
import { SentenceDots } from '../../shared/ui/SentenceDots'
import { SentenceRow } from '../../shared/ui/SentenceRow'
import { StatusPanel } from '../../shared/ui/StatusPanel'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { VoiceButton, VoiceSheet } from '../../shared/ui/VoiceSheet'
import type { FlushResult } from './flushApi'
import { lessonQuery, type LessonDetail, type Passage, type Voice } from './lessonApi'
import { mergeRanges } from './listeningTracker'
import {
  PLAYBACK_RATES,
  usePlayer,
  VOICE_ORDER,
  voiceLong,
  type PlaybackRate,
  type PlayerValue,
  type Source,
  type Variant,
} from './player'
import { heardAmountMs } from './heardAmount'
import { LessonComplete } from './LessonComplete'
import { PlayerProvider } from './PlayerProvider'
import { heardSentences } from './sentenceSync'
import { useSentenceSync } from './useSentenceSync'
import { mapPosition, mapRanges } from './voiceMap'
import { settingsQuery, useVoice } from './voiceSetting'
import styles from './LessonPage.module.css'

// S-05 회차 듣기(STU-04·05·06·11, v0.2 지시문 §2 · 와이어프레임 S05_Player·S05_VoiceSheet, ADR-26 따라 읽기).
// 머리 줄(뒤로·제목·이름·홈) → 지문 번호 → 듣기 카드(음성·속도·지문·책 안내·문장 위치·재생 줄·들은 구간 바) → 복습 줄 → 맨 아래 다음 지문.
// 지문 음원 하나를 들으며 지금 문장을 따라가고, 문장 버튼·바로 위치를 옮긴다.
// 음성 4개(us_w·us_m·uk_w·uk_m)는 파일 선택, 속도 0.8·1.0·1.2는 재생 속도(ADR-27). 지문 완료는 서버 판정 —
// 음성 하나를 기준 이상 들었거나, 여러 음성으로 들은 구간을 합쳐 기준 이상(BE #59). 음성을 바꾸면 같은 조각의
// 같은 비율 지점으로 옮겨 이어 듣는다(voiceMap — 서버가 구간을 합치는 규칙과 같다).
// 고른 음성은 서버 설정(#146, BE #61 — voiceSetting), 속도는 이 화면 안에서만. 고른 적 없으면 미국 여성(A5).
// 완료·청취율·완료 기준·문장 시각은 모두 서버 값 — 화면은 보여 주기만 한다("들음" 점·빗금은 표시용, 03 §2.3)

export function LessonPage() {
  const { code = '' } = useParams()
  const lesson = useQuery(lessonQuery(code))
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  // S-08은 주소 없이 이 화면 위에 덮는다 — 같은 주소에 state를 실은 한 칸을 쌓아 뒤로 가기 = 닫기
  const completeShown = (location.state as CompleteState | null)?.lessonComplete === true
  // 응답이 늦게 와 이미 떠난 뒤라면 완료 화면으로 되돌리지 않는다
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const onTrackResult = useCallback(
    (result: FlushResult) => {
      const completedNow = applyFlushResult(queryClient, code, result)
      if (completedNow && mounted.current) {
        const state: CompleteState = { lessonComplete: true }
        void navigate(`/lessons/${code}`, { state })
      }
    },
    [queryClient, code, navigate],
  )

  // 떠날 때 남은 구간은 sendBeacon으로 가서 응답(완료)을 받지 못한다 — 홈·회차 목록은 다음에 다시 받게
  useEffect(
    () => () => {
      void queryClient.invalidateQueries({ queryKey: ['student', 'home'] })
      void queryClient.invalidateQueries({ queryKey: ['student', 'lessons'] })
    },
    [queryClient],
  )

  // 고른 음성(서버 설정, BE #61) — 듣기 화면과 완료 화면(들은 분량)이 같이 쓴다.
  // 처음 올릴 음원이 저장된 목소리여야 해서 설정이 오거나(실패도) 멈출 때까지 받기 전 화면으로 둔다
  const settings = useQuery(settingsQuery)
  const settingsSettled = settings.status !== 'pending' || settings.fetchStatus === 'paused'
  const [variant, setVariant] = useVoice()

  if (lesson.data === undefined || !settingsSettled)
    return <LessonBefore code={code} query={lesson} />

  const data = lesson.data
  return (
    <PlayerProvider lessonTitle={data.lesson.title} onTrackResult={onTrackResult}>
      {/* 완료 화면이 덮은 동안 뒤의 S-05는 누르거나 읽히지 않게 */}
      <div inert={completeShown}>
        <LessonBody code={code} data={data} variant={variant} onVariantChange={setVariant} />
      </div>
      {completeShown && (
        <LessonComplete
          title={data.lesson.title}
          heardMs={heardAmountMs(data.passages, variant)}
          passagesDone={data.completion.passagesDone}
          passagesTotal={data.completion.passagesTotal}
          wordsTotal={data.words.total}
          wordsTo={`/lessons/${code}/words`}
        />
      )}
    </PlayerProvider>
  )
}

type CompleteState = { lessonComplete?: boolean }

type Nudge = 'next' | 'words'

/** 복습 본문 — 펼치는 버튼의 aria-controls(접혀 있으면 그리지 않는다) */
const REVIEW_ID = 'review-sentences'

function LessonBody({
  code,
  data,
  variant,
  onVariantChange: setVariant,
}: {
  code: string
  data: LessonDetail
  variant: Variant
  onVariantChange: (variant: Variant) => void
}) {
  const player = usePlayer()
  const studentName = useQuery(meQuery).data?.name
  const [selectedNo, setSelectedNo] = useState(() => firstUnfinished(data))
  const passage = data.passages.find((p) => p.no === selectedNo) ?? data.passages[0]
  const [nudge, setNudge] = useState<Nudge | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [reviewShown, setReviewShown] = useState(false)
  /** 들은 구간 바를 끄는 중인 위치 — 손을 떼기 전까지 시간 글자만 따라간다 */
  const [dragMs, setDragMs] = useState<number | null>(null)
  // 복습은 회차의 지문을 다 들었을 때만(서버 값 — 클라이언트가 세지 않는다)
  const reviewOpen =
    data.completion.passagesTotal > 0 &&
    data.completion.passagesDone === data.completion.passagesTotal
  const listRef = useRef<HTMLOListElement>(null)

  // 고른 음성이 이 지문에 없으면 첫 음성으로 듣는다(버튼 글자는 고른 음성 그대로 — 지시문 §2.4)
  const speed: Voice | undefined = voiceOf(passage, variant)
  const timings = speed?.timings ?? []
  const onThisTrack = speed !== undefined && player.source?.trackId === speed.trackId
  const positionMs = onThisTrack ? player.positionMs : 0
  // 재생을 시작했거나 위치를 옮긴 뒤에야 "지금 문장"이 있다
  const started = onThisTrack && (player.playing || player.positionMs > 0)
  const current = useSentenceSync(timings, positionMs, {
    active: started,
    playing: player.playing,
    container: listRef,
  })
  const listened = speed ? listenedRanges(passage, speed, player) : []
  const heard = speed ? heardSentences(timings, listened) : []
  const sentenceCount = passage.sentences.length
  const at = Math.max(current, 0)
  // timings가 []면 문장 시각이 아직 없다(BE #18) — 문장 위치·이동 없이 재생만
  const hasTimings = timings.length > 0

  // 지문을 고르면 그 지문 음원(지금 음성)을 올려 둔다(바로 재생하지는 않는다)
  const { load } = player
  useEffect(() => {
    const target = data.passages.find((p) => p.no === selectedNo)
    const next = target ? voiceOf(target, variant) : undefined
    if (target === undefined || next === undefined) return
    load(passageSource(target, next))
    // 지문을 바꿀 때만 다시 올린다(데이터 갱신 때마다 올리지 않게. 음성은 selectVariant가 올린다)
  }, [selectedNo]) // eslint-disable-line react-hooks/exhaustive-deps

  // 복습 본문을 펼친 채 지문을 옮기면 그대로 펼쳐 둔다(지문마다 따라 읽기)
  function selectPassage(no: number) {
    setNudge(null)
    setSelectedNo(no)
  }

  /**
   * 음성은 파일 선택 — 음성마다 길이가 달라 지금 자리를 새 음성의 같은 조각·같은 비율 지점으로 옮겨 이어 듣는다
   * (서버가 섞어 들은 구간을 합치는 규칙과 같다, BE #59). 재생 상태 유지. 시작 전이면 처음부터
   */
  function selectVariant(next: Variant) {
    setVariant(next)
    const target = voiceOf(passage, next)
    if (target === undefined || target.trackId === speed?.trackId) return
    load(passageSource(passage, target), {
      atMs: started && speed ? mapPosition(speed, target, positionMs) : 0,
      play: player.playing,
    })
  }

  /** 그 문장 시작으로 옮겨 재생(문장 누르기 = seek이라 들은 구간이 끊긴다, TRK-03) */
  function playFrom(index: number) {
    player.seekTo(timings[index]?.[0] ?? 0)
    if (!player.playing) player.play()
  }

  const next = data.passages.find((p) => p.no === selectedNo + 1)
  const done = passage.completed
  const unfinished = data.passages.filter((p) => !p.completed)
  const allDone = unfinished.length === 0

  function goNext() {
    if (next === undefined) return
    if (done) selectPassage(next.no)
    else setNudge('next')
  }

  const wordsTo = `/lessons/${code}/words`
  const durationMs = onThisTrack ? player.durationMs : (speed?.durationMs ?? 0)
  const voiceOptions = VOICE_ORDER.filter((v) => passage.voices.some((p) => p.variant === v)).map(
    (v) => ({ value: v, ...voiceLong(v) }),
  )
  const threshold = data.completion.threshold

  return (
    <StudentLayout levelCode={data.level.code}>
      <div className={styles.screen}>
        <LessonHead
          title={data.lesson.title}
          summary={`지문 듣기 ${data.completion.passagesDone} / ${data.completion.passagesTotal}`}
          name={studentName}
        />

        <PassageTabs
          tabs={data.passages.map((p) => ({ no: p.no, done: p.completed }))}
          selected={selectedNo}
          onSelect={selectPassage}
        />

        <section className={styles.card} aria-label={`지문 ${passage.no} 듣기`}>
          <div className={styles.cardTop}>
            <VoiceButton
              label={voiceLong(variant).label}
              onClick={() => setSheetOpen(true)}
              disabled={player.source === null}
            />
            <SegmentGroup
              label="속도"
              options={PLAYBACK_RATES.map((r) => ({ value: rateValue(r), label: r.toFixed(1) }))}
              selected={rateValue(player.rate)}
              onSelect={(value) => player.setRate(Number(value) as PlaybackRate)}
            />
          </div>

          <p className={styles.eyebrow}>
            지문 {passage.no} · {clock(speed?.durationMs ?? 0)}
          </p>
          <h2 className={styles.passageTitle} lang="en">
            {passage.title}
          </h2>
          <p className={styles.guide}>
            <BookOpen size={20} strokeWidth={2} aria-hidden />책 {passage.no}번 지문을 펴고 들어요
          </p>

          <div className={styles.center}>
            <p className={styles.position}>
              {hasTimings ? (
                <>
                  <span className={styles.positionLabel}>문장</span>
                  <span className={styles.positionValue}>
                    {at + 1} / {sentenceCount}
                  </span>
                </>
              ) : (
                <>
                  <span className={styles.positionLabel}>전체</span>
                  <span className={styles.positionValue}>{clock(durationMs)}</span>
                </>
              )}
            </p>
            {hasTimings && (
              <SentenceDots count={sentenceCount} current={started ? at : -1} heard={heard} />
            )}
            <PlayControls
              playing={player.playing}
              onToggle={player.toggle}
              onPrevious={() => playFrom(Math.max(at - 1, 0))}
              onReplay={() => playFrom(at)}
              disabled={player.source === null}
              previousDisabled={!hasTimings || at <= 0}
              replayDisabled={!hasTimings}
            />
          </div>

          {player.error !== null && (
            <div className={styles.error} role="alert">
              <span>{PLAYER_ERROR[player.error]}</span>
              <button type="button" className={styles.retry} onClick={player.retry}>
                다시 불러오기
              </button>
            </div>
          )}

          <div className={styles.heard}>
            <div className={styles.heardHead}>
              <span className={styles.heardLabel}>들은 구간 {percent(passage.coverage)}</span>
              <span className={styles.heardGoal}>{percent(threshold)}면 완료</span>
            </div>
            <HeardBar
              listened={listened}
              positionMs={positionMs}
              durationMs={durationMs}
              threshold={threshold}
              onSeek={player.seekTo}
              onDragChange={setDragMs}
              disabled={player.source === null}
            />
            <div className={styles.times}>
              <span>{clock(dragMs ?? positionMs)}</span>
              <button
                type="button"
                className={styles.fromStart}
                onClick={() => playFrom(0)}
                disabled={!speed}
              >
                처음부터 듣기
              </button>
              <span>{clock(durationMs)}</span>
            </div>
          </div>
        </section>

        {reviewOpen ? (
          <div className={styles.reviewRow}>
            <Button
              variant="secondary"
              block
              aria-expanded={reviewShown}
              aria-controls={REVIEW_ID}
              onClick={() => setReviewShown((v) => !v)}
            >
              {reviewShown ? '복습 닫기' : '복습하기 · 본문 보며 듣기'}
            </Button>
          </div>
        ) : (
          <p className={styles.reviewLock}>
            <Lock size={16} strokeWidth={2.2} aria-hidden />
            복습은 지문 {data.completion.passagesTotal}개를 다 들으면 열려요 ·{' '}
            {data.completion.passagesDone} / {data.completion.passagesTotal}
          </p>
        )}

        {reviewOpen && reviewShown && (
          <ol ref={listRef} id={REVIEW_ID} className={styles.sentences} aria-label="지문 본문">
            {passage.sentences.map((sentence, i) => (
              <SentenceRow
                key={sentence.no}
                no={sentence.no}
                text={sentence.text}
                current={started && i === current}
                heard={heard[i] ?? false}
                onSelect={() => playFrom(i)}
                disabled={timings[i] === undefined}
              />
            ))}
          </ol>
        )}
      </div>

      <div className={styles.bottom}>
        {nudge === 'next' && next ? (
          <NextNudge
            passage={passage}
            voice={speed}
            player={player}
            onStay={(index) => {
              setNudge(null)
              // 지금 음성 그대로. 문장 시각이 없으면 문장으로 옮기지 않고 지금 자리에서 이어 듣는다
              if (timings.length > 0) playFrom(index)
              else player.play()
            }}
            onGo={() => selectPassage(next.no)}
          />
        ) : nudge === 'words' && !allDone ? (
          <NudgeCard
            title="아직 완료 안 된 지문이 있어요"
            body={`완료 안 된 지문: ${unfinished.map((p) => p.no).join(', ')} · 음성을 바꿔 들어도 이어서 세요`}
            primary={{ label: '마저 듣기', onClick: () => selectPassage(unfinished[0].no) }}
            secondary={{ label: '그래도 단어로', to: wordsTo }}
          />
        ) : null}
        {next ? (
          <Button variant={done ? 'primary' : 'secondary'} block onClick={goNext}>
            다음 지문
          </Button>
        ) : (
          <ButtonLink
            to={wordsTo}
            variant={allDone ? 'primary' : 'secondary'}
            block
            onClick={(event) => {
              if (allDone) return
              event.preventDefault()
              setNudge('words')
            }}
          >
            오늘 단어 {data.words.total}개 보기
          </ButtonLink>
        )}
      </div>

      <VoiceSheet
        open={sheetOpen}
        options={voiceOptions}
        selected={variant}
        onClose={() => setSheetOpen(false)}
        onApply={(value) => {
          setSheetOpen(false)
          if (value !== variant) selectVariant(value)
        }}
      />
    </StudentLayout>
  )
}

/**
 * 머리 줄: 뒤로 + 제목(+ 보조 글) + 이름 + 홈으로. 회차를 받기 전(불러오는 중·못 받음)에도 그린다 —
 * 홈 화면 앱에는 브라우저 뒤로 가기가 없어 나갈 길이 없다(#139). 그때 제목 자리는 회차 코드(이름은 서버 값)
 */
function LessonHead({ title, summary, name }: { title: string; summary?: string; name?: string }) {
  const navigate = useNavigate()
  const location = useLocation()

  /** 들어온 화면으로. 주소로 바로 들어와 돌아갈 곳이 없으면(첫 위치의 key는 "default") 회차 목록 */
  function goBack() {
    if (location.key !== 'default') void navigate(-1)
    else void navigate('/lessons')
  }

  return (
    <header className={styles.header}>
      <button type="button" className={styles.iconButton} aria-label="뒤로" onClick={goBack}>
        <ChevronLeft size={24} strokeWidth={2} aria-hidden />
      </button>
      <div className={styles.headText}>
        <h1 className={styles.title}>{title}</h1>
        {summary !== undefined && <p className={styles.summary}>{summary}</p>}
      </div>
      {name && <span className={styles.name}>{name}</span>}
      <Link to="/" className={styles.iconButton} aria-label="홈으로">
        <House size={24} strokeWidth={2} aria-hidden />
      </Link>
    </header>
  )
}

/**
 * 완료 안 된 지문에서 "다음 지문"을 누르면: 지문 들은 구간(서버 합산 coverage)과 지금 음성 기준 안 들은 문장.
 * 섞어 들어도 세므로(BE #59) 음성 이름을 붙이지 않고, "이어서 듣기"도 지금 음성 그대로
 */
function NextNudge({
  passage,
  voice,
  player,
  onStay,
  onGo,
}: {
  passage: Passage
  /** 지금 듣는 음성(지문에 음성이 없으면 undefined) */
  voice: Voice | undefined
  player: PlayerValue
  onStay: (sentenceIndex: number) => void
  onGo: () => void
}) {
  const heard = voice ? heardSentences(voice.timings, listenedRanges(passage, voice, player)) : []
  const missing = passage.sentences.filter((_, i) => !heard[i]).map((s) => s.no)
  const firstMissing = Math.max(
    passage.sentences.findIndex((_, i) => !heard[i]),
    0,
  )
  const heardText = `들은 구간 ${percent(passage.coverage)}`
  return (
    <NudgeCard
      title={`지문 ${passage.no}${objectParticle(passage.no)} 아직 다 안 들었어요`}
      body={
        voice === undefined || voice.timings.length === 0
          ? // 문장 시각이 없으면 안 들은 문장을 셀 수 없다
            heardText
          : `${heardText} · 안 들은 문장 ${
              missing.length > 0 ? missing.join(', ') : '없음(조금씩 빈 곳)'
            }`
      }
      primary={{ label: '이어서 듣기', onClick: () => onStay(firstMissing) }}
      secondary={{ label: '그냥 넘어가기', onClick: onGo }}
    />
  )
}

// ── 회차를 받기 전(와이어프레임 S05_Before, 명세 S04_S05_빈상태 §2, #139) ──

type BeforeQuery = { isError: boolean; error: unknown; fetchStatus: string; refetch: () => unknown }

/**
 * ① loading 불러오는 중 / ② offline 인터넷 끊김 / ③ locked 잠긴 회차 / ④ license 사용 기간 아님 /
 * client 그 밖의 4xx(③④와 같은 틀) / ⑤ server 서버 오류 / none 그리지 않음(401 — 세션 만료 이동이 맡는다)
 */
type Before = 'loading' | 'offline' | 'locked' | 'license' | 'client' | 'server' | 'none'

/** 처음 이만큼은 머리 줄만 — 빨리 오면 뼈대가 깜박이지 않고 바로 듣기 화면 */
const LOADING_DELAY_MS = 300

/**
 * 받은 오류를 상태로. 브라우저가 오프라인이면 요청이 멈추고(paused), 온라인인데 서버에 닿지 못하면
 * 연결 오류(TypeError)가 온다 — 둘 다 ②. 서버가 응답한 5xx·엉뚱한 응답·알 수 없는 오류는 ⑤
 */
function beforeState(query: BeforeQuery): Before {
  if (query.fetchStatus === 'paused') return 'offline'
  if (query.fetchStatus === 'fetching' || !query.isError) return 'loading'
  const error = query.error
  if (error instanceof TypeError) return 'offline'
  if (!(error instanceof ApiError)) return 'server'
  if (error.status === 401) return 'none'
  if (error.code === 'LESSON_LOCKED') return 'locked'
  if (error.code === 'LICENSE_INACTIVE') return 'license'
  if (error.status >= 400 && error.status < 500) return 'client'
  return 'server'
}

/** ②⑤는 정한 문구, ③④·그 밖 4xx는 서버 문구(title = 제목, detail = 보조 글) */
const FIXED_COPY = {
  offline: { title: '인터넷이 끊겼어요', detail: '연결을 확인하고 다시 시도해 주세요' },
  server: { title: '잠시 문제가 생겼어요', detail: '잠시 후 다시 시도해 주세요' },
} as const

const WAIT_ICON = { locked: Lock, license: CalendarX, client: CircleAlert } as const

/**
 * 회차를 받기 전 화면. 바탕은 회차 코드의 레벨(응답 전이라 코드에서 읽는다), 머리 줄은 늘 있다.
 * ②⑤는 다시 시도하면 풀릴 수 있어 주 버튼 "다시 시도", ③④는 기다려야 풀려 흰 버튼 "회차 목록으로".
 * 버튼은 평소 "다음 지문"과 같은 아래 고정 자리
 */
function LessonBefore({ code, query }: { code: string; query: BeforeQuery }) {
  const state = beforeState(query)
  const loading = state === 'loading'
  const [loadingShown, setLoadingShown] = useState(false)
  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setLoadingShown(true), LOADING_DELAY_MS)
    return () => {
      clearTimeout(timer)
      setLoadingShown(false)
    }
  }, [loading])

  // 서버 쪽 문제는 서버 로그와 맞춰 볼 수 있게 상태·code·requestId만 남긴다(개인정보 없음)
  const error = query.error
  useEffect(() => {
    if (state !== 'server') return
    console.error(
      '[api]',
      error instanceof ApiError
        ? { status: error.status, code: error.code, requestId: error.requestId }
        : error,
    )
  }, [state, error])

  let body: ReactNode = null
  let action: ReactNode = null
  if (state === 'offline' || state === 'server') {
    body = (
      <StatusPanel
        icon={state === 'offline' ? WifiOff : TriangleAlert}
        tone="bad"
        role="alert"
        {...FIXED_COPY[state]}
      />
    )
    action = (
      <Button block onClick={() => void query.refetch()}>
        다시 시도
      </Button>
    )
  } else if (state === 'locked' || state === 'license' || state === 'client') {
    const problem = error instanceof ApiError ? error : undefined
    body = (
      <StatusPanel
        icon={WAIT_ICON[state]}
        tone="muted"
        role="status"
        title={problem?.title ?? ''}
        detail={problem?.detail}
      />
    )
    action = (
      <ButtonLink to="/lessons" variant="secondary" block>
        회차 목록으로
      </ButtonLink>
    )
  }

  return (
    <StudentLayout levelCode={lessonLevelCode(code)}>
      <div className={loading ? styles.screen : `${styles.screen} ${styles.screenBefore}`}>
        <LessonHead title={code} />
        {loading ? loadingShown && <LessonSkeleton /> : <div className={styles.before}>{body}</div>}
      </div>
      {loading
        ? loadingShown && (
            <div className={styles.bottom}>
              <span className={styles.skelButton} aria-hidden="true" />
            </div>
          )
        : action && <div className={styles.bottom}>{action}</div>}
    </StudentLayout>
  )
}

/**
 * ① 불러오는 중 — 듣기 화면의 뼈대(지문 번호 6 · 듣기 카드 · 복습 줄 자리). 응답이 오면 같은 자리에 실제 내용이 들어가
 * 화면이 튀지 않는다. 1.2초로 깜박이고, 움직임 줄이기면 멈춘다(DESIGN.md 1.3 — 불러오는 표시에만 허용)
 */
function LessonSkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-label="불러오는 중">
      <div className={styles.skelTabs} aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={styles.skelTab} />
        ))}
      </div>
      {/* 칸 구조·높이는 실제 듣기 카드와 같다(지문 정보 줄 · 가운데 · 들은 구간) — 막대만 칸 안에 */}
      <div className={styles.card}>
        <div className={styles.cardTop} aria-hidden="true">
          <span className={`${styles.skelBar} ${styles.skelVoice}`} />
          <span className={`${styles.skelBar} ${styles.skelRate}`} />
        </div>
        <span className={`${styles.skelSlot} ${styles.skelEyebrowSlot}`} aria-hidden="true">
          <span className={`${styles.skelBar} ${styles.skelEyebrow}`} />
        </span>
        <span className={`${styles.skelSlot} ${styles.skelTitleSlot}`} aria-hidden="true">
          <span className={`${styles.skelBar} ${styles.skelTitle}`} />
        </span>
        <span className={`${styles.skelSlot} ${styles.skelGuideSlot}`} aria-hidden="true">
          <span className={`${styles.skelBar} ${styles.skelGuide}`} />
        </span>
        <div className={styles.center}>
          <span className={styles.skelPositionSlot} aria-hidden="true" />
          <span className={styles.skelDotsSlot} aria-hidden="true" />
          <div className={styles.skelControls}>
            <div className={styles.skelRow} aria-hidden="true">
              <span className={`${styles.skelBar} ${styles.skelSide}`} />
              <span className={`${styles.skelBar} ${styles.skelPlay}`} />
              <span className={`${styles.skelBar} ${styles.skelSide}`} />
            </div>
            <p className={styles.skelText}>불러오는 중이에요</p>
          </div>
        </div>
        <div className={styles.heard} aria-hidden="true">
          <span className={styles.skelHeardHead} />
          <span className={`${styles.skelBar} ${styles.skelHeard}`} />
          <span className={styles.skelTimes} />
        </div>
      </div>
      <span className={styles.skelReview} aria-hidden="true" />
    </div>
  )
}

// ── 서버 값 → 화면 ──

/** 소리가 안 날 때(카드 안 안내) */
const PLAYER_ERROR: Record<NonNullable<PlayerValue['error']>, string> = {
  blocked: '재생이 멈췄어요. 다시 불러와 주세요',
  load: '소리를 불러오지 못했어요',
}

/** 처음 고를 지문: 서버가 완료라고 하지 않은 첫 지문 */
function firstUnfinished(data: LessonDetail): number {
  return data.passages.find((p) => !p.completed)?.no ?? data.passages[0]?.no ?? 1
}

/** 고른 음성의 트랙, 이 지문에 없으면 첫 트랙 */
function voiceOf(passage: Passage, variant: Variant): Voice | undefined {
  return passage.voices.find((v) => v.variant === variant) ?? passage.voices[0]
}

/** 속도 선택 줄의 값(문자열): 1 → "1.0" */
function rateValue(rate: PlaybackRate): string {
  return rate.toFixed(1)
}

/**
 * 그 음성 시각으로 본 지문의 들은 구간: 서버 combinedRanges(다른 음성으로 들은 곳까지 옮긴 값, BE #59) +
 * 이 화면에서 들은 구간. 서버 값은 다시 받기 전까지 그대로라서, 이 화면에서 다른 음성으로 들은 구간도
 * 서버와 같은 규칙(voiceMap)으로 옮겨 더한다
 */
function listenedRanges(
  passage: Passage,
  voice: Voice,
  player: PlayerValue,
): Array<[number, number]> {
  return mergeRanges([
    ...voice.combinedRanges.map(([a, b]): [number, number] => [a, b]),
    ...player.listenedOf(voice.trackId),
    ...passage.voices
      .filter((other) => other.trackId !== voice.trackId)
      .flatMap((other) => mapRanges(other, voice, player.listenedOf(other.trackId))),
  ])
}

/** 서버 비율(0~1) → "72%". 내림 — 완료 전에 100%로 보이지 않게 */
function percent(ratio: number): string {
  return `${Math.floor(Math.min(Math.max(ratio, 0), 1) * 100)}%`
}

/** 숫자 뒤 목적격 조사: 1·3·6·7·8·0(받침 있음) → 을, 나머지 → 를 */
function objectParticle(no: number): string {
  return [0, 1, 3, 6, 7, 8].includes(no % 10) ? '을' : '를'
}

/** 89000 → "1:29" */
function clock(ms: number): string {
  const seconds = Math.max(Math.floor(ms / 1000), 0)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function passageSource(passage: Passage, speed: Voice): Source {
  return {
    passageNo: passage.no,
    variant: speed.variant,
    trackId: speed.trackId,
    audioUrl: speed.audioUrl,
    durationMs: speed.durationMs,
  }
}

// ── 응답을 캐시에 반영(다시 받지 않고 서버가 준 값으로) ──

/** 응답을 캐시에 반영한다. 이 응답으로 회차가 처음 완료됐으면(서버 상태: 완료 아님 → completed) true */
function applyFlushResult(queryClient: QueryClient, code: string, result: FlushResult): boolean {
  if (result.lesson.code !== code) return false
  const before = queryClient.getQueryData<LessonDetail>(lessonQuery(code).queryKey)
  const completedNow =
    before !== undefined &&
    before.completion.status !== 'completed' &&
    result.lesson.status === 'completed'
  // 회차 상태(진행 중 → 완료)가 바뀌면 홈·회차 목록도 다시 받는다(밀림·완료 표시)
  if (before !== undefined && before.completion.status !== result.lesson.status) {
    void queryClient.invalidateQueries({ queryKey: ['student', 'home'] })
    void queryClient.invalidateQueries({ queryKey: ['student', 'lessons'] })
  }
  queryClient.setQueryData<LessonDetail>(lessonQuery(code).queryKey, (before) => {
    if (before === undefined) return before
    return {
      ...before,
      completion: {
        ...before.completion,
        status: result.lesson.status,
        passagesDone: result.lesson.requiredDone,
        passagesTotal: result.lesson.requiredTotal,
      },
      passages: before.passages.map((p) => {
        // 방금 보낸 트랙의 지문만: 지문 합산 값(result.passage)과 그 트랙 값(result.track)
        if (!p.voices.some((v) => v.trackId === result.track.trackId)) return p
        return {
          ...p,
          coverage: result.passage.coverage,
          completed: result.passage.completed,
          voices: p.voices.map((v) =>
            v.trackId === result.track.trackId
              ? { ...v, coverage: result.track.coverage, completed: result.track.completed }
              : v,
          ),
        }
      }),
    }
  })
  return completedNow
}
