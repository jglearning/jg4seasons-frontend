import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { ApiError } from '../../api/errors'
import { errorMessage, NETWORK_MESSAGE } from '../../shared/errorMessage'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { NudgeCard } from '../../shared/ui/NudgeCard'
import { PassageTabs } from '../../shared/ui/PassageTabs'
import { Player } from '../../shared/ui/Player'
import { ReviewLock } from '../../shared/ui/ReviewLock'
import { SentenceRow } from '../../shared/ui/SentenceRow'
import { SpeedSegment } from '../../shared/ui/SpeedSegment'
import { StepTabs } from '../../shared/ui/StepTabs'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { TestCard } from '../../shared/ui/TestCard'
import type { FlushResult } from './flushApi'
import { lessonQuery, type LessonDetail, type Passage, type Speed } from './lessonApi'
import { mergeRanges } from './listeningTracker'
import { usePlayer, type PlayerValue, type Source, type Variant } from './player'
import { PlayerProvider } from './PlayerProvider'
import { heardSentences } from './sentenceSync'
import { useSentenceSync } from './useSentenceSync'
import styles from './LessonPage.module.css'

// S-05 회차 듣기(STU-04·05·06·11, 와이어프레임 S05_Player 11/6, ADR-26 따라 읽기).
// 단계 탭: 테스트(기본 — 본문 없이 책을 펴고 듣기) | 복습(본문 따라 읽기, 지문을 다 들어야 열림 — 서버 completion 값).
// 지문 음원 하나를 들으며 지금 문장을 강조하고, 문장을 누르면 그 위치로 옮긴다.
// 완료·청취율·문장 시각은 모두 서버 값 — 화면은 보여 주기만 한다("들음" 점은 표시용 80% 규칙, 03 §2.3)

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
type Step = 'test' | 'review'

function LessonBody({ code, data }: { code: string; data: LessonDetail }) {
  const player = usePlayer()
  const [selectedNo, setSelectedNo] = useState(() => firstUnfinished(data))
  const passage = data.passages.find((p) => p.no === selectedNo) ?? data.passages[0]
  const [variant, setVariant] = useState<Variant>(() => requiredVariant(passage))
  const [nudge, setNudge] = useState<Nudge | null>(null)
  const [step, setStep] = useState<Step>('test')
  // 복습은 회차의 지문을 다 들었을 때만(서버 값 — 클라이언트가 세지 않는다)
  const reviewOpen =
    data.completion.passagesTotal > 0 &&
    data.completion.passagesDone === data.completion.passagesTotal
  const listRef = useRef<HTMLOListElement>(null)

  const speed = passage.speeds.find((s) => s.variant === variant) ?? passage.speeds[0]
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
  const heard = speed ? heardSentences(timings, heardRanges(speed, player)) : []
  const sentenceCount = passage.sentences.length
  const at = Math.max(current, 0)
  // timings가 []면 문장 시각이 아직 없다(BE #18) — 강조·문장 이동 없이 재생만
  const hasTimings = timings.length > 0
  const atSentence = started && hasTimings

  // 지문을 고르면 그 지문 음원(지금 속도)을 올려 둔다(바로 재생하지는 않는다)
  const { load } = player
  useEffect(() => {
    const target = data.passages.find((p) => p.no === selectedNo)
    const next = target?.speeds.find((s) => s.variant === variant) ?? target?.speeds[0]
    if (target === undefined || next === undefined) return
    load(passageSource(target, next))
    // 지문을 바꿀 때만 다시 올린다(데이터 갱신 때마다 올리지 않게. 속도는 selectVariant가 올린다)
  }, [selectedNo]) // eslint-disable-line react-hooks/exhaustive-deps

  function selectPassage(no: number) {
    setNudge(null)
    setSelectedNo(no)
  }

  /** 속도는 파일 선택 — 같은 문장의 새 속도 시작 시각으로 옮겨 이어 듣는다 */
  function selectVariant(next: Variant, options: { from?: number; play?: boolean } = {}) {
    const target = passage.speeds.find((s) => s.variant === next)
    if (target === undefined) return
    const index = options.from ?? (started ? at : 0)
    setVariant(target.variant)
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

  /** 재생 상태는 그대로 두고 문장만 옮긴다(이전·다음 문장) */
  function moveTo(index: number) {
    player.seekTo(timings[index]?.[0] ?? 0)
  }

  const next = data.passages.find((p) => p.no === selectedNo + 1)
  const done = passageDone(passage)
  const unfinished = data.passages.filter((p) => !passageDone(p))

  function selectStep(next: Step) {
    setNudge(null)
    setStep(next)
  }

  function goNext() {
    if (next === undefined) return
    if (done) selectPassage(next.no)
    else setNudge('next')
  }

  const wordsTo = `/lessons/${code}/cards`
  const durationMs = onThisTrack ? player.durationMs : (speed?.durationMs ?? 0)

  return (
    <StudentLayout levelColorHex={data.level.colorHex}>
      <header className={styles.header}>
        <h1 className={styles.title}>{data.lesson.title}</h1>
        <p className={styles.summary}>
          지문 듣기 {data.completion.passagesDone} / {data.completion.passagesTotal}
        </p>
      </header>

      <PassageTabs
        tabs={data.passages.map((p) => ({ no: p.no, done: passageDone(p) }))}
        selected={selectedNo}
        onSelect={selectPassage}
      />

      <section className={styles.passage} aria-labelledby="passage-title">
        <StepTabs
          label="듣기 방식"
          tabs={[
            { id: 'test', label: '테스트 듣기 · 책 보고' },
            reviewOpen
              ? { id: 'review', label: '복습 · 본문 보며' }
              : {
                  id: 'review',
                  label: `복습 · 잠김 ${data.completion.passagesDone}/${data.completion.passagesTotal}`,
                  muted: true,
                },
          ]}
          selected={step}
          onSelect={selectStep}
        />
        <div className={styles.passageHead}>
          <div className={styles.passageName}>
            <p className={styles.eyebrow}>
              지문 {passage.no} · {passage.wordCount}단어
            </p>
            <h2 id="passage-title" className={styles.passageTitle}>
              {passage.title}
            </h2>
          </div>
          <SpeedSegment
            options={passage.speeds.map((s) => ({ variant: s.variant, required: s.required }))}
            selected={variant}
            onSelect={(v) => {
              if (v !== variant) selectVariant(v)
            }}
            disabled={player.source === null}
          />
        </div>

        <Button className={styles.fromStart} onClick={() => playFrom(0)} disabled={!speed}>
          처음부터 듣기 · {clock(speed?.durationMs ?? 0)}
        </Button>

        {step === 'test' ? (
          <TestCard
            passageNo={passage.no}
            position={
              atSentence ? `문장 ${at + 1} / ${sentenceCount}` : `전체 ${clock(durationMs)}`
            }
            onReplay={() => playFrom(at)}
            onPrevious={() => playFrom(Math.max(at - 1, 0))}
            previousDisabled={at <= 0}
            disabled={!speed || !hasTimings}
          />
        ) : reviewOpen ? (
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
        ) : (
          <ReviewLock
            done={data.completion.passagesDone}
            total={data.completion.passagesTotal}
            remaining={unfinished.map((p) => p.no)}
            onGoTest={() => selectStep('test')}
          />
        )}
      </section>

      <div className={styles.after}>
        {next ? (
          <Button variant={done ? 'primary' : 'secondary'} block onClick={goNext}>
            다음 지문 →
          </Button>
        ) : (
          <div className={styles.last}>
            <p className={styles.lastTitle}>마지막 지문이에요</p>
            <p className={styles.lastBody}>다음은 이 수업의 단어 {data.words.total}개예요.</p>
            <ButtonLink
              to={wordsTo}
              block
              onClick={(event) => {
                if (unfinished.length === 0) return
                event.preventDefault()
                setNudge('words')
              }}
            >
              오늘의 단어 학습하기 →
            </ButtonLink>
          </div>
        )}
      </div>

      <Player
        title={
          atSentence
            ? `지문 ${passage.no} · 문장 ${at + 1} / ${sentenceCount} · ${variant}×`
            : `지문 ${passage.no} 전체 · ${clock(durationMs)} · ${variant}×`
        }
        aside={speed ? `들은 구간 ${percent(speed.coverage)}` : undefined}
        playing={player.playing}
        positionMs={positionMs}
        durationMs={durationMs}
        listened={speed ? heardRanges(speed, player) : []}
        onToggle={player.toggle}
        onPrev={() => moveTo(Math.max(at - 1, 0))}
        onNext={() => moveTo(Math.min(at + 1, sentenceCount - 1))}
        onSeek={player.seekTo}
        prevDisabled={!hasTimings || at <= 0}
        nextDisabled={!hasTimings || at >= sentenceCount - 1}
        error={
          player.error === null
            ? undefined
            : { message: PLAYER_ERROR[player.error], onRetry: player.retry }
        }
        disabled={player.source === null}
        overlay={
          nudge === 'next' && next ? (
            <NextNudge
              passage={passage}
              player={player}
              onStay={(target, index) => {
                setNudge(null)
                // 문장 시각이 없으면 문장으로 옮기지 않고 지금 자리에서 이어 듣는다
                if (target.variant !== variant)
                  selectVariant(target.variant, { from: index, play: true })
                else if (target.timings.length > 0) playFrom(index)
                else player.play()
              }}
              onGo={() => selectPassage(next.no)}
            />
          ) : nudge === 'words' && unfinished.length > 0 ? (
            <NudgeCard
              title="아직 완료 안 된 지문이 있어요"
              body={`완료 안 된 지문: ${unfinished.map((p) => p.no).join(', ')} · ${requiredLabel(unfinished)}로 끝까지 들으면 완료돼요`}
              primary={{ label: '마저 듣기', onClick: () => selectPassage(unfinished[0].no) }}
              secondary={{ label: '그래도 단어로', to: wordsTo }}
            />
          ) : undefined
        }
      />
    </StudentLayout>
  )
}

/** 완료 안 된 지문에서 "다음 지문"을 누르면: 필수 속도 트랙의 들은 구간과 안 들은 문장 */
function NextNudge({
  passage,
  player,
  onStay,
  onGo,
}: {
  passage: Passage
  player: PlayerValue
  onStay: (speed: Speed, sentenceIndex: number) => void
  onGo: () => void
}) {
  // 필수 속도는 서버 required에서(숫자 고정 금지). 둘 이상이면(민트 0.8·1.0) 많이 들은 쪽
  const required = passage.speeds
    .filter((s) => s.required)
    .sort((a, b) => b.coverage - a.coverage)[0]
  const target = required ?? passage.speeds[0]
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
              `${target.variant}× 들은 구간 ${percent(target.coverage)}`
            : `${target.variant}× 들은 구간 ${percent(target.coverage)} · 안 들은 문장 ${
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

/** 소리가 안 날 때(플레이어 안내) */
const PLAYER_ERROR: Record<NonNullable<PlayerValue['error']>, string> = {
  blocked: '재생이 멈췄어요. 다시 불러와 주세요',
  load: '소리를 불러오지 못했어요',
}

function passageDone(passage: Passage): boolean {
  return passage.speeds.some((s) => s.required && s.completed)
}

function firstUnfinished(data: LessonDetail): number {
  return data.passages.find((p) => !passageDone(p))?.no ?? data.passages[0]?.no ?? 1
}

function requiredVariant(passage: Passage | undefined): Variant {
  return passage?.speeds.find((s) => s.required)?.variant ?? '1.0'
}

/** 완료 안 된 지문들의 필수 속도: "1.0×" / "0.8× 또는 1.0×" */
function requiredLabel(passages: Passage[]): string {
  const variants = new Set(passages.flatMap((p) => p.speeds.filter((s) => s.required)))
  const labels = [...new Set([...variants].map((s) => s.variant))].sort()
  return labels.length > 0 ? labels.map((v) => `${v}×`).join(' 또는 ') : '필수 속도'
}

/** 서버가 준 들은 구간 + 이 화면에서 들은 구간(서버 값은 다시 받기 전까지 그대로라서) */
function heardRanges(speed: Speed, player: PlayerValue): Array<[number, number]> {
  return mergeRanges([
    ...speed.heardRanges.map(([a, b]): [number, number] => [a, b]),
    ...player.listenedOf(speed.trackId),
  ])
}

/** 서버 coverage(0~1) → "72%". 내림 — 완료 전에 100%로 보이지 않게 */
function percent(coverage: number): string {
  return `${Math.floor(Math.min(Math.max(coverage, 0), 1) * 100)}%`
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

function passageSource(passage: Passage, speed: Speed): Source {
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
        speeds: p.speeds.map((s) =>
          s.trackId === result.track.trackId
            ? { ...s, coverage: result.track.coverage, completed: result.track.completed }
            : s,
        ),
      })),
    }
  })
}
