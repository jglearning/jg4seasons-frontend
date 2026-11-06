import type { Copy } from '../../shared/errorMessage'

// 관리자 화면 오류 문구(명사형) — 서버 title 대신 보일 code별 문구
export const ADMIN_COPY: Copy = {
  codes: {
    LOGIN_ID_TAKEN: '이미 쓰는 아이디입니다',
    SELF_CHANGE_NOT_ALLOWED: '자기 계정은 비활성화할 수 없습니다',
    FORBIDDEN: '관리자만 할 수 있습니다',
  },
}
