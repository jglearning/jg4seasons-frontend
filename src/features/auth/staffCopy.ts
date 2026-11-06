import type { Copy } from '../../shared/errorMessage'

// 교사·관리자 로그인(T-01)의 오류 문구 — 명사형
export const STAFF_COPY: Copy = {
  codes: { INVALID_CREDENTIALS: '아이디 또는 비밀번호가 맞지 않습니다' },
  unlockAt: (time) => `${time} 이후 다시 로그인 가능`,
}
