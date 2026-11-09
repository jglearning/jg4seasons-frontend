import { Play, Volume2 } from 'lucide-react'
import { Button } from '../../shared/ui/Button'
import type { Word } from './wordsApi'
import styles from './Words.module.css'

/** 뒷면: 단어 듣기·예문 듣기. 앞면에서 자동 재생이 막혔으면 "눌러서 듣기" */
export function SoundButtons({
  word,
  side,
  blocked,
  onPlay,
}: {
  word: Word
  side: 'front' | 'back'
  blocked: boolean
  onPlay: (url: string | undefined) => void
}) {
  if (side === 'front') {
    if (!blocked || word.audio === null) return null
    return (
      <Button variant="secondary" block onClick={() => onPlay(word.audio?.audioUrl)}>
        <Play size={18} strokeWidth={2} aria-hidden /> 눌러서 듣기
      </Button>
    )
  }
  return (
    <div className={styles.pair}>
      <Button
        variant="secondary"
        onClick={() => onPlay(word.audio?.audioUrl)}
        disabled={word.audio === null}
      >
        <Volume2 size={18} strokeWidth={2} aria-hidden /> 단어 듣기
      </Button>
      <Button
        variant="secondary"
        onClick={() => onPlay(word.exampleAudio?.audioUrl)}
        disabled={word.exampleAudio === null}
      >
        <Volume2 size={18} strokeWidth={2} aria-hidden /> 예문 듣기
      </Button>
    </div>
  )
}
