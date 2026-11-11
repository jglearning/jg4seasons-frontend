import { useQuery } from '@tanstack/react-query'
import { Play, Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Button } from '../../shared/ui/Button'
import { ProgressBar } from '../../shared/ui/ProgressBar'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { WordCard } from '../../shared/ui/WordCard'
import { POS_LABEL, SOURCE_LABEL } from './study'
import { useStudySaver } from './useStudySaver'
import { useWordAudio } from './useWordAudio'
import { WordsLoadState } from './WordsLoadState'
import { wordsQuery, type Word } from './wordsApi'
import styles from './Words.module.css'

// S-06 단어 카드(STU-07, 가이드 §5 WordCard 11/11 판, #64).
// 카드가 나오면 발음 1회 자동 재생(막히면 "눌러서 듣기"). 뜻은 덮개를 올리거나 눌러서 본다 — 알아요·몰라요 입력은 없고
// 이전·다음으로 넘긴다. 본 카드 수(가장 멀리 간 번호)는 떠날 때·마지막 카드에서 저장한다(03 §2.5)

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

/** 카드 학습(S-06b)은 11/11 삭제 — 옛 주소로 오면 단어 카드로 */
export function CardsRedirect() {
  const { code = '' } = useParams()
  return <Navigate to={`/lessons/${code}/words`} replace />
}

function WordsBody({ code, items }: { code: string; items: Word[] }) {
  const navigate = useNavigate()
  const total = items.length
  const [index, setIndex] = useState(0)
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
              {code} · 단어 {total}개
            </p>
          </div>
          <span className={styles.counter}>
            {index + 1} / {total}
          </span>
        </header>
        <ProgressBar value={index + 1} max={total} label="단어 카드" size="word" />

        {/* key — 카드가 바뀌면 덮개가 닫힌 새 카드 */}
        <WordCard
          key={index}
          sourceLabel={SOURCE_LABEL[word.source]}
          english={word.english}
          posLabel={POS_LABEL[word.pos]}
          korean={word.korean}
          autoplay={word.audio !== null && !audio.blocked}
        />

        <Button
          variant="secondary"
          block
          onClick={() => audio.play(word.audio?.audioUrl)}
          disabled={word.audio === null}
        >
          {audio.blocked && word.audio !== null ? (
            <>
              <Play size={18} strokeWidth={2} aria-hidden /> 눌러서 듣기
            </>
          ) : (
            <>
              <Volume2 size={18} strokeWidth={2} aria-hidden /> 단어 듣기
            </>
          )}
        </Button>

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
      </div>
    </StudentLayout>
  )
}
