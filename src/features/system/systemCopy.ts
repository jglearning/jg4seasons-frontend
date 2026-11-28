import type { Copy } from '../../shared/errorMessage'

// 운영자 화면 문구(명사형) — 서버 title 대신 보일 code별 문구
export const SYSTEM_COPY: Copy = {
  codes: {
    ACADEMY_SLUG_TAKEN: '이미 쓰는 학원 주소입니다',
    LOGIN_ID_TAKEN: '이미 쓰는 아이디입니다',
    FORBIDDEN: '운영자만 할 수 있습니다',
  },
}

// O-04 프리토킹 학생 켜기·끄기. NOT_FOUND는 이 화면에서만 "목록에 없는 학생"(O-03의 NOT_FOUND와 뜻이 다름)
export const TALK_COPY: Copy = {
  codes: {
    ...SYSTEM_COPY.codes,
    NOT_FOUND: '재원생이 아닌 학생이 있어 아무것도 바꾸지 않았습니다. 목록을 다시 불러왔습니다',
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
