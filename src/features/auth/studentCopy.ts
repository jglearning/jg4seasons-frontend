import type { Copy } from '../../shared/errorMessage'

// 학생 입장 화면(S-01·S-02)의 오류 문구
export const STUDENT_COPY: Copy = {
  codes: { INVALID_CREDENTIALS: '가입 코드 또는 개인 코드가 맞지 않아요' },
  unlockAt: (time) => `${time}부터 다시 할 수 있어요`,
}
