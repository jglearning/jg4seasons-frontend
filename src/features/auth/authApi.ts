import { api } from '../../api'
import { unwrap } from '../../api/errors'

// 입장 API 호출은 이 파일에만 둔다(03 §1). 응답 타입은 src/api/generated의 경로 타입에서 나온다.
// 로그인은 일부러 useMutation을 쓰지 않는다 — 뮤테이션 캐시가 요청 값(개인 코드·비밀번호)을 들고 있게 되기 때문이다.
// 앱 전체가 쓰는 세션 확인(/me)은 src/api/session.ts

/** 학생 입장 요청의 시간 제한. 응답이 오지 않으면 화면이 "확인하는 중"·"들어가는 중"에 갇힌다(fetch에는 제한이 없다) */
export const ENTRY_TIMEOUT_MS = 10_000

/** 시간 제한을 넘겨 끊은 요청인지(fetch는 abort 이유를 그대로 던진다) */
export function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError'
}

// AbortSignal.timeout 대신 전역 setTimeout — 테스트의 가짜 타이머로 시간을 넘길 수 있게
async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(new DOMException('응답이 늦어요', 'TimeoutError')),
    ENTRY_TIMEOUT_MS,
  )
  try {
    return await run(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

export function verifyJoinCode(code: string) {
  return withTimeout((signal) =>
    unwrap(api.POST('/api/v1/auth/code/verify', { body: { code }, signal })),
  )
}

export function loginStudent(code: string, personalCode: string) {
  return withTimeout((signal) =>
    unwrap(api.POST('/api/v1/auth/student/login', { body: { code, personalCode }, signal })),
  )
}

export function loginStaff(loginId: string, password: string) {
  return unwrap(api.POST('/api/v1/auth/staff/login', { body: { loginId, password } }))
}
