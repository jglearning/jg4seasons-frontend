import { Copy, House, List } from 'lucide-react'
import { BottomBar, type BottomTab } from '../../shared/ui/BottomBar'
import type { StudentHome } from './studentApi'

// 학생 하단 탭: 홈 · 회차(밀린 수 배지 — 서버 stats, STU-01) · 단어(오늘 회차 단어 S-06).
// 홈을 아직 못 받았거나 단어가 없으면 단어 탭은 누를 수 없다
export function StudentTabs({ home }: { home: StudentHome | undefined }) {
  const overdue = home?.stats.overdueLessons ?? 0
  const wordsCode = home?.words?.lessonCode
  const words: BottomTab =
    wordsCode === undefined
      ? { label: '단어', icon: Copy, unavailable: '오늘 단어 없음' }
      : { label: '단어', icon: Copy, to: `/lessons/${wordsCode}/words` }
  return (
    <BottomBar
      tabs={[
        { label: '홈', icon: House, to: '/', end: true },
        {
          label: '회차',
          icon: List,
          to: '/lessons',
          end: true,
          badge: { count: overdue, label: `밀린 수업 ${overdue}개` },
        },
        words,
      ]}
    />
  )
}
