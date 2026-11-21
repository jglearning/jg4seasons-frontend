import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from '../../api'
import { ApiError, unwrap } from '../../api/errors'
import { DEFAULT_VOICE, type Variant } from './player'

// 고른 목소리(BE #61, 백엔드 ADR 0035) — 서버 설정 하나에만 둔다. 기기(localStorage)에는 저장하지 않는다.
// GET /me/settings → { voice: … | null }(null = 고른 적 없음, 기본은 화면이 정함 — 미국 여성).
// PATCH는 보낸 칸만 바꾸고(PUT 아님) 응답은 늘 설정 전체라 받은 값으로 캐시를 통째로 바꾼다.

type Settings = Awaited<ReturnType<typeof fetchSettings>>

function fetchSettings() {
  return unwrap(api.GET('/api/v1/me/settings'))
}

function patchSettings(body: { voice: Variant }) {
  return unwrap(api.PATCH('/api/v1/me/settings', { body }))
}

/** 쿼리 키에 학생 정보 없음(세션 쿠키가 학생을 정한다) */
export const settingsQuery = queryOptions({
  queryKey: ['student', 'settings'],
  queryFn: fetchSettings,
})

/**
 * [지금 목소리, 바꾸기]. 받기 전·받지 못함·고른 적 없음이면 미국 여성.
 * 바꾸면 캐시(화면)를 먼저 바꾸고 PATCH — 실패해도 고른 목소리로 계속 듣는다(안내 없음, 다음에 받을 때 서버 값)
 */
export function useVoice(): readonly [Variant, (voice: Variant) => void] {
  const queryClient = useQueryClient()
  const voice = useQuery(settingsQuery).data?.voice ?? DEFAULT_VOICE
  const { mutate } = useMutation({
    mutationFn: patchSettings,
    onSuccess: (saved: Settings) => queryClient.setQueryData(settingsQuery.queryKey, saved),
    // 서버 로그와 맞춰 볼 수 있게 상태·code·requestId만(개인정보 없음)
    onError: (error) =>
      console.warn(
        '[settings] 목소리 저장 실패',
        error instanceof ApiError
          ? { status: error.status, code: error.code, requestId: error.requestId }
          : error,
      ),
  })
  const setVoice = useCallback(
    (next: Variant) => {
      queryClient.setQueryData<Settings>(settingsQuery.queryKey, (before) => ({
        ...before,
        voice: next,
      }))
      mutate({ voice: next })
    },
    [queryClient, mutate],
  )
  return [voice, setVoice] as const
}
