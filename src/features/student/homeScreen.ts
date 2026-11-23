// 홈 화면 추가 안내(S-03 홈 카드·S-07 설정)가 같이 쓰는 기기 판별

/** S-07에서 홈 카드 "방법 보기"가 가리키는 카드 id(`/settings#home-screen`) */
export const HOME_SCREEN_SECTION_ID = 'home-screen'

/** 이미 홈 화면 앱으로 열었는지(iOS standalone · display-mode standalone) */
export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  const displayStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  return iosStandalone || displayStandalone
}

/**
 * 아이폰·아이패드인지(사파리 공유 버튼 안내). iPadOS는 데스크톱 Mac처럼 보이므로 터치 지점 수로 가른다.
 * 그 밖(안드로이드·PC 등)은 ⋮ 메뉴 안내 — 와이어프레임 S07 검토(11/9)
 */
export function isIos(): boolean {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return true
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
}

/** 앱 안 브라우저(홈 화면 추가가 없다) — UA 표식과 화면에 쓸 앱 이름 */
const IN_APPS: Array<[RegExp, string]> = [
  [/KAKAOTALK/i, '카카오톡'],
  [/NAVER/, '네이버 앱'],
  [/Instagram/, '인스타그램'],
  [/FBAN|FBAV/, '페이스북'],
  [/\bLine\//, '라인'],
]

/**
 * 홈 화면 추가 단계를 고르는 브라우저 종류(#164). 순서가 중요하다 — 인앱 브라우저는 UA에 크롬·사파리 표식도 있다
 * - inApp: 카카오톡·네이버 앱 등 안. 먼저 다른 브라우저로 열어야 한다
 * - samsung: 삼성 인터넷(메뉴가 오른쪽 아래 ≡)
 * - iosSafari / iosOther: 아이폰·아이패드 사파리 / 그 밖(크롬 CriOS·파이어폭스 FxiOS 등)
 * - other: 안드로이드 크롬 등(오른쪽 위 ⋮)
 */
export type BrowserKind =
  | { kind: 'inApp'; app: string }
  | { kind: 'samsung' }
  | { kind: 'iosSafari' }
  | { kind: 'iosOther' }
  | { kind: 'other' }

export function browserKind(): BrowserKind {
  const ua = navigator.userAgent
  const inApp = IN_APPS.find(([pattern]) => pattern.test(ua))
  if (inApp) return { kind: 'inApp', app: inApp[1] }
  if (/SamsungBrowser/.test(ua)) return { kind: 'samsung' }
  if (isIos())
    return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? { kind: 'iosOther' } : { kind: 'iosSafari' }
  return { kind: 'other' }
}

/** 인앱 브라우저에서 복사해 갈 주소 — 다른 브라우저는 로그인이 따로라 지금 화면이 아니라 첫 화면 */
export function siteUrl(): string {
  return `${window.location.origin}/`
}
