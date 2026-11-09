import { queryOptions } from '@tanstack/react-query'
import { api } from '../../api'
import { unwrap } from '../../api/errors'
import type { paths } from '../../api/generated/schema'

// S-06·S-06b 단어(03 §2.4)와 카드·학습 결과 저장(2.5).
// 쿼리 키의 회차 코드는 교재 회차 식별자라 개인 정보가 아니다(회차에는 숫자 id가 없다)
function fetchWords(code: string) {
  return unwrap(
    api.GET('/api/v1/student/lessons/{lessonCode}/words', {
      params: { path: { lessonCode: code } },
    }),
  )
}

export function wordsQuery(code: string) {
  return queryOptions({ queryKey: ['student', 'words', code], queryFn: () => fetchWords(code) })
}

export type WordStudy =
  paths['/api/v1/student/lessons/{lessonCode}/word-study']['put']['requestBody']['content']['application/json']

/** 결과 저장(보낼 칸만, 서버는 큰 값만 남긴다). keepalive면 화면을 떠나도 끝까지 간다 */
export function saveWordStudy(code: string, body: WordStudy, { keepalive = false } = {}) {
  return unwrap(
    api.PUT('/api/v1/student/lessons/{lessonCode}/word-study', {
      params: { path: { lessonCode: code } },
      body,
      keepalive,
    }),
  )
}

export type LessonWords = Awaited<ReturnType<typeof fetchWords>>
export type Word = LessonWords['items'][number]
