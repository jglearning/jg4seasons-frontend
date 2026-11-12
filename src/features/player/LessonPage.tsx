import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { BookOpen, ChevronLeft, House, Lock } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ApiError } from '../../api/errors'
import { meQuery } from '../../api/session'
import { errorMessage, NETWORK_MESSAGE } from '../../shared/errorMessage'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { HeardBar } from '../../shared/ui/HeardBar'
import { NudgeCard } from '../../shared/ui/NudgeCard'
import { PassageTabs } from '../../shared/ui/PassageTabs'
import { PlayControls } from '../../shared/ui/PlayControls'
import { SegmentGroup } from '../../shared/ui/SegmentGroup'
import { SentenceDots } from '../../shared/ui/SentenceDots'
import { SentenceRow } from '../../shared/ui/SentenceRow'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { VoiceButton, VoiceSheet } from '../../shared/ui/VoiceSheet'
import type { FlushResult } from './flushApi'
import { lessonQuery, type LessonDetail, type Passage, type Voice } from './lessonApi'
import { mergeRanges } from './listeningTracker'
import {
  DEFAULT_VOICE,
  PLAYBACK_RATES,
  usePlayer,
  VOICE_LABEL,
  VOICE_ORDER,
  voiceLong,
  type PlaybackRate,
  type PlayerValue,
  type Source,
  type Variant,
} from './player'
import { PlayerProvider } from './PlayerProvider'
import { heardSentences } from './sentenceSync'
import { useSentenceSync } from './useSentenceSync'
import styles from './LessonPage.module.css'

// S-05 회차 듣기(STU-04·05·06·11, v0.2 지시문 §2 · 와이어프레임 S05_Player·S05_VoiceSheet, ADR-26 따라 읽기).
// 머리 줄(뒤로·제목·이름·홈) → 지문 번호 → 듣기 카드(음성·속도·지문·책 안내·문장 위치·재생 줄·들은 구간 바) → 복습 줄 → 맨 아래 다음 지문.
// 지문 음원 하나를 들으며 지금 문장을 따라가고, 문장 버튼·바로 위치를 옮긴다.
// 음성 4개(us_w·us_m·uk_w·uk_m)는 파일 선택, 속도 0.8·1.0·1.2는 재생 속도(ADR-27). 아무 음성 하나를 다 들으면 지문 완료(서버).
// 고른 음성·속도는 이 화면 안에서만 유지한다(저장은 이슈 9). 처음 음성은 미국 여성(A5).
// 완료·청취율·완료 기준·문장 시각은 모두 서버 값 — 화면은 보여 주기만 한다("들음" 점·빗금은 표시용, 03 §2.3)

export function LessonPage() {
  const { code = '' } = useParams()
  const lesson = useQuery(lessonQuery(code))
  const queryClient = useQueryClient()

  const onTrackResult = useCallback(
    (result: FlushResult) => applyFlushResult(queryClient, code, result),
    [queryClient, code],
  )

  if (lesson.data === undefined) {
    return (
      <StudentLayout>
        <LessonLoadState query={lesson} />
      </StudentLayout>
    )
  }

  return (
    <PlayerProvider lessonTitle={lesson.data.lesson.title} onTrackResult={onTrackResult}>
      <LessonBody code={code} data={lesson.data} />
    </PlayerProvider>
  )
}

type Nudge = 'next' | 'words'

function LessonBody({ code, data }: { code: string; data: LessonDetail }) {
  const player = usePlayer()
  const navigate = useNavigate()
  const location = useLocation()
  const studentName = useQuery(meQuery).data?.name
  const [selectedNo, setSelectedNo] = useState(() => firstUnfinished(data))
  const passage = data.passages.find((p) => p.no === selectedNo) ?? data.passages[0]
  const [variant, setVariant] = useState<Variant>(DEFAULT_VOICE)
  const [nudge, setNudge] = useState<Nudge | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [reviewShown, setReviewShown] = useState(false)
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
  const listened = speed ? heardRanges(speed, player) : []
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

  /** 음성은 파일 선택 — 음성마다 길이가 달라 같은 문장의 새 음성 시작 시각으로 옮겨 이어 듣는다(재생 상태 유지) */
  function selectVariant(next: Variant, options: { from?: number; play?: boolean } = {}) {
    setVariant(next)
    const target = voiceOf(passage, next)
    if (target === undefined || target.trackId === speed?.trackId) return
    const index = options.from ?? (started ? at : 0)
    load(passageSource(passage, target), {
      atMs: target.timings[index]?.[0] ?? 0,
      play: options.play ?? player.playing,
    })
  }

  /** 그 문장 시작으로 옮겨 재생(문장 누르기 = seek이라 들은 구간이 끊긴다, TRK-03) */
  function playFrom(index: number) {
    player.seekTo(timings[index]?.[0] ?? 0)
    if (!player.playing) player.play()
  }

  const next = data.passages.find((p) => p.no === selectedNo + 1)
  const done = passageDone(passage)
  const unfinished = data.passages.filter((p) => !passageDone(p))
  const allDone = unfinished.length === 0

  function goNext() {
    if (next === undefined) return
    if (done) selectPassage(next.no)
    else setNudge('next')
  }

  /** 들어온 화면으로. 주소로 바로 들어와 돌아갈 곳이 없으면(첫 위치의 key는 "default") 회차 목록 */
  function goBack() {
    if (location.key !== 'default') navigate(-1)
    else navigate('/lessons')
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
        <header className={styles.header}>
          <button type="button" className={styles.iconButton} aria-label="뒤로" onClick={goBack}>
            <ChevronLeft size={24} strokeWidth={2} aria-hidden />
          </button>
          <div className={styles.headText}>
            <h1 className={styles.title}>{data.lesson.title}</h1>
            <p className={styles.summary}>
              지문 듣기 {data.completion.passagesDone} / {data.completion.passagesTotal}
            </p>
          </div>
          {studentName && <span className={styles.name}>{studentName}</span>}
          <Link to="/" className={styles.iconButton} aria-label="홈으로">
            <House size={24} strokeWidth={2} aria-hidden />
          </Link>
        </header>

        <PassageTabs
          tabs={data.passages.map((p) => ({ no: p.no, done: passageDone(p) }))}
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
              <span className={styles.heardLabel}>
                들은 구간 {speed ? percent(speed.coverage) : '0%'}
              </span>
              <span className={styles.heardGoal}>{percent(threshold)}면 완료</span>
            </div>
            <HeardBar
              listened={listened}
              positionMs={positionMs}
              durationMs={durationMs}
              threshold={threshold}
              onSeek={player.seekTo}
              disabled={player.source === null}
            />
            <div className={styles.times}>
              <span>{clock(positionMs)}</span>
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
            <Button variant="secondary" block onClick={() => setReviewShown((v) => !v)}>
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
          <ol ref={listRef} className={styles.sentences} aria-label="지문 본문">
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
            player={player}
            onStay={(target, index) => {
              setNudge(null)
              // 문장 시각이 없으면 문장으로 옮기지 않고 지금 자리에서 이어 듣는다
              if (target.variant !== speed?.variant)
                selectVariant(target.variant, { from: index, play: true })
              else if (target.timings.length > 0) playFrom(index)
              else player.play()
            }}
            onGo={() => selectPassage(next.no)}
          />
        ) : nudge === 'words' && !allDone ? (
          <NudgeCard
            title="아직 완료 안 된 지문이 있어요"
            body={`완료 안 된 지문: ${unfinished.map((p) => p.no).join(', ')} · 아무 음성으로 끝까지 들으면 완료돼요`}
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

/** 완료 안 된 지문에서 "다음 지문"을 누르면: 가장 많이 들은 음성의 들은 구간과 안 들은 문장 */
function NextNudge({
  passage,
  player,
  onStay,
  onGo,
}: {
  passage: Passage
  player: PlayerValue
  onStay: (voice: Voice, sentenceIndex: number) => void
  onGo: () => void
}) {
  // 완료로 치는 음성(서버 required) 중 가장 많이 들은 것 — 아무 음성 하나를 다 들으면 완료(ADR-27)
  const target = mostHeardVoice(passage)
  const heard = target ? heardSentences(target.timings, heardRanges(target, player)) : []
  const missing = passage.sentences.filter((_, i) => !heard[i]).map((s) => s.no)
  const firstMissing = Math.max(
    passage.sentences.findIndex((_, i) => !heard[i]),
    0,
  )
  return (
    <NudgeCard
      title={`지문 ${passage.no}${objectParticle(passage.no)} 아직 다 안 들었어요`}
      body={
        target === undefined
          ? ''
          : target.timings.length === 0
            ? // 문장 시각이 없으면 안 들은 문장을 셀 수 없다
              `${VOICE_LABEL(target.variant)} 들은 구간 ${percent(target.coverage)}`
            : `${VOICE_LABEL(target.variant)} 들은 구간 ${percent(target.coverage)} · 안 들은 문장 ${
                missing.length > 0 ? missing.join(', ') : '없음(조금씩 빈 곳)'
              }`
      }
      primary={{
        label: '이어서 듣기',
        onClick: () => {
          if (target) onStay(target, firstMissing)
        },
      }}
      secondary={{ label: '그냥 넘어가기', onClick: onGo }}
    />
  )
}

function LessonLoadState({
  query,
}: {
  query: { isError: boolean; error: unknown; fetchStatus: string; refetch: () => unknown }
}) {
  if (!query.isError) {
    if (query.fetchStatus !== 'paused') return null
    return (
      <p className={styles.loadMessage} role="alert">
        {NETWORK_MESSAGE}
      </p>
    )
  }
  const status = query.error instanceof ApiError ? query.error.status : undefined
  if (status === 401) return null
  const clientError = status !== undefined && status >= 400 && status < 500
  return (
    <div className={styles.load}>
      <p className={styles.loadMessage} role="alert">
        {errorMessage(query.error)}
      </p>
      {clientError ? (
        <ButtonLink to="/lessons" variant="secondary">
          회차 목록으로
        </ButtonLink>
      ) : (
        <Button variant="secondary" onClick={() => void query.refetch()}>
          다시 시도
        </Button>
      )}
    </div>
  )
}

// ── 서버 값 → 화면 ──

/** 소리가 안 날 때(카드 안 안내) */
const PLAYER_ERROR: Record<NonNullable<PlayerValue['error']>, string> = {
  blocked: '재생이 멈췄어요. 다시 불러와 주세요',
  load: '소리를 불러오지 못했어요',
}

function passageDone(passage: Passage): boolean {
  return passage.voices.some((v) => v.required && v.completed)
}

function firstUnfinished(data: LessonDetail): number {
  return data.passages.find((p) => !passageDone(p))?.no ?? data.passages[0]?.no ?? 1
}

/** 고른 음성의 트랙, 이 지문에 없으면 첫 트랙 */
function voiceOf(passage: Passage, variant: Variant): Voice | undefined {
  return passage.voices.find((v) => v.variant === variant) ?? passage.voices[0]
}

/** 안내 기준: 완료로 치는 음성(required) 중 가장 많이 들은 것, 같으면 서버 순서(us_w 먼저) */
function mostHeardVoice(passage: Passage): Voice | undefined {
  const candidates = passage.voices.filter((v) => v.required)
  const pool = candidates.length > 0 ? candidates : passage.voices
  if (pool.length === 0) return undefined
  return pool.reduce((best, v) => (v.coverage > best.coverage ? v : best), pool[0])
}

/** 속도 선택 줄의 값(문자열): 1 → "1.0" */
function rateValue(rate: PlaybackRate): string {
  return rate.toFixed(1)
}

/** 서버가 준 들은 구간 + 이 화면에서 들은 구간(서버 값은 다시 받기 전까지 그대로라서) */
function heardRanges(speed: Voice, player: PlayerValue): Array<[number, number]> {
  return mergeRanges([
    ...speed.heardRanges.map(([a, b]): [number, number] => [a, b]),
    ...player.listenedOf(speed.trackId),
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

function applyFlushResult(queryClient: QueryClient, code: string, result: FlushResult) {
  if (result.lesson.code !== code) return
  const before = queryClient.getQueryData<LessonDetail>(lessonQuery(code).queryKey)
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
      passages: before.passages.map((p) => ({
        ...p,
        voices: p.voices.map((v) =>
          v.trackId === result.track.trackId
            ? { ...v, coverage: result.track.coverage, completed: result.track.completed }
            : v,
        ),
      })),
    }
  })
}
