import { queryOptions } from '@tanstack/react-query'
import { api } from '../../../api'
import { unwrap } from '../../../api/errors'
import type { components } from '../../../api/generated/schema'

// 캐릭터 프리토킹 학생 API(BE #84·#85·#87) — 설정 조회 → 세션 생성(임시 키) → 브라우저가 모델에 직접 연결 → 종료.
// 타입은 생성 타입(openapi.json). 목소리(voice)는 요청에 없다 — 반의 레벨 캐릭터 성별로 서버가 정한다(BE #87)

type Schemas = components['schemas']

export type TalkConfig = Schemas['TalkConfigResponse']
export type TalkTopicCode = Schemas['TalkTopic']['code']
export type TalkSessionCreated = Schemas['TalkSessionCreatedResponse']
export type TalkSessionResult = Schemas['TalkSessionResultResponse']
export type TalkEndBody = Schemas['TalkSessionEndRequest']
export type TalkTurn = Schemas['TalkTurn']
export type TalkRole = TalkTurn['role']
export type TalkEndReason = TalkEndBody['endReason']

export const talkConfigQuery = () =>
  queryOptions({
    queryKey: ['talk', 'config'],
    queryFn: () => unwrap(api.GET('/api/v1/talk/config')),
    // 남은 횟수는 세션을 끝낼 때마다 바뀐다 — 화면에 들어올 때마다 새로
    staleTime: 0,
  })

/**
 * 같은 clientSessionId를 다시 보내면 새로 만들지 않는다: 60초(임시 키 수명) 안의 created면 키만 새로,
 * 끝난 세션·60초 지남은 realtime null(새 clientSessionId로 다시) — BE #84
 */
export function createTalkSession(
  body: Schemas['TalkSessionCreateRequest'],
): Promise<TalkSessionCreated> {
  return unwrap(api.POST('/api/v1/talk/sessions', { body }))
}

/** keepalive: 화면을 떠나는 중(탭 닫기·뒤로)에도 끝까지 가게 */
export function endTalkSession(
  id: number,
  body: TalkEndBody,
  { keepalive = false } = {},
): Promise<TalkSessionResult> {
  return unwrap(
    api.POST('/api/v1/talk/sessions/{id}/end', {
      params: { path: { id } },
      body,
      keepalive,
    }),
  )
}
