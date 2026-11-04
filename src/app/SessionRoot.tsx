import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { setSessionExpiredHandler } from '../api'
import { meQuery } from '../features/auth/authApi'
import { entryPathFor, isEntryPath, type EntryState } from '../features/auth/entry'

// 모든 화면의 바깥 라우트. 세션이 끝나면(refresh 실패) 지금 주소에 맞는 입장 화면으로 보낸다.
// 여러 번 불려도 같은 입장 화면으로 replace하므로 결과는 같다. 이미 입장 화면이면 아무것도 하지 않는다.
// 이 탭에서 세션을 받은 적이 있으면(/me 캐시) "로그인이 끝났어요" 안내를 붙인다 — 처음 열 때 세션이 없는 것과 구분
export function SessionRoot() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { pathname } = useLocation()

  useEffect(
    () =>
      setSessionExpiredHandler(() => {
        if (isEntryPath(pathname)) return
        const hadSession = queryClient.getQueryData(meQuery.queryKey) !== undefined
        const state: EntryState | undefined = hadSession ? { reason: 'sessionExpired' } : undefined
        void navigate(entryPathFor(pathname), { replace: true, state })
      }),
    [navigate, pathname, queryClient],
  )

  return <Outlet />
}
