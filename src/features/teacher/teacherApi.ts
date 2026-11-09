import { queryOptions } from '@tanstack/react-query'
import { api } from '../../api'
import { unwrap } from '../../api/errors'
import type { components } from '../../api/generated/schema'

// 교사 반 목록(03 §4.1)·청취 현황 매트릭스(§4.2).
// 완료·진행·밀림·열림은 모두 서버 값을 표시만 한다(계산하지 않음)

type Schemas = components['schemas']

export type TeacherClass = Schemas['TeacherClassItem']
export type Matrix = Schemas['MatrixResponse']
export type MatrixSession = Schemas['MatrixSession']
export type MatrixStudent = Schemas['MatrixStudent']
export type MatrixCell = Schemas['MatrixCell']

export type StudentDetail = Schemas['StudentDetailResponse']
export type StudentLesson = Schemas['StudentDetailLesson']
export type StudentTrack = Schemas['StudentDetailTrack']
export type LessonDetail = Schemas['TeacherLessonDetailResponse']
export type LessonDetailRow = Schemas['TeacherLessonRow']
export type SessionItem = Schemas['SessionItem']
export type SessionUpdate = Schemas['SessionUpdateRequest']

/** 묶음 범위. 없으면 서버 기본(지금 회차가 든 8개) */
export type SeqRange = { fromSeq: number; toSeq: number }

export const teacherClassesQuery = queryOptions({
  queryKey: ['teacher', 'classes'],
  queryFn: () => unwrap(api.GET('/api/v1/teacher/classes')),
})

/** 쿼리 키는 숫자만(학생 이름을 넣지 않는다) */
export function matrixQuery(classId: number, range: SeqRange | undefined) {
  return queryOptions({
    queryKey: [
      'teacher',
      'classes',
      classId,
      'matrix',
      range === undefined ? 'current' : `${range.fromSeq}-${range.toSeq}`,
    ],
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/teacher/classes/{classId}/matrix', {
          params: { path: { classId }, query: range },
        }),
      ),
  })
}

export function studentDetailQuery(classId: number, studentId: number) {
  return queryOptions({
    queryKey: ['teacher', 'classes', classId, 'students', studentId],
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/teacher/classes/{classId}/students/{studentId}', {
          params: { path: { classId, studentId } },
        }),
      ),
  })
}

export function lessonDetailQuery(classId: number, lessonCode: string) {
  return queryOptions({
    queryKey: ['teacher', 'classes', classId, 'lessons', lessonCode],
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/teacher/classes/{classId}/lessons/{lessonCode}', {
          params: { path: { classId, lessonCode } },
        }),
      ),
  })
}

export function sessionsQuery(classId: number) {
  return queryOptions({
    queryKey: ['teacher', 'classes', classId, 'sessions'],
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/teacher/classes/{classId}/sessions', {
          params: { path: { classId } },
        }),
      ),
  })
}

export function updateSession(classId: number, seq: number, body: SessionUpdate) {
  return unwrap(
    api.PATCH('/api/v1/teacher/classes/{classId}/sessions/{seq}', {
      params: { path: { classId, seq } },
      body,
    }),
  )
}

/** 휴강(4.7). note가 없으면 본문에서 빠진다(선택 칸) */
export function cancelSession(classId: number, seq: number, note: string | undefined) {
  return unwrap(
    api.POST('/api/v1/teacher/classes/{classId}/sessions/{seq}/cancel', {
      params: { path: { classId, seq } },
      body: { note, shiftFollowing: true },
    }),
  )
}

/**
 * 개인 코드 재발급(4.8). 평문은 이 응답에만 온다(ADR-22) — 쿼리 캐시에 넣지 않고 useMutation도 쓰지 않는다.
 * 받은 화면의 지역 state에만 둔다
 */
export async function regeneratePersonalCode(studentId: number): Promise<string> {
  const result = await unwrap(
    api.POST('/api/v1/teacher/students/{studentId}/personal-code/regenerate', {
      params: { path: { studentId } },
    }),
  )
  return result.personalCode
}
