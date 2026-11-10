import { useQuery } from '@tanstack/react-query'
import { Volume2 } from 'lucide-react'
import { useEffect, useMemo, useState, type SubmitEvent } from 'react'
import { useParams } from 'react-router'
import { Button } from '../../shared/ui/Button'
import { ChoiceButton } from '../../shared/ui/ChoiceButton'
import { ModeTabs, type ModeOption } from '../../shared/ui/ModeTabs'
import { ProgressBar } from '../../shared/ui/ProgressBar'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { WordCard } from '../../shared/ui/WordCard'
import { SoundButtons } from './SoundButtons'
import {
  isSpellCorrect,
  memDontKnow,
  memKnow,
  memStart,
  pickChoices,
  POS_LABEL,
  SOURCE_LABEL,
  splitExample,
  type MemState,
} from './study'
import { useStudySaver } from './useStudySaver'
import { useWordAudio } from './useWordAudio'
import { WordsLoadState } from './WordsLoadState'
import { wordsQuery, type Word } from './wordsApi'
import styles from './Words.module.css'

// S-06b 카드 학습(STU-12, 와이어프레임 S06b_ClassCard, ADR-25). 4모드:
// 암기(알아요/몰라요 — 몰라요는 뒤로 다시) · 리콜(단어 보고 뜻 4지선다, 발음 자동 재생) · 스펠(뜻·품사 보고 철자) · 목록(출처별).
// 리콜·스펠 채점은 화면에서(11/6 승인). 모드별 결과는 한 바퀴 끝날 때·떠날 때 저장(03 §2.5)

type Mode = 'mem' | 'recall' | 'spell' | 'list'

const MODES = [
  { id: 'mem' as const, label: '암기', sub: '알아요 · 몰라요' },
  { id: 'recall' as const, label: '리콜', sub: '뜻 고르기' },
  { id: 'spell' as const, label: '스펠', sub: '듣고 쓰기' },
  { id: 'list' as const, label: '목록', sub: '한눈에 보기' },
]

export function CardsPage() {
  const { code = '' } = useParams()
  const words = useQuery(wordsQuery(code))

  if (words.data === undefined) {
    return (
      <StudentLayout>
        <WordsLoadState query={words} />
      </StudentLayout>
    )
  }
  if (words.data.items.length === 0) {
    return (
      <StudentLayout>
        <p className={styles.loadMessage}>이 수업에는 아직 단어가 없어요</p>
      </StudentLayout>
    )
  }
  return <CardsBody code={code} items={words.data.items} />
}

function CardsBody({ code, items }: { code: string; items: Word[] }) {
  const [mode, setMode] = useState<Mode>('mem')
  // "처음부터"는 모든 모드를 새로(모드 상태는 각 모드 안에 — key를 바꿔 새로 만든다)
  const [round, setRound] = useState(0)
  const audio = useWordAudio()
  const saver = useStudySaver(code)

  return (
    <StudentLayout>
      <div className={styles.screen}>
        <header className={styles.header}>
          <div className={styles.headText}>
            <h1 className={styles.title}>카드 학습</h1>
            <p className={styles.sub}>
              {code} · 단어 {items.length}개
            </p>
          </div>
          <Button
            variant="secondary"
            className={styles.reset}
            onClick={() => {
              saver.save()
              audio.stop()
              setRound((r) => r + 1)
            }}
          >
            처음부터
          </Button>
        </header>
        <ModeTabs label="학습 모드" options={MODES} selected={mode} onSelect={setMode} />

        {/* 모드를 바꿔도 각 모드의 진행은 남는다(숨김) */}
        <div hidden={mode !== 'mem'} className={styles.mode}>
          <MemMode
            key={`mem-${round}`}
            items={items}
            active={mode === 'mem'}
            audio={audio}
            saver={saver}
            onGoRecall={() => setMode('recall')}
          />
        </div>
        <div hidden={mode !== 'recall'} className={styles.mode}>
          <RecallMode
            key={`recall-${round}`}
            items={items}
            active={mode === 'recall'}
            audio={audio}
            saver={saver}
          />
        </div>
        <div hidden={mode !== 'spell'} className={styles.mode}>
          <SpellMode key={`spell-${round}`} items={items} audio={audio} saver={saver} />
        </div>
        <div hidden={mode !== 'list'} className={styles.mode}>
          <ListMode items={items} />
        </div>
      </div>
    </StudentLayout>
  )
}

type Audio = ReturnType<typeof useWordAudio>
type Saver = ReturnType<typeof useStudySaver>

function Status({
  left,
  right,
  value,
  max,
}: {
  left: string
  right: string
  value: number
  max: number
}) {
  return (
    <div className={styles.status}>
      <div className={styles.statusRow}>
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <ProgressBar value={value} max={max} label="진행" size="word" />
    </div>
  )
}

// ── 암기 ──

function MemMode({
  items,
  active,
  audio,
  saver,
  onGoRecall,
}: {
  items: Word[]
  active: boolean
  audio: Audio
  saver: Saver
  onGoRecall: () => void
}) {
  const [state, setState] = useState<MemState>(() => memStart(items.length))
  const [side, setSide] = useState<'front' | 'back'>('front')
  const head = state.queue[0]
  const done = head === undefined
  const word = done ? undefined : items[head]

  // 카드가 바뀌면(같은 단어가 다시 와도) 발음 1회
  const { play } = audio
  const turn = state.known + state.unknown
  useEffect(() => {
    if (active && word) play(word.audio?.audioUrl)
    // 카드가 바뀔 때·이 모드로 왔을 때만
  }, [active, turn]) // eslint-disable-line react-hooks/exhaustive-deps

  const { record, save } = saver
  useEffect(() => {
    record({ memKnown: state.known })
    if (done) save()
  }, [state.known, done, record, save])

  function answer(knew: boolean) {
    setSide('front')
    setState((s) => (knew ? memKnow(s) : memDontKnow(s)))
  }

  return (
    <>
      <Status
        left={`알아요 ${state.known} · 몰라요 ${state.unknown}`}
        right={`남은 카드 ${state.queue.length}`}
        value={state.known}
        max={items.length}
      />
      {word === undefined ? (
        <div className={styles.doneBox}>
          <p className={styles.doneTitle}>암기 완료</p>
          <p className={styles.doneBody}>
            {items.length}개 모두 "알아요"를 눌렀어요. 리콜로 확인해 보세요.
          </p>
          <Button onClick={onGoRecall}>리콜 하기</Button>
        </div>
      ) : (
        <>
          <WordCard
            side={side}
            sourceLabel={SOURCE_LABEL[word.source]}
            english={word.english}
            posLabel={POS_LABEL[word.pos]}
            korean={word.korean}
            example={splitExample(word.example, word.english)}
            exampleKo={word.exampleKo}
            autoplay={word.audio !== null && !audio.blocked}
            corner={state.again[head] ? `다시 ${state.again[head]}번째` : undefined}
            onTap={() => setSide('back')}
          />
          <SoundButtons word={word} side={side} blocked={audio.blocked} onPlay={audio.play} />
          <div className={styles.pair}>
            <Button variant="secondary" onClick={() => answer(false)}>
              몰라요
            </Button>
            <Button onClick={() => answer(true)}>알아요</Button>
          </div>
          <p className={styles.hint}>"몰라요"를 누른 단어는 뒤로 보내서 다시 나와요</p>
        </>
      )}
    </>
  )
}

// ── 리콜 ──

function RecallMode({
  items,
  active,
  audio,
  saver,
}: {
  items: Word[]
  active: boolean
  audio: Audio
  saver: Saver
}) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const done = index >= items.length
  // 한 문제의 선택지는 그 문제 동안 그대로(다시 그려도 섞이지 않게)
  const choices = useMemo(() => (done ? [] : pickChoices(items, index)), [items, index, done])
  const word = done ? undefined : items[index]

  const { play } = audio
  useEffect(() => {
    if (active && !done) play(items[index].audio?.audioUrl)
  }, [active, index]) // eslint-disable-line react-hooks/exhaustive-deps

  const { record, save } = saver
  useEffect(() => {
    record({ recallCorrect: score })
    if (done) save()
  }, [score, done, record, save])

  function pick(choice: number) {
    if (picked !== null) return
    setPicked(choice)
    if (choice === index) setScore((s) => s + 1)
  }

  if (word === undefined) {
    return (
      <>
        <Status
          left={`맞힌 문제 ${score}`}
          right={`${items.length} / ${items.length}`}
          value={items.length}
          max={items.length}
        />
        <div className={styles.doneBox}>
          <p className={styles.doneTitle}>
            리콜 결과 {score} / {items.length}
          </p>
          <Button
            onClick={() => {
              setIndex(0)
              setPicked(null)
              setScore(0)
            }}
          >
            다시 하기
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <Status
        left={`맞힌 문제 ${score}`}
        right={`${index + 1} / ${items.length}`}
        value={index + 1}
        max={items.length}
      />
      <div className={styles.quizCard}>
        <span className={styles.chip}>{SOURCE_LABEL[word.source]}</span>
        <span className={styles.quizHint}>알맞은 뜻을 고르세요</span>
        <span className={styles.quizWord} lang="en">
          {word.english}
        </span>
        <span className={styles.pos}>{POS_LABEL[word.pos]}</span>
      </div>
      {audio.blocked && <SoundButtons word={word} side="front" blocked onPlay={audio.play} />}
      <div className={styles.choices} role="group" aria-label="뜻 고르기">
        {choices.map((choice) => (
          <ChoiceButton
            key={choice}
            label={items[choice].korean}
            locked={picked !== null}
            result={
              picked === null
                ? 'none'
                : choice === index
                  ? 'correct'
                  : choice === picked
                    ? 'wrong'
                    : 'none'
            }
            onClick={() => pick(choice)}
          />
        ))}
      </div>
      <Button
        block
        disabled={picked === null}
        onClick={() => {
          setPicked(null)
          setIndex((i) => i + 1)
        }}
      >
        {index === items.length - 1 ? '결과 보기' : '다음'}
      </Button>
    </>
  )
}

// ── 스펠 ──

function SpellMode({ items, audio, saver }: { items: Word[]; audio: Audio; saver: Saver }) {
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [checked, setChecked] = useState(false)
  // 한 단어에서 처음 확인한 것만 센다(틀린 뒤 정답을 보고 고쳐 쓰면 점수가 아니다)
  const [tried, setTried] = useState(false)
  const [score, setScore] = useState(0)
  const done = index >= items.length
  const word = done ? undefined : items[index]
  const correct = word !== undefined && checked && isSpellCorrect(value, word.english)

  const { record, save } = saver
  useEffect(() => {
    record({ spellCorrect: score })
    if (done) save()
  }, [score, done, record, save])

  function check(event?: SubmitEvent) {
    event?.preventDefault()
    if (word === undefined || checked || value.trim() === '') return
    setChecked(true)
    setTried(true)
    if (!tried && isSpellCorrect(value, word.english)) setScore((s) => s + 1)
  }

  function next() {
    setIndex((i) => i + 1)
    setValue('')
    setChecked(false)
    setTried(false)
  }

  if (word === undefined) {
    return (
      <>
        <Status
          left={`맞힌 철자 ${score}`}
          right={`${items.length} / ${items.length}`}
          value={items.length}
          max={items.length}
        />
        <div className={styles.doneBox}>
          <p className={styles.doneTitle}>
            스펠 결과 {score} / {items.length}
          </p>
          <Button
            onClick={() => {
              setIndex(0)
              setValue('')
              setChecked(false)
              setTried(false)
              setScore(0)
            }}
          >
            다시 하기
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <Status
        left={`맞힌 철자 ${score}`}
        right={`${index + 1} / ${items.length}`}
        value={index + 1}
        max={items.length}
      />
      <div className={styles.quizCard}>
        <span className={styles.chip}>{SOURCE_LABEL[word.source]}</span>
        <span className={styles.quizHint}>듣고 철자를 써 보세요</span>
        <span className={styles.quizMeaning}>{word.korean}</span>
        <span className={styles.pos}>{POS_LABEL[word.pos]}</span>
        <Button
          variant="secondary"
          onClick={() => audio.play(word.audio?.audioUrl)}
          disabled={word.audio === null}
        >
          <Volume2 size={18} strokeWidth={2} aria-hidden /> 발음 듣기
        </Button>
      </div>
      <form className={styles.spellForm} onSubmit={check}>
        <label htmlFor="spell-input" className={styles.spellLabel}>
          영어 철자 ({word.english.length}글자)
        </label>
        <input
          id="spell-input"
          className={[styles.spellInput, checked && (correct ? styles.ok : styles.no)]
            .filter(Boolean)
            .join(' ')}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setChecked(false)
          }}
          readOnly={checked && correct}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          lang="en"
          aria-describedby="spell-result"
        />
        <p id="spell-result" className={styles.spellResult} role="status">
          {checked ? (correct ? '✓ 정답' : `✗ 정답: ${word.english}`) : ''}
        </p>
        <div className={styles.pair}>
          <Button type="submit" variant="secondary" disabled={checked || value.trim() === ''}>
            확인
          </Button>
          <Button onClick={next}>{index === items.length - 1 ? '결과 보기' : '다음'}</Button>
        </div>
      </form>
    </>
  )
}

// ── 목록 ──

// 자료에 지문 정보가 없어 출처로 거른다(BE ADR-29). 순서는 서버(교재 순서) 그대로
const LIST_FILTERS: ModeOption<ListFilter>[] = [
  { id: 'all', label: '전체' },
  { id: 'book', label: SOURCE_LABEL.book },
  { id: 'extra', label: SOURCE_LABEL.extra },
]
type ListFilter = 'all' | Word['source']

function ListMode({ items }: { items: Word[] }) {
  const [filter, setFilter] = useState<ListFilter>('all')
  const shown = items.filter((w) => filter === 'all' || w.source === filter)
  return (
    <>
      <Status
        left={filter === 'all' ? '전체' : SOURCE_LABEL[filter]}
        right={`${shown.length}개`}
        value={shown.length}
        max={items.length}
      />
      <ModeTabs label="출처" options={LIST_FILTERS} selected={filter} onSelect={setFilter} />
      <ul className={styles.list}>
        {shown.map((w) => (
          <li key={w.id} className={styles.listItem}>
            <span className={styles.listWord} lang="en">
              {w.english}
            </span>
            <span className={styles.listMeaning}>{w.korean}</span>
            <span className={styles.listMeta}>
              {SOURCE_LABEL[w.source]} · {POS_LABEL[w.pos]}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
