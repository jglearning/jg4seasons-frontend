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
