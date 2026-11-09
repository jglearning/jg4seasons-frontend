// 학생 카드 QR 주소(#38) — A-02 카드가 만들고 S-01이 읽는다. 형식은 이 파일에만 둔다(BE #24 확정 때 여기만 고친다).
// 개인 코드는 `#` 뒤(fragment)로만 싣는다: 서버·CDN 요청과 Referer에 실리지 않는다. 쿼리 문자열 금지.
// 읽는 쪽은 읽자마자 주소에서 지우고 어디에도 저장하지 않는다(S-01 화면의 지역 state만)

const JOIN_PATH = '/join'
const JOIN_CODE = /^[A-Z0-9]{8}$/
const PERSONAL_CODE = /^\d{4}$/

/** 카드 QR에 넣을 주소. origin은 지금 화면(운영이면 https://www.jg4seasons.com) */
export function qrJoinUrl(origin: string, joinCode: string, personalCode: string): string {
  const hash = new URLSearchParams({ c: joinCode, p: personalCode }).toString()
  return `${origin}${JOIN_PATH}#${hash}`
}

export type QrJoinCodes = { joinCode?: string; personalCode?: string }

/** `#c=…&p=…`에서 모양이 맞는 코드만 꺼낸다. 하나도 없으면 undefined */
export function readQrJoinHash(hash: string): QrJoinCodes | undefined {
  if (!hash.startsWith('#')) return undefined
  const params = new URLSearchParams(hash.slice(1))
  const c = params.get('c')?.toUpperCase()
  const p = params.get('p')
  const codes: QrJoinCodes = {
    joinCode: c !== undefined && JOIN_CODE.test(c) ? c : undefined,
    personalCode: p !== null && PERSONAL_CODE.test(p) ? p : undefined,
  }
  return codes.joinCode || codes.personalCode ? codes : undefined
}
