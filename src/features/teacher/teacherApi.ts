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
