import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, House, Play, Volume2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { onlySpellings, sameSpelling } from '../../shared/wordsPath'
import { Button } from '../../shared/ui/Button'
import { ProgressBar } from '../../shared/ui/ProgressBar'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { WordCard } from '../../shared/ui/WordCard'
import { lessonLevelCode } from '../../shared/lessonLabel'
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
  const [search] = useSearchParams()
  const only = onlySpellings(search)

  const level = lessonLevelCode(code)
  if (words.data === undefined) {
    return (
      <StudentLayout levelCode={level}>
        <div className={styles.screen}>
          <WordsHead code={code} />
          <WordsLoadState query={words} />
        </div>
      </StudentLayout>
    )
  }
  if (words.data.items.length === 0) {
    return (
      <StudentLayout levelCode={level}>
        <div className={styles.screen}>
          <WordsHead code={code} />
          <p className={styles.empty}>이 수업에는 아직 단어가 없어요</p>
        </div>
      </StudentLayout>
    )
  }
  // 거르기(#187, 단어시험 결과의 "틀린 단어 다시 보기"): 주소의 철자와 같은 단어만, 회차 순서 그대로.
  // 맞는 단어가 하나도 없으면(철자가 어긋남) 전체를 보이고 한 줄 안내 — 빈 화면에 갇히지 않게
  const all = words.data.items
  const picked =
    only === undefined ? [] : all.filter((w) => only.some((s) => sameSpelling(s, w.english)))
  const filtered = picked.length > 0
  return (
    <WordsBody
      key={filtered ? 'only' : 'all'}
      code={code}
      items={filtered ? picked : all}
      filtered={filtered}
      notice={
        only !== undefined && !filtered ? '다시 볼 단어를 찾지 못해 전체 단어를 보여요' : undefined
      }
    />
  )
}

/** 카드 학습(S-06b)은 11/11 삭제 — 옛 주소로 오면 단어 카드로 */
export function CardsRedirect() {
  const { code = '' } = useParams()
  return <Navigate to={`/lessons/${code}/words`} replace />
}

function WordsBody({
  code,
  items,
  filtered = false,
  notice,
}: {
  code: string
  items: Word[]
  /** 거른 단어만 보는 중 — 본 카드 수를 저장하지 않는다(회차 학습 기록은 전체 카드 기준) */
  filtered?: boolean
  notice?: string
}) {
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
    if (!filtered) record({ cardsViewed: index + 1 })
  }, [index, items, play, record, filtered])

  function go(next: number) {
    setIndex(Math.min(Math.max(next, 0), total - 1))
  }

  // 저장은 화면을 떠날 때 useStudySaver가 한다(keepalive)
  function finish() {
    navigate('/')
  }

  return (
    <StudentLayout levelCode={lessonLevelCode(code)}>
      <div className={styles.screen}>
        <WordsHead
          code={code}
          sub={filtered ? `${code} · 다시 볼 단어 ${total}개` : `${code} · 단어 ${total}개`}
          counter={`${index + 1} / ${total}`}
          bar={<ProgressBar value={index + 1} max={total} label="단어 카드" size="word" />}
        />

        {notice !== undefined && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}

        {/* key — 카드가 바뀌면 덮개가 닫힌 새 카드. 자동 재생은 표시 없이 위 useEffect가 한다(v0.2) */}
        <WordCard
          key={index}
          sourceLabel={SOURCE_LABEL[word.source]}
          english={word.english}
          posLabel={POS_LABEL[word.pos]}
          korean={word.korean}
        />

        <Button
          variant="secondary"
          block
          onClick={() => audio.play(word.audio?.audioUrl)}
          disabled={word.audio === null}
        >
          {audio.blocked && word.audio !== null ? (
            <>
              <Play size={22} fill="currentColor" strokeWidth={0} aria-hidden /> 눌러서 듣기
            </>
          ) : (
            <>
              <Volume2 size={24} strokeWidth={2.2} aria-hidden /> 단어 듣기
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

// 머리: 뒤로 + "단어 카드" + 보조 글(코드 · 단어 n개) + 오른쪽 진행 수 + 홈으로, 아래 진행 바.
// 불러오는 중·못 받음·단어 없음에서는 제목과 코드만(진행 수·바 없음) — 뒤로·홈으로는 늘 있다.
// 와이어프레임 S06_Words에는 뒤로·홈이 없다. 홈 화면 앱에서는 브라우저 뒤로 가기가 없어 나갈 길이
// 마지막 카드의 "완료"뿐이라 S-05 머리 줄과 같은 버튼을 둔다(#126)
function WordsHead({
  code,
  sub = code,
  counter,
  bar,
}: {
  code: string
  sub?: string
  counter?: string
  bar?: ReactNode
}) {
  const navigate = useNavigate()
  const location = useLocation()

  // S-05와 같은 규칙: 앱 안에서 온 기록이 있으면 한 칸 뒤로, 주소로 바로 열었으면 회차 목록으로
  function goBack() {
    if (location.key !== 'default') navigate(-1)
    else navigate('/lessons')
  }

  return (
    <div className={styles.head}>
      <header className={styles.header}>
        <button type="button" className={styles.iconButton} aria-label="뒤로" onClick={goBack}>
          <ChevronLeft size={24} strokeWidth={2} aria-hidden />
        </button>
        <div className={styles.headText}>
          <h1 className={styles.title}>단어 카드</h1>
          <p className={styles.sub}>{sub}</p>
        </div>
        {counter !== undefined && <span className={styles.counter}>{counter}</span>}
        <Link to="/" className={styles.iconButton} aria-label="홈으로">
          <House size={24} strokeWidth={2} aria-hidden />
        </Link>
      </header>
      {bar}
    </div>
  )
}
