import type { Copy } from '../../shared/errorMessage'

// 운영자 화면 문구(명사형) — 서버 title 대신 보일 code별 문구
export const SYSTEM_COPY: Copy = {
  codes: {
    ACADEMY_SLUG_TAKEN: '이미 쓰는 학원 주소입니다',
    LOGIN_ID_TAKEN: '이미 쓰는 아이디입니다',
    FORBIDDEN: '운영자만 할 수 있습니다',
  },
}

const ACADEMY_STATUS = { active: '운영', suspended: '정지' } as const
export function academyStatusLabel(status: keyof typeof ACADEMY_STATUS): string {
  return ACADEMY_STATUS[status]
}

/** 사용권 적용 — false 직영(모든 권 무제한), true 연계(사용권 있는 권만) */
export function licenseModeLabel(licenseEnforced: boolean): string {
  return licenseEnforced ? '연계' : '직영'
}
