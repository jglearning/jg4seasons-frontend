import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { ApiError } from '../../../api/errors'
import { coverArt, levelEnglish } from '../../../shared/level'
import { Button, ButtonLink } from '../../../shared/ui/Button'
import { StudentLayout } from '../../../shared/ui/StudentLayout'
import { LoadState } from '../LoadState'
import { homeQuery } from '../studentApi'
import { ArrowRight, Check, Lock } from 'lucide-react'
import { CallView } from './CallView'
import { connectRealtime } from './realtime'
import {
  createTalkSession,
  endTalkSession,
  talkConfigQuery,
  type TalkConfig,
  type TalkSessionResult,
} from './talkApi'
import { TalkCall, type TalkSnapshot } from './talkCall'
import { TalkCover, type Art } from './TalkCover'
import { holdScreen, isMicDenied, LevelMeter, requestMic } from './talkDevice'
import styles from './Talk.module.css'

// 캐릭터 프리토킹 1단계(시연용). 시작 전 → 대화 → 요약 / 잠금(구독 없음). 탭 바 없음.
// "캐릭터는 홈에만" 규칙의 예외 화면 — 홈 표지와 같은 그림을 레벨 바탕 위에(움직이지 않음, 시안 11/26 · TalkCover.tsx).
// 대화 화면(연결 중·대화·끝내기 확인)은 CallView.tsx.
// 기능이 꺼진 학원(404 FEATURE_DISABLED)은 홈으로 보낸다(홈에도 진입 줄이 없다).
// 목소리는 고르지 않는다 — 캐릭터(레벨)에 맞춰 서버가 정한다(11/25 동섭)

type Stage = 'before' | 'call' | 'summary'
type Failure = 'mic' | 'connect' | 'limit'

export function TalkPage() {
  const home = useQuery(homeQuery)
  const config = useQuery(talkConfigQuery())

  if (config.error instanceof ApiError && config.error.code === 'FEATURE_DISABLED') {
    return <Navigate to="/" replace />
  }
  if (home.data === undefined || config.data === undefined) {
    return (
      <StudentLayout levelCode={home.data?.class.level.code}>
        <div className={styles.screen}>
          <LoadState query={home.data === undefined ? home : config} homeLink />
        </div>
      </StudentLayout>
    )
  }

  const level = home.data.class.level
  const english = levelEnglish(level.code)
  const art = {
    src: coverArt(level.code, home.data.class.book.season),
    alt: `${english ? `${english} ` : ''}${level.nameKo} 단계 캐릭터`,
  }
  // 시작 전 큰 카드의 "Reading Day 5 단어가 대화에 나와요" — 홈 머리와 같은 회차(오늘, 개강 전이면 첫 수업)
  const lessonTitle = (home.data.today?.lesson ?? home.data.next?.lesson)?.title
  return (
    <StudentLayout levelCode={level.code}>
      <Talk config={config.data} art={art} lessonTitle={lessonTitle} />
    </StudentLayout>
  )
}

/** 큰 카드로 그리는 주제(서버 topics의 code) — 나머지는 알약 버튼 */
const LESSON_TOPIC = 'lesson'

/** 처음 고른 주제: 회차 단어 주제. 회차 단어가 없으면 다른 주제의 첫 번째(시안 11/26) */
function firstTopic(config: TalkConfig): string {
  const others = config.topics.filter((t) => t.code !== LESSON_TOPIC)
  if (config.lessonWords.length === 0 && others.length > 0) return others[0].code
  return config.topics[0]?.code ?? ''
}

type TalkProps = { config: TalkConfig; art: Art; lessonTitle: string | undefined }

function Talk({ config, art, lessonTitle }: TalkProps) {
  const queryClient = useQueryClient()
  const [stage, setStage] = useState<Stage>('before')
  const [lockedByServer, setLockedByServer] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [starting, setStarting] = useState(false)
  const [topic, setTopic] = useState(() => firstTopic(config))
  const [snapshot, setSnapshot] = useState<TalkSnapshot | undefined>()
  const [result, setResult] = useState<TalkSessionResult | null>(null)

  // 다시 시도해도 같은 값(D-2 — 같은 세션에 임시 키만 새로). 대화가 끝나면 새로 만든다
  const clientSessionId = useRef(crypto.randomUUID())
  const audioRef = useRef<HTMLAudioElement>(null)
  const callRef = useRef<TalkCall | undefined>(undefined)
  const meterRef = useRef<LevelMeter | undefined>(undefined)
  const micRef = useRef<MediaStream | undefined>(undefined)
  const alive = useRef(true)
  const navigate = useNavigate()

  const locked = !config.entitled || lockedByServer

  // 대화가 끝남(종료 요청 응답 또는 실패) → 요약. 남은 횟수는 새로 받는다
  const ended = useCallback(
    (last: TalkSnapshot) => {
      meterRef.current?.close()
      meterRef.current = undefined
      callRef.current = undefined
      clientSessionId.current = crypto.randomUUID()
      setResult(last.result ?? null)
      setStage('summary')
      void queryClient.invalidateQueries({ queryKey: talkConfigQuery().queryKey })
    },
    [queryClient],
  )

  // 화면 이탈: 30초 넘게 숨김 · 탭 닫기(pagehide) · 다른 화면으로(언마운트) — 모두 finish('left').
  // start()는 마이크 허락·세션 생성을 기다리는 동안 callRef가 비어 있어, 그 사이에 떠나면 정리할 대상이 없다 —
  // alive로 떠났는지 들고 start()가 await마다 확인해 스스로 멈춘다(리뷰 11/25)
  useEffect(() => {
    alive.current = true
    const onVisibility = () => callRef.current?.visibilityChanged(document.hidden)
    const onPageHide = () => void callRef.current?.finish('left', { keepalive: true })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      alive.current = false
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      void callRef.current?.finish('left', { keepalive: true })
      meterRef.current?.close()
    }
  }, [])

  const start = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || starting) return
    setFailure(null)
    setStarting(true)
    // 탭 안에서 바로: 소리 재생 허락(아이폰)과 음량 막대의 AudioContext
    void audio.play()?.catch(() => undefined)
    const meter = new LevelMeter()
    meterRef.current = meter

    const giveUp = (reason: Failure | 'locked') => {
      meter.close()
      meterRef.current = undefined
      setStarting(false)
      setStage('before')
      if (reason === 'locked') setLockedByServer(true)
      else setFailure(reason)
    }

    const stopMic = (stream: MediaStream) => {
      for (const track of stream.getTracks()) track.stop()
    }

    let mic: MediaStream
    try {
      mic = await requestMic()
    } catch (error) {
      if (!isMicDenied(error))
        console.warn('[talk] 마이크 실패', { name: (error as { name?: string }).name })
      giveUp(isMicDenied(error) ? 'mic' : 'connect')
      return
    }
    if (!alive.current) {
      stopMic(mic)
      meter.close()
      return
    }

    let created
    try {
      created = await createTalkSession({
        clientSessionId: clientSessionId.current,
        topic,
      })
    } catch (error) {
      stopMic(mic)
      const code = error instanceof ApiError ? error.code : undefined
      if (code === 'FEATURE_DISABLED') {
        meter.close()
        void navigate('/', { replace: true })
      } else if (code === 'SUBSCRIPTION_REQUIRED') giveUp('locked')
      else if (code === 'DAILY_LIMIT') giveUp('limit')
      else {
        // 사용 기간 아님(LICENSE_INACTIVE)·5xx·끊김 등 — 학생에게는 연결 실패 문구, 원인은 기록(임시 키가 든 응답은 찍지 않는다)
        console.error('[talk] 세션 생성 실패', {
          status: error instanceof ApiError ? error.status : undefined,
          code,
          requestId: error instanceof ApiError ? error.requestId : undefined,
          name: (error as { name?: string }).name,
        })
        giveUp('connect')
      }
      return
    }
    if (!alive.current) {
      // 이미 만든 세션은 0초로 닫는다(서버에 created로 남지 않게)
      stopMic(mic)
      meter.close()
      void endTalkSession(
        created.id,
        { durationSec: 0, endReason: 'left', turns: [] },
        { keepalive: true },
      ).catch(() => undefined)
      return
    }

    const call = new TalkCall({
      sessionId: created.id,
      maxSeconds: created.maxSeconds,
      mic,
      closingInstruction: created.realtime.closingInstruction,
      connect: (handlers) =>
        connectRealtime({
          clientSecret: created.realtime.clientSecret,
          url: created.realtime.url,
          mic,
          audio,
          handlers,
        }),
      end: (body, options) => endTalkSession(created.id, body, options),
      onChange: (next) => {
        setSnapshot(next)
        if (next.phase === 'ended') ended(next)
      },
      holdScreen,
    })
    callRef.current = call
    micRef.current = mic
    setSnapshot(call.state)
    setStage('call')
    meter.listen(mic)
    try {
      await call.start()
      await call.whenOpen()
    } catch (error) {
      // 연결 중에 학생이 끊었으면 이미 요약으로 넘어갔다 — 연결 실패로 덮지 않는다(리뷰 11/25)
      if (call.state.phase === 'ending' || call.state.phase === 'ended') {
        setStarting(false)
        return
      }
      console.error('[talk] 연결 실패', {
        sessionId: created.id,
        name: (error as { name?: string }).name,
        message: (error as { message?: string }).message,
      })
      callRef.current = undefined
      giveUp('connect')
      return
    }
    setStarting(false)
  }, [starting, topic, ended, navigate])

  // 음량 막대 요소는 연결된 뒤(③④)에야 그려진다 — 그려지는 순간 붙인다(콜백 ref)
  const barRef = useCallback((bar: HTMLSpanElement | null) => {
    meterRef.current?.attachBar(bar)
  }, [])

  // 음량 막대: 캐릭터가 말하는 중이면 캐릭터 소리, 아니면 학생 마이크
  const speaking = snapshot?.phase === 'speaking'
  useEffect(() => {
    const audio = audioRef.current
    const source = audio?.srcObject
    const remote =
      typeof MediaStream !== 'undefined' && source instanceof MediaStream ? source : null
    meterRef.current?.listen(speaking ? remote : (micRef.current ?? null))
  }, [speaking])

  const topicTitle = config.topics.find((t) => t.code === topic)?.title

  return (
    <div className={stage === 'call' && !locked ? styles.screenCall : styles.screen}>
      {/* 캐릭터 소리 — 보이지 않는 요소. 탭 안에서 play()를 불러 둬야 아이폰에서 소리가 난다 */}
      <audio ref={audioRef} autoPlay playsInline className={styles.audio} />
      {locked ? (
        <LockedView art={art} />
      ) : stage === 'summary' ? (
        <SummaryView result={result} topicTitle={topicTitle} />
      ) : stage === 'call' && snapshot ? (
        <CallView
          art={art}
          snapshot={snapshot}
          lessonWords={config.lessonWords}
          barRef={barRef}
          onEnd={() => void callRef.current?.finish('user')}
        />
      ) : (
        <BeforeView
          art={art}
          config={config}
          lessonTitle={lessonTitle}
          topic={topic}
          onTopic={setTopic}
          failure={failure}
          starting={starting}
          onStart={() => void start()}
        />
      )}
    </div>
  )
}

/** ⑦ 잠금 — 위 레벨 바탕 면(그림 + 뒤로), 아래 "프리미엄" 칩 + 안내, 맨 아래 홈으로 */
function LockedView({ art }: { art: Art }) {
  return (
    <>
      <TalkCover art={art} variant="stage" back />
      <div className={styles.body}>
        <p className={styles.premium}>
          <Lock size={16} strokeWidth={2} aria-hidden />
          프리미엄
        </p>
        <h1 className={styles.lockTitle}>
          구독하면 캐릭터와 <br />
          영어로 말할 수 있어요
        </h1>
        <p className={styles.lockSub}>선생님께 물어봐요</p>
        <div className={styles.bottom}>
          <ButtonLink to="/" variant="secondary" block>
            홈으로
          </ButtonLink>
        </div>
      </div>
    </>
  )
}

type BeforeProps = {
  art: Art
  config: TalkConfig
  lessonTitle: string | undefined
  topic: string
  onTopic: (code: string) => void
  failure: Failure | null
  starting: boolean
  onStart: () => void
}

/** 큰 카드에 미리 보이는 회차 단어 수 — 나머지는 "+54"처럼 수로 */
const PREVIEW_WORDS = 3

/**
 * ① 시작 전 — 레벨 바탕 머리(그림·뒤로·제목) / 주제 고르기: 회차 단어 주제는 큰 카드, 다른 주제는 알약 버튼 나란히.
 * 셋 다 한 radiogroup(같은 name의 radio — 화살표로 이동). 고른 것은 2px 레벨 진한 색 테두리 + 눌린 자리(턱 없음)
 */
function BeforeView({
  art,
  config,
  lessonTitle,
  topic,
  onTopic,
  failure,
  starting,
  onStart,
}: BeforeProps) {
  const noneLeft = config.remainingToday <= 0 || failure === 'limit'
  const lesson = config.topics.find((t) => t.code === LESSON_TOPIC)
  const others = config.topics.filter((t) => t.code !== LESSON_TOPIC)
  const words = config.lessonWords
  const more = words.length - PREVIEW_WORDS

  return (
    <>
      <TalkCover art={art} variant="head" back>
        <div className={styles.headText}>
          <h1 className={styles.headTitle}>프리토킹</h1>
          <p className={styles.headSub}>
            {duration(config.maxSeconds)} 동안
            <br />
            영어로 말해요
          </p>
        </div>
      </TalkCover>

      <div className={styles.body}>
        <fieldset className={styles.topics}>
          <legend className={styles.label}>무엇을 이야기할까요</legend>
          {lesson && (
            <label className={styles.lessonCard}>
              <input
                type="radio"
                name="talk-topic"
                value={lesson.code}
                checked={topic === lesson.code}
                onChange={() => onTopic(lesson.code)}
                className={styles.topicInput}
              />
              <span className={styles.lessonCardHead}>
                <span className={styles.lessonCardText}>
                  <span className={styles.lessonCardTitle}>{lesson.title}</span>
                  <span className={styles.lessonCardSub}>
                    {words.length === 0
                      ? '오늘 회차 단어가 아직 없어요'
                      : `${lessonTitle ?? '오늘 회차'} 단어가 대화에 나와요`}
                  </span>
                </span>
                <Check size={24} strokeWidth={3} className={styles.check} aria-hidden />
              </span>
              {words.length > 0 && (
                <span className={styles.chips} aria-hidden>
                  {words.slice(0, PREVIEW_WORDS).map((word) => (
                    <span key={word.english} className={styles.chip}>
                      {word.english}
                    </span>
                  ))}
                  {more > 0 && <span className={styles.chipMore}>+{more}</span>}
                </span>
              )}
            </label>
          )}
          {others.length > 0 && (
            <div className={styles.otherTopics}>
              {lesson && (
                <span className={styles.otherLabel} aria-hidden>
                  다른 주제
                </span>
              )}
              <div className={styles.pills}>
                {others.map((item) => (
                  <label key={item.code} className={styles.pill}>
                    <input
                      type="radio"
                      name="talk-topic"
                      value={item.code}
                      checked={topic === item.code}
                      onChange={() => onTopic(item.code)}
                      className={styles.topicInput}
                    />
                    <span>{item.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </fieldset>

        {failure === 'mic' && (
          <div role="alert" className={styles.alert}>
            <p className={styles.alertTitle}>마이크를 켜야 말할 수 있어요</p>
            <p className={styles.alertSub}>주소창 옆 설정에서 마이크를 허용하고 다시 눌러요</p>
          </div>
        )}
        {failure === 'connect' && (
          <div role="alert" className={styles.alert}>
            <p className={styles.alertTitle}>연결하지 못했어요. 다시 해 봐요</p>
          </div>
        )}

        <div className={styles.bottom}>
          <p className={styles.remaining}>
            {noneLeft
              ? '오늘은 세 번 다 했어요'
              : `오늘 ${config.remainingToday}번 더 할 수 있어요`}
          </p>
          <Button block onClick={onStart} disabled={noneLeft || starting}>
            {failure === 'connect' ? '다시 시도' : '시작하기'}
          </Button>
        </div>
      </div>
    </>
  )
}

function duration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}초`
  return s === 0 ? `${m}분` : `${m}분 ${s}초`
}

type SummaryProps = { result: TalkSessionResult | null; topicTitle: string | undefined }

/** ⑥ 요약 — 그림 없음. 말한 시간·문장 수·주제 → 잘 쓴 표현(칩) → 이렇게도 말해 봐요(내 문장 → 고친 문장 → 설명) */
function SummaryView({ result, topicTitle }: SummaryProps) {
  const summary = result?.summary ?? null
  return (
    <div className={`${styles.body} ${styles.summary}`}>
      {result && (
        <div className={styles.summaryHead}>
          <h1 className={styles.summaryTitle}>
            {duration(result.durationSec)} 동안 <br />
            말했어요
          </h1>
          <p className={styles.summarySub}>
            내가 말한 문장 {result.studentTurnCount}개{topicTitle ? ` · ${topicTitle}` : ''}
          </p>
        </div>
      )}
      {summary ? (
        <>
          {summary.goodExpressions.length > 0 && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>잘 쓴 표현</h2>
              <ul className={styles.expressions}>
                {summary.goodExpressions.map((expression) => (
                  <li key={expression} className={styles.expression}>
                    {expression}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {summary.corrections.length > 0 && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>이렇게도 말해 봐요</h2>
              <ul className={styles.corrections}>
                {summary.corrections.map((item) => (
                  <li key={item.said} className={styles.correction}>
                    <p className={styles.said}>{item.said}</p>
                    <p className={styles.better}>
                      <ArrowRight
                        size={18}
                        strokeWidth={2.5}
                        className={styles.betterIcon}
                        aria-hidden
                      />
                      <span className={styles.srOnly}>고친 문장: </span>
                      <span>{item.better}</span>
                    </p>
                    <p className={styles.note}>{item.note}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <p className={styles.summaryEmpty}>오늘 대화는 여기까지예요</p>
      )}
      <div className={styles.bottom}>
        <ButtonLink to="/" block>
          홈으로
        </ButtonLink>
        <p className={styles.footnote}>시험 삼아 여는 기능이에요</p>
      </div>
    </div>
  )
}
