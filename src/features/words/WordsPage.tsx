import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { ProgressBar } from '../../shared/ui/ProgressBar'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { WordCard } from '../../shared/ui/WordCard'
import { POS_LABEL, splitExample } from './study'
import { useStudySaver } from './useStudySaver'
import { SoundButtons } from './SoundButtons'
import { useWordAudio } from './useWordAudio'
import { WordsLoadState } from './WordsLoadState'
import { wordsQuery, type Word } from './wordsApi'
import styles from './Words.module.css'

// S-06 단어 카드(STU-07, 와이어프레임 S06_Words, ADR-15·25).
// 카드가 나오면 발음 1회 자동 재생(막히면 "눌러서 듣기"), 탭하면 뜻·품사·예문·해석, 한 번 더 탭하면 다음 단어.
// 본 카드 수(가장 멀리 간 번호)는 떠날 때·마지막 카드에서 저장한다(03 §2.5)

export function WordsPage() {
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
  return <WordsBody code={code} items={words.data.items} />
}

function WordsBody({ code, items }: { code: string; items: Word[] }) {
  const navigate = useNavigate()
  const total = items.length
  const [index, setIndex] = useState(0)
  const [side, setSide] = useState<'front' | 'back'>('front')
  // 뒷면은 영단어를 가린다 — "정답 확인"을 누르면 보여 주고 발음(가이드 11/6 3단계)
  const [revealed, setRevealed] = useState(false)
  const audio = useWordAudio()
  const saver = useStudySaver(code)
  const word = items[index]
  const last = index === total - 1

  // 카드가 바뀌면 발음 1회 자동 재생, 본 카드 수 기록
  const { play } = audio
  const { record } = saver
  useEffect(() => {
    play(items[index].audio?.audioUrl)
    record({ cardsViewed: index + 1 })
  }, [index, items, play, record])

  function go(next: number) {
    setSide('front')
    setRevealed(false)
    setIndex(Math.min(Math.max(next, 0), total - 1))
  }

  // 저장은 화면을 떠날 때 useStudySaver가 한다(keepalive)
  function finish() {
    navigate('/')
  }

  return (
    <StudentLayout>
      <div className={styles.screen}>
        <header className={styles.header}>
          <div className={styles.headText}>
            <h1 className={styles.title}>단어 카드</h1>
            <p className={styles.sub}>
              {code} · 지문 1~6 · {total}개
            </p>
          </div>
          <span className={styles.counter}>
            {index + 1} / {total}
          </span>
        </header>
        <ProgressBar value={index + 1} max={total} label="단어 카드" size="word" />

        <WordCard
          side={side}
          passageNo={word.passageNo}
          english={word.english}
          posLabel={POS_LABEL[word.pos]}
          korean={word.korean}
          example={splitExample(word.example, word.english)}
          exampleKo={word.exampleKo}
          autoplay={word.audio !== null && !audio.blocked}
          backHint={last ? undefined : '한 번 더 탭하면 다음 단어'}
          hideWord
          onTap={() => {
            if (side === 'front') setSide('back')
            else if (!last) go(index + 1)
          }}
        />

        {side === 'front' ? (
          <SoundButtons word={word} side="front" blocked={audio.blocked} onPlay={audio.play} />
        ) : (
          <Button
            variant="secondary"
            block
            onClick={() => {
              setRevealed(true)
              audio.play(word.audio?.audioUrl)
            }}
          >
            {revealed ? (
              <>
                정답: <span lang="en">{word.english}</span> · 다시 듣기
              </>
            ) : (
              '정답 확인 (영단어 보기·듣기)'
            )}
          </Button>
        )}

        <div className={styles.pair}>
          <Button variant="secondary" onClick={() => go(index - 1)} disabled={index === 0}>
            이전
          </Button>
          {last ? (
            <Button onClick={finish}>완료</Button>
          ) : (
            <Button onClick={() => go(index + 1)}>다음</Button>
          )}
        </div>
        <ButtonLink to={`/lessons/${code}/cards`} variant="secondary" block>
          암기·리콜·스펠로 학습하기 →
        </ButtonLink>
      </div>
    </StudentLayout>
  )
}
