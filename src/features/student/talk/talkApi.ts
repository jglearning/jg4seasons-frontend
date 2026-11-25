import { queryOptions } from '@tanstack/react-query'
import type { Client } from 'openapi-fetch'
import { api } from '../../../api'
import { unwrap } from '../../../api/errors'
import type { LessonWord } from './lessonWords'

// 캐릭터 프리토킹 1단계(시연용). 학생 API — 설정 조회 → 세션 생성(임시 키) → 브라우저가 모델에 직접 연결 → 종료.
//
// [임시] 경로 타입을 손으로 선언했다. 백엔드 API가 아직 openapi.json에 없어서(11/25) 프론트·백엔드가 같이 정한
// 계약(동섭 지시서 §D)대로 적었다. 백엔드가 머지되면 `npm run api:sync`의 생성 타입으로 바꾸고
// 이 선언과 아래 캐스팅을 지운다(PR 2). 단어시험 1단계(#171)와 같은 방식 — 앱의 API 인스턴스를 넓혀 쓴다

// 목소리(voice)는 요청에 없다 — 캐릭터(레벨)에 맞춰 서버가 정한다(11/25 계약 변경 제안)
export type TalkRole = 'student' | 'character'
export type TalkEndReason = 'user' | 'timeout' | 'left' | 'disconnected'
export type TalkStatus = 'created' | 'ended' | 'expired' | 'failed'

export type TalkTopic = { code: string; title: string }

export type TalkConfig = {
  entitled: boolean
  /** 레벨 이름(mint·green·blue·navy·black) — 서버 level.code가 아님 */
  level: string
  maxSeconds: number
  remainingToday: number
  topics: TalkTopic[]
  /** 그 반 현재 회차 단어(캐릭터 자막에서 강조, 누르면 뜻). 없으면 빈 배열 — 추가 지시 11/25 밤 */
  lessonWords: LessonWord[]
}

export type TalkRealtime = {
  /** 모델 서비스의 임시 키(ek_…). 저장·로그 금지 */
  clientSecret: string
  expiresAt: string
  model: string
  /** 연결 주소가 기본값과 다를 때만(handoff 질문 3) */
  url?: string
  /** 남은 시간이 CLOSING_AT_SECONDS(talkCall.ts)가 되면 모델에 한 번 보낼 마무리 지시 — 추가 지시 11/25 밤 */
  closingInstruction: string
}

export type TalkSessionCreated = {
  id: number
  status: TalkStatus
  maxSeconds: number
  realtime: TalkRealtime
}

export type TalkTurn = { role: TalkRole; text: string }

export type TalkCorrection = { said: string; better: string; note: string }

export type TalkSummary = { goodExpressions: string[]; corrections: TalkCorrection[] }

export type TalkSessionResult = {
  id: number
  status: TalkStatus
  durationSec: number
  studentTurnCount: number
  summary: TalkSummary | null
}

export type TalkEndBody = {
  durationSec: number
  endReason: TalkEndReason
  turns: TalkTurn[]
  usage?: Record<string, unknown>
}

type Problem = { 'application/problem+json': Record<string, unknown> }
type Json<T> = { 'application/json': T }
type Responses<Ok> = { 200: { content: Json<Ok> }; default: { content: Problem } }
type NoParams = { query?: never; header?: never; path?: never; cookie?: never }
type IdParams = { query?: never; header?: never; path: { id: number }; cookie?: never }
type Path<Ops> = { parameters: NoParams } & Ops

type TalkPaths = {
  '/api/v1/talk/config': Path<{
    get: { parameters: NoParams; requestBody?: never; responses: Responses<TalkConfig> }
  }>
  '/api/v1/talk/sessions': Path<{
    post: {
      parameters: NoParams
      requestBody: { content: Json<{ clientSessionId: string; topic: string }> }
      responses: { 201: { content: Json<TalkSessionCreated> } } & Responses<TalkSessionCreated>
    }
  }>
  '/api/v1/talk/sessions/{id}/end': Path<{
    post: {
      parameters: IdParams
      requestBody: { content: Json<TalkEndBody> }
      responses: Responses<TalkSessionResult>
    }
  }>
}

const talkApi = api as unknown as Client<TalkPaths>

export const talkConfigQuery = () =>
  queryOptions({
    queryKey: ['talk', 'config'],
    queryFn: () => unwrap(talkApi.GET('/api/v1/talk/config')),
    // 남은 횟수는 세션을 끝낼 때마다 바뀐다 — 화면에 들어올 때마다 새로
    staleTime: 0,
  })

export function createTalkSession(body: {
  clientSessionId: string
  topic: string
}): Promise<TalkSessionCreated> {
  return unwrap(talkApi.POST('/api/v1/talk/sessions', { body }))
}

/** keepalive: 화면을 떠나는 중(탭 닫기·뒤로)에도 끝까지 가게 */
export function endTalkSession(
  id: number,
  body: TalkEndBody,
  { keepalive = false } = {},
): Promise<TalkSessionResult> {
  return unwrap(
    talkApi.POST('/api/v1/talk/sessions/{id}/end', {
      params: { path: { id } },
      body,
      keepalive,
    }),
  )
}
