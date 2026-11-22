import { CalendarX, CircleAlert, Lock, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react'
import { useEffect } from 'react'
import { ApiError, isPermanentError, isTimeout } from '../api/errors'

// 학생 화면의 받기 전·못 받은 상태(와이어프레임 S05_Before, 명세 S04_S05_빈상태 §2·§3) — S-05(#139)·S-06(#154) 공용.
// 판정만 여기서 하고 그리기(StatusPanel·버튼 자리)는 화면이 한다

/** 쿼리 중 판정에 쓰는 것만(TanStack Query 결과) */
export type LoadQuery = {
  isError: boolean
  error: unknown
  fetchStatus: string
  refetch: () => unknown
}

/**
 * loading 불러오는 중 / offline 인터넷 끊김 / locked 잠긴 회차 / license 사용 기간 아님 /
 * client 다시 해도 같은 그 밖의 4xx(locked·license와 같은 틀) / server 서버 오류·다시 하면 풀릴 수 있는 오류 /
 * none 그리지 않음(401 — 세션 만료 이동이 맡는다)
 */
export type LoadState = 'loading' | 'offline' | 'locked' | 'license' | 'client' | 'server' | 'none'

/**
 * 받은 오류를 상태로. 브라우저가 오프라인이면 요청이 멈추고(paused), 온라인인데 서버에 닿지 못하면
 * 연결 오류(TypeError)가 오고, 응답이 늦으면 시간 초과(TimeoutError) — 모두 offline.
 * 서버가 응답한 5xx·엉뚱한 응답·알 수 없는 오류는 server
 */
export function loadStateOf(query: LoadQuery): LoadState {
  if (query.fetchStatus === 'paused') return 'offline'
  if (query.fetchStatus === 'fetching' || !query.isError) return 'loading'
  const error = query.error
  // 응답이 10초 안에 오지 않은 것(authFetch GET 제한)도 들어가기 화면처럼 연결 안내로(#159)
  if (error instanceof TypeError || isTimeout(error)) return 'offline'
  if (!(error instanceof ApiError)) return 'server'
  if (error.status === 401) return 'none'
  if (error.code === 'LESSON_LOCKED') return 'locked'
  if (error.code === 'LICENSE_INACTIVE') return 'license'
  // 408·429·code 없는 4xx는 다시 하면 풀릴 수 있다 → server(다시 시도 + 기록)
  if (isPermanentError(error)) return 'client'
  return 'server'
}

/**
 * server 상태가 되면 서버 로그와 맞춰 볼 수 있게 콘솔에 — ApiError는 상태·code·requestId만, 그 밖은 오류 이름만.
 * 메시지는 남기지 않는다(깨진 JSON의 SyntaxError 메시지에는 응답 본문 앞부분이 들어갈 수 있다 — 개인정보 규칙)
 */
export function useServerErrorLog(state: LoadState, error: unknown) {
  useEffect(() => {
    if (state !== 'server') return
    console.error(
      '[api]',
      error instanceof ApiError
        ? { status: error.status, code: error.code, requestId: error.requestId }
        : { name: error instanceof Error ? error.name : typeof error },
    )
  }, [state, error])
}

/** 다시 시도하면 풀릴 수 있는 상태(offline·server) — 정한 문구, 주 버튼 "다시 시도", 아이콘 bad, role alert */
export const RETRY_STATUS = {
  offline: {
    icon: WifiOff,
    title: '인터넷이 끊겼어요',
    detail: '연결을 확인하고 다시 시도해 주세요',
  },
  server: {
    icon: TriangleAlert,
    title: '잠시 문제가 생겼어요',
    detail: '잠시 후 다시 시도해 주세요',
  },
} as const satisfies Record<
  'offline' | 'server',
  { icon: LucideIcon; title: string; detail: string }
>

/** 기다려야 풀리는 상태(locked·license·client) — 서버 문구(title·detail), 흰 버튼 "회차 목록으로", 아이콘 muted, role status */
export const WAIT_ICON = {
  locked: Lock,
  license: CalendarX,
  client: CircleAlert,
} as const satisfies Record<'locked' | 'license' | 'client', LucideIcon>
