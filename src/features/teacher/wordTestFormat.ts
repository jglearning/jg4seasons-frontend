import type { Status } from '../../shared/ui/StatusPill'
import type { TeacherWordTestResult, TeacherWordTestStatus } from './wordTestApi'

// 교사 단어시험 글자(#175) — 서버 status·result를 StatusPill 모양과 글자로 바꾸기만 한다(판정하지 않음)

type Look = { status: Status; text: string }

const STATUS: Record<TeacherWordTestStatus, Look> = {
  graded: { status: 'completed', text: '완료' },
  pending: { status: 'in_progress', text: '채점 중' },
  grading: { status: 'in_progress', text: '채점 중' },
  failed: { status: 'overdue', text: '실패' },
  // 2단계 상태 — 1단계에는 오지 않는다
  confirming: { status: 'in_progress', text: '확인 중' },
  rejected: { status: 'in_progress', text: '확인 중' },
}

export const NOT_SUBMITTED: Look = { status: 'open', text: '미제출' }

/** 제출 상태 → 모양·글자. 모르는 값은 "확인 중" */
export function statusLook(status: string): Look {
  return (STATUS as Partial<Record<string, Look>>)[status] ?? STATUS.confirming
}

const RESULT: Record<TeacherWordTestResult, Look> = {
  correct: { status: 'completed', text: '맞음' },
  wrong: { status: 'overdue', text: '틀림' },
  blank: { status: 'open', text: '안 씀' },
  unclear: { status: 'in_progress', text: '확인 필요' },
}

/** 문항 결과 → 모양·글자. 모르는 값은 판정하지 않고 "확인 필요" */
export function resultLook(result: string): Look {
  return (RESULT as Partial<Record<string, Look>>)[result] ?? RESULT.unclear
}
