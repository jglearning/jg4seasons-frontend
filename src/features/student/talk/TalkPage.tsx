import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router'
import { ApiError } from '../../../api/errors'
import { bustArt, levelEnglish } from '../../../shared/level'
import { Button, ButtonLink } from '../../../shared/ui/Button'
import { StudentLayout } from '../../../shared/ui/StudentLayout'
import { LoadState } from '../LoadState'
import { homeQuery } from '../studentApi'
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
import { holdScreen, isMicDenied, LevelMeter, requestMic } from './talkDevice'
import styles from './Talk.module.css'

// 캐릭터 프리토킹 1단계(시연용). 시작 전 → 대화 → 요약 / 잠금(구독 없음). 탭 바 없음.
// "캐릭터는 홈에만" 규칙의 예외 화면 — 상반신 그림을 크림 면 위에. 그림은 움직이지 않고
// 말하는 중임은 그림 아래 상태 줄과 음량 막대로만. 말풍선 없이 자막 줄(최근 3줄).
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
    src: bustArt(level.code, home.data.class.book.season),
    alt: `${english ? `${english} ` : ''}${level.nameKo} 단계 캐릭터`,
  }
  return (
    <StudentLayout levelCode={level.code}>
      <Talk config={config.data} art={art} />
    </StudentLayout>
  )
}

type Art = { src: string | undefined; alt: string }

function Talk({ config, art }: { config: TalkConfig; art: Art }) {
  const queryClient = useQueryClient()
  const [stage, setStage] = useState<Stage>('before')
  const [lockedByServer, setLockedByServer] = useState(false)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [starting, setStarting] = useState(false)
  const [topic, setTopic] = useState(config.topics[0]?.code ?? '')
  const [snapshot, setSnapshot] = useState<TalkSnapshot | undefined>()
  const [result, setResult] = useState<TalkSessionResult | null>(null)

  // 다시 시도해도 같은 값(D-2 — 같은 세션에 임시 키만 새로). 대화가 끝나면 새로 만든다
  const clientSessionId = useRef(crypto.randomUUID())
  const audioRef = useRef<HTMLAudioElement>(null)
  const callRef = useRef<TalkCall | undefined>(undefined)
  const meterRef = useRef<LevelMeter | undefined>(undefined)
  const barRef = useRef<HTMLSpanElement>(null)
  const micRef = useRef<MediaStream | undefined>(undefined)

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

  // 화면 이탈: 30초 넘게 숨김 · 탭 닫기(pagehide) · 다른 화면으로(언마운트) — 모두 finish('left')
  useEffect(() => {
    const onVisibility = () => callRef.current?.visibilityChanged(document.hidden)
    const onPageHide = () => void callRef.current?.finish('left', { keepalive: true })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
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

    let mic: MediaStream
    try {
      mic = await requestMic()
    } catch (error) {
      giveUp(isMicDenied(error) ? 'mic' : 'connect')
      return
    }

    let created
    try {
      created = await createTalkSession({
        clientSessionId: clientSessionId.current,
        topic,
      })
    } catch (error) {
      for (const track of mic.getTracks()) track.stop()
      if (error instanceof ApiError && error.status === 403) giveUp('locked')
      else if (error instanceof ApiError && error.status === 429) giveUp('limit')
      else giveUp('connect')
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
    } catch {
      callRef.current = undefined
      giveUp('connect')
      return
    }
    setStarting(false)
  }, [starting, topic, ended])

  // 음량 막대 요소가 그려진 뒤 붙인다
  useEffect(() => {
    meterRef.current?.attachBar(barRef.current)
  }, [stage])

  // 음량 막대: 캐릭터가 말하는 중이면 캐릭터 소리, 아니면 학생 마이크
  const speaking = snapshot?.phase === 'speaking'
  useEffect(() => {
    const audio = audioRef.current
    const source = audio?.srcObject
    const remote =
      typeof MediaStream !== 'undefined' && source instanceof MediaStream ? source : null
    meterRef.current?.listen(speaking ? remote : (micRef.current ?? null))
  }, [speaking])

  return (
    <div className={styles.screen}>
      {/* 캐릭터 소리 — 보이지 않는 요소. 탭 안에서 play()를 불러 둬야 아이폰에서 소리가 난다 */}
      <audio ref={audioRef} autoPlay playsInline className={styles.audio} />
      {locked ? (
        <LockedView art={art} />
      ) : stage === 'summary' ? (
        <SummaryView art={art} result={result} />
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

function Character({ art, compact = false }: { art: Art; compact?: boolean }) {
  return (
    <div className={compact ? `${styles.face} ${styles.faceCompact}` : styles.face}>
      {art.src && <img className={styles.art} src={art.src} alt={art.alt} />}
    </div>
  )
}

function LockedView({ art }: { art: Art }) {
  return (
    <>
      <Character art={art} />
      <div className={styles.message}>
        <p className={styles.messageTitle}>구독하면 캐릭터와 영어로 말할 수 있어요</p>
        <p className={styles.messageSub}>선생님께 물어봐요</p>
      </div>
      <div className={styles.bottom}>
        <ButtonLink to="/" variant="secondary" block>
          홈으로
        </ButtonLink>
      </div>
    </>
  )
}

type BeforeProps = {
  art: Art
  config: TalkConfig
  topic: string
  onTopic: (code: string) => void
  failure: Failure | null
  starting: boolean
  onStart: () => void
}

function BeforeView({ art, config, topic, onTopic, failure, starting, onStart }: BeforeProps) {
  const noneLeft = config.remainingToday <= 0 || failure === 'limit'
  return (
    <>
      <h1 className={styles.title}>프리토킹</h1>
      <Character art={art} compact />
      <fieldset className={styles.topics}>
        <legend className={styles.label}>무엇을 이야기할까요</legend>
        {config.topics.map((item) => (
          <label key={item.code} className={styles.topic}>
            <input
              type="radio"
              name="talk-topic"
              value={item.code}
              checked={topic === item.code}
              onChange={() => onTopic(item.code)}
              className={styles.topicInput}
            />
            <span className={styles.topicText}>{item.title}</span>
          </label>
        ))}
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
          {noneLeft ? '오늘은 세 번 다 했어요' : `오늘 ${config.remainingToday}번 더 할 수 있어요`}
        </p>
        <Button block onClick={onStart} disabled={noneLeft || starting}>
          {failure === 'connect' ? '다시 시도' : '시작하기'}
        </Button>
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

function SummaryView({ art, result }: { art: Art; result: TalkSessionResult | null }) {
  const summary = result?.summary ?? null
  return (
    <>
      <Character art={art} compact />
      {result && (
        <div className={styles.summaryHead}>
          <h1 className={styles.summaryTitle}>{duration(result.durationSec)} 동안 말했어요</h1>
          <p className={styles.messageSub}>내가 말한 문장 {result.studentTurnCount}개</p>
        </div>
      )}
      {summary ? (
        <>
          {summary.goodExpressions.length > 0 && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>잘 쓴 표현</h2>
              <ul className={styles.list}>
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
              <ul className={styles.list}>
                {summary.corrections.map((item) => (
                  <li key={item.said} className={styles.correction}>
                    <p className={styles.said}>{item.said}</p>
                    <p className={styles.better}>{item.better}</p>
                    <p className={styles.note}>{item.note}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <p className={styles.messageTitle}>오늘 대화는 여기까지예요</p>
      )}
      <div className={styles.bottom}>
        <ButtonLink to="/" block>
          홈으로
        </ButtonLink>
        <p className={styles.footnote}>시험 삼아 여는 기능이에요</p>
      </div>
    </>
  )
}
