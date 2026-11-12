import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { applyMockLevel } from './mockLevel'

applyMockLevel()

export const worker = setupWorker(...handlers)
