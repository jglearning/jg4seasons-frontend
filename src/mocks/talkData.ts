import { delay, http, HttpResponse, type AnyHandler } from 'msw'
import type {
  TalkConfig,
  TalkEndBody,
  TalkSessionCreated,
  TalkSessionResult,
} from '../features/student/talk/talkApi'
import { STUDENT_MOCK } from './studentData'

// 캐릭터 프리토킹 목 — 동섭 지시서 §D 계약 그대로(D-1~D-5). 백엔드 openapi.json이 생기면 그 타입으로.
// 세션 생성의 임시 키: 로컬 `.env.local`의 VITE_TALK_DEV_SECRET(개발용 — 커밋 안 함)이 있으면 그 값을 줘서
// dev:mock에서도 모델에 실제로 연결된다. 없으면 가짜 값이라 연결 단계에서 실패한다(화면 흐름 확인용).
// [임시] 이 개발용 키 경로는 실제 API로 바꿀 때(PR 2) 지운다

type Helpers = {
  problem: (request: Request, status: number, code: string, title: string) => Response
  readJson: (request: Request) => Promise<Record<string, unknown>>
  currentUser: () => { id: number; role: string } | null
}

const LEVEL_NAMES: Record<string, string> = {
  L1: 'mint',
  L2: 'green',
  L3: 'blue',
  L4: 'navy',
  K: 'black',
}

const DEFAULTS = {
  /** false면 404 FEATURE_DISABLED */
  enabled: true,
  entitled: true,
  maxSeconds: 180,
  dailyLimit: 3,
  /** true면 요약을 만들지 못한 경우(summary: null) */
  summaryFails: false,
  /** 회차 단어 — 지어낸 목록(교재 단어를 공개 저장소에 넣지 않는다). 로컬 개발용 키의 세션 지시문에 이 단어를 넣으면 강조가 보인다 */
  lessonWords: [
    { english: 'cheerful', korean: '쾌활한' },
    { english: 'weekend', korean: '주말' },
    { english: 'visit', korean: '방문하다' },
    { english: 'play soccer', korean: '축구를 하다' },
  ] as { english: string; korean: string }[],
}

export const TALK_MOCK = { ...DEFAULTS, lessonWords: [...DEFAULTS.lessonWords] }

const CLOSING_INSTRUCTION =
  'Time is almost up. Say a short, warm goodbye in one or two sentences. Do not ask a new question.'

let nextId = 77
let usedToday = 0
const byClientId = new Map<string, number>()
const ended = new Map<number, TalkSessionResult>()

export function resetTalkMock() {
  Object.assign(TALK_MOCK, DEFAULTS, { lessonWords: [...DEFAULTS.lessonWords] })
  nextId = 77
  usedToday = 0
  byClientId.clear()
  ended.clear()
}

export function mockTalkConfig(): TalkConfig {
  return {
    entitled: TALK_MOCK.entitled,
    level: LEVEL_NAMES[STUDENT_MOCK.level.code] ?? 'green',
    maxSeconds: TALK_MOCK.maxSeconds,
    remainingToday: Math.max(0, TALK_MOCK.dailyLimit - usedToday),
    topics: [
      { code: 'lesson', title: '오늘 배운 단어로 이야기하기' },
      { code: 'day', title: '오늘 하루' },
      { code: 'likes', title: '내가 좋아하는 것' },
    ],
    lessonWords: TALK_MOCK.lessonWords,
  }
}

function devSecret(): string {
  const value: unknown = import.meta.env.VITE_TALK_DEV_SECRET
  return typeof value === 'string' && value !== '' ? value : 'ek_mock'
}

export function talkHandlers({ problem, readJson, currentUser }: Helpers): AnyHandler[] {
  // handlers.ts의 studentOnly와 같게: 세션 없음 401, 학생이 아닌 역할은 403(401이면 세션 만료로 처리돼 입장 화면으로 간다)
  const studentOnly = (request: Request) => {
    const user = currentUser()
    if (!user) return problem(request, 401, 'UNAUTHORIZED', '다시 들어와 주세요')
    if (user.role !== 'student') return problem(request, 403, 'FORBIDDEN', '이 화면을 볼 수 없어요')
    return undefined
  }
  const disabled = (request: Request) =>
    TALK_MOCK.enabled
      ? undefined
      : problem(request, 404, 'FEATURE_DISABLED', '이 학원에서는 쓸 수 없는 기능이에요')

  return [
    http.get('*/api/v1/talk/config', async ({ request }) => {
      await delay()
      return studentOnly(request) ?? disabled(request) ?? HttpResponse.json(mockTalkConfig())
    }),

    http.post('*/api/v1/talk/sessions', async ({ request }) => {
      const denied = studentOnly(request) ?? disabled(request)
      if (denied) return denied
      const body = await readJson(request)
      const clientSessionId = body.clientSessionId
      if (typeof clientSessionId !== 'string' || typeof body.topic !== 'string')
        return problem(request, 400, 'VALIDATION', '요청 형식이 맞지 않아요')
      if (!TALK_MOCK.entitled)
        return problem(request, 403, 'SUBSCRIPTION_REQUIRED', '구독하면 쓸 수 있어요')
      await delay()
      const realtime = {
        clientSecret: devSecret(),
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        model: 'gpt-realtime',
        closingInstruction: CLOSING_INSTRUCTION,
      }
      // 같은 clientSessionId면 200 + 임시 키 새로(D-2)
      const existing = byClientId.get(clientSessionId)
      if (existing !== undefined) {
        const again: TalkSessionCreated = {
          id: existing,
          status: 'created',
          maxSeconds: TALK_MOCK.maxSeconds,
          realtime,
        }
        return HttpResponse.json(again)
      }
      if (usedToday >= TALK_MOCK.dailyLimit)
        return problem(request, 429, 'DAILY_LIMIT', '오늘은 세 번 다 했어요')
      usedToday += 1
      const id = nextId++
      byClientId.set(clientSessionId, id)
      const created: TalkSessionCreated = {
        id,
        status: 'created',
        maxSeconds: TALK_MOCK.maxSeconds,
        realtime,
      }
      return HttpResponse.json(created, { status: 201 })
    }),

    http.post('*/api/v1/talk/sessions/:id/end', async ({ request, params }) => {
      const denied = studentOnly(request)
      if (denied) return denied
      const id = Number(params.id)
      if (![...byClientId.values()].includes(id))
        return problem(request, 404, 'NOT_FOUND', '대화를 찾을 수 없어요')
      const saved = ended.get(id)
      if (saved) return HttpResponse.json(saved)
      const body = (await readJson(request)) as unknown as TalkEndBody
      await delay()
      const said = body.turns.filter((turn) => turn.role === 'student')
      const result: TalkSessionResult = {
        id,
        status: 'ended',
        durationSec: body.durationSec,
        studentTurnCount: said.length,
        summary: TALK_MOCK.summaryFails
          ? null
          : {
              goodExpressions: ['play soccer', 'after school'],
              corrections: [
                {
                  said: 'I go to school and play soccer.',
                  better: 'I went to school and played soccer.',
                  note: '지난 일은 과거형으로 말해요',
                },
                {
                  said: 'I like very much pizza.',
                  better: 'I like pizza very much.',
                  note: 'very much는 문장 끝에 와요',
                },
              ],
            },
      }
      ended.set(id, result)
      return HttpResponse.json(result)
    }),
  ]
}
