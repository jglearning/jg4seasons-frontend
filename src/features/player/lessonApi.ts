import { queryOptions } from '@tanstack/react-query'
import { api } from '../../api'
import { unwrap } from '../../api/errors'

// S-05 회차 상세(03 §2.3 v0.4 — 문장 글·문장 시각·들은 구간).
// 쿼리 키의 회차 코드(L2-B1-05)는 교재 회차 식별자라 개인 정보가 아니다 — 회차에는 숫자 id가 없다(03 §2.3)
function fetchLesson(code: string) {
  return unwrap(
    api.GET('/api/v1/student/lessons/{lessonCode}', { params: { path: { lessonCode: code } } }),
  )
}

export function lessonQuery(code: string) {
  return queryOptions({ queryKey: ['student', 'lesson', code], queryFn: () => fetchLesson(code) })
}

export type LessonDetail = Awaited<ReturnType<typeof fetchLesson>>
export type Passage = LessonDetail['passages'][number]
export type Speed = Passage['speeds'][number]
