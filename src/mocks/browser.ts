import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { applyMockLevel } from './mockLevel'
import { applyMockSession } from './mockSession'

// dev:mock 주소 스위치: ?level=(학생 레벨) · ?as=(로그인한 역할로 시작)
applyMockLevel()
applyMockSession()

export const worker = setupWorker(...handlers)
