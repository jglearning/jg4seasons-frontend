import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { applyMockLevel } from './mockLevel'
import { applyMockSession } from './mockSession'
import { seedWordTestSubmission } from './wordTestData'

// dev:mock 주소 스위치: ?level=(학생 레벨) · ?as=(로그인한 역할로 시작)
applyMockLevel()
applyMockSession()

// 단어시험 목록(#185)에 결과·채점 중이 보이게 예시 제출 — 1강 채점 결과, 3강 채점 중(블랙은 K 코드)
for (const prefix of ['L2-B1', 'K-B1']) {
  seedWordTestSubmission(`${prefix}-01`, 'graded')
  seedWordTestSubmission(`${prefix}-03`, 'grading')
}

export const worker = setupWorker(...handlers)
