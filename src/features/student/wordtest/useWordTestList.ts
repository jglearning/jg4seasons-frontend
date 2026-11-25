import { skipToken, useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { homeQuery, lessonsQuery, type LessonState } from '../studentApi'
import {
  latestQuery,
  OPEN_SECTIONS,
  type WordTestSection,
  type WordTestSubmission,
} from './wordTestApi'

// 단어시험 목록(#185)의 데이터 — 학생 회차(진도표 묶음 그대로)와, 회차·영역마다 낼 수 있는 시험과 그 최근 제출.
//
// 지금(1단계)은 백엔드에 목록 API가 없어 이렇게 모은다:
//   학생 회차 목록(2.2) → 잠기지 않은 회차 × 낼 수 있는 영역(OPEN_SECTIONS)마다 최근 제출(D-4)
//   → 200·204면 시험 있음. 404(시험지 없음·기능 꺼짐)·403·423·5xx는 "시험 없음" — 홈 진입 줄과 같은 규칙.
// 잠긴 회차는 묻지 않는다(늘 423). 최근 제출은 진입 줄·제출 화면과 같은 쿼리 키라 제출하면 목록도 같이 바뀐다.
// 백엔드 목록 API가 생기면 이 훅의 안만 바꾼다 — 화면(WordTestsPage)은 WordTestList 모양만 안다.

export type LessonTest = {
  lessonCode: string
  /** 서버가 준 회차 이름(예: "Reading Day 1") */
  lessonTitle: string
  section: WordTestSection
  /** 없으면 null(아직 안 냄) */
  latest: WordTestSubmission | null
}

export type WordTestLesson = {
  code: string
  title: string
  /** 서버 회차 상태(오늘·밀림 표시용 — 판정하지 않는다) */
  state: LessonState
  /** 영역별 낼 수 있는 시험. 없는 영역은 키가 없다 */
  tests: Partial<Record<WordTestSection, LessonTest>>
}

export type WordTestGroup = { module: number; label: string; lessons: WordTestLesson[] }

export type WordTestList =
  /** 회차 목록을 받는 중·못 받음 — 화면은 이 쿼리로 안내(LoadState) */
  | { state: 'waiting'; query: UseQueryResult<unknown> }
  /** 회차마다 최근 제출을 묻는 중 — 하나씩 튀어나오지 않게 다 올 때까지 기다린다 */
  | { state: 'checking' }
  | { state: 'ready'; groups: WordTestGroup[] }

export function useWordTestList(): WordTestList {
  const home = useQuery(homeQuery)
  const classId = home.data?.class.id
  const lessons = useQuery(
    classId === undefined
      ? { queryKey: ['student', 'lessons', 'none'], queryFn: skipToken }
      : lessonsQuery(classId),
  )

  const groups = lessons.data?.groups ?? []
  const candidates = groups
    .flatMap((group) => group.lessons)
    .filter((lesson) => lesson.state !== 'locked')
    .flatMap((lesson) => OPEN_SECTIONS.map((section) => ({ lesson, section })))

  const latest = useQueries({
    queries: candidates.map(({ lesson, section }) => latestQuery(lesson.code, section)),
  })

  if (home.data === undefined) return { state: 'waiting', query: home }
  if (lessons.data === undefined) return { state: 'waiting', query: lessons }
  // 오프라인으로 멈춘 조회(paused)는 기다리지 않는다 — 받은 것만으로 그린다
  if (latest.some((q) => q.isPending && q.fetchStatus === 'fetching')) return { state: 'checking' }

  const tests = new Map<string, WordTestLesson['tests']>()
  candidates.forEach(({ lesson, section }, i) => {
    const q = latest[i]
    if (!q.isSuccess) return
    const byLesson = tests.get(lesson.code) ?? {}
    byLesson[section] = {
      lessonCode: lesson.code,
      lessonTitle: lesson.title,
      section,
      latest: q.data,
    }
    tests.set(lesson.code, byLesson)
  })

  return {
    state: 'ready',
    groups: groups.map((group) => ({
      module: group.module,
      label: group.label,
      lessons: group.lessons.map((lesson) => ({
        code: lesson.code,
        title: lesson.title,
        state: lesson.state,
        tests: tests.get(lesson.code) ?? {},
      })),
    })),
  }
}
