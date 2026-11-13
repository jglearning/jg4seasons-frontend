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

/** dropped: `c`·`p` 중 모양이 틀려 버린 값이 있다(QR을 끝까지 읽지 못함 — 화면이 직접 입력을 안내한다) */
/** 반 QR·입장 링크 주소(#71, BE ADR 0033) — 가입 코드만. 찍으면 학생은 개인 코드 4자리만 친다 */
export function qrClassJoinUrl(origin: string, joinCode: string): string {
  const hash = new URLSearchParams({ c: joinCode }).toString()
  return `${origin}${JOIN_PATH}#${hash}`
}

export type QrJoinCodes = { joinCode?: string; personalCode?: string; dropped: boolean }

/**
 * `#c=…&p=…`에서 모양이 맞는 코드만 꺼낸다. `c`·`p`가 둘 다 없으면 QR 주소가 아니다(undefined, 모르는 키는 무시).
 * 가입 코드는 공백을 지우고 대문자로 본다. 개인 코드는 가입 코드도 맞을 때만 쓴다(#70)
 */
export function readQrJoinHash(hash: string): QrJoinCodes | undefined {
  if (!hash.startsWith('#')) return undefined
  const params = new URLSearchParams(hash.slice(1))
  const c = params.get('c')
  const p = params.get('p')
  if (c === null && p === null) return undefined
  const cleaned = c?.replace(/\s/g, '').toUpperCase()
  const joinCode = cleaned !== undefined && JOIN_CODE.test(cleaned) ? cleaned : undefined
  const personalCode = joinCode !== undefined && p !== null && PERSONAL_CODE.test(p) ? p : undefined
  const dropped =
    (c !== null && joinCode === undefined) || (p !== null && personalCode === undefined)
  return { joinCode, personalCode, dropped }
}
