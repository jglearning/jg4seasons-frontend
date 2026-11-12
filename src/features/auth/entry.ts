import { readJoinCode } from './joinCode'

// 세션이 없을 때 보낼 입장 화면(03 §0.1): 교사·관리자 주소면 T-01, 학생은 기기에 반이 있으면 S-02, 없으면 S-01
export const ENTRY_PATHS = ['/join', '/rejoin', '/teacher/login'] as const

export function isEntryPath(pathname: string): boolean {
  return (ENTRY_PATHS as readonly string[]).includes(pathname)
}

export function entryPathFor(pathname: string): string {
  if (/^\/(teacher|admin)(\/|$)/.test(pathname)) return '/teacher/login'
  return readJoinCode() === undefined ? '/join' : '/rejoin'
}

/**
 * 입장 화면으로 보낸 이유(라우터 state)
 * - sessionExpired: 들어와 있다가 세션이 끝남(처음 열 때 세션이 없는 것과 구분)
 * 저장된 가입 코드를 쓸 수 없을 때는 들어가기 화면 안에서 ①로 돌아간다(#88 — 주소 이동 없음)
 */
export type EntryReason = 'sessionExpired'
export type EntryState = { reason: EntryReason }

export function entryReason(state: unknown): EntryReason | undefined {
  if (typeof state !== 'object' || state === null) return undefined
  const reason = (state as Partial<EntryState>).reason
  return reason === 'sessionExpired' ? reason : undefined
}
