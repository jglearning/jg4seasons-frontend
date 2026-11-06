import { queryOptions } from '@tanstack/react-query'
import { api } from '../../api'
import { unwrap } from '../../api/errors'

// 학생 홈·회차 목록 API(03 §2.1·§2.2). 쿼리 키에는 숫자 id만 넣는다(이름·코드 금지)

function fetchHome() {
  return unwrap(api.GET('/api/v1/student/home'))
}

function fetchLessons(classId: number) {
  return unwrap(
    api.GET('/api/v1/student/classes/{classId}/lessons', { params: { path: { classId } } }),
  )
}

export const homeQuery = queryOptions({ queryKey: ['student', 'home'], queryFn: fetchHome })

export function lessonsQuery(classId: number) {
  return queryOptions({
    queryKey: ['student', 'lessons', classId],
    queryFn: () => fetchLessons(classId),
  })
}

export type StudentHome = Awaited<ReturnType<typeof fetchHome>>
export type StudentLessons = Awaited<ReturnType<typeof fetchLessons>>
export type LessonState = StudentLessons['groups'][number]['lessons'][number]['state']
