import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserKind } from './homeScreen'

// 홈 화면 추가 단계를 고르는 브라우저 판별(#164) — 인앱 브라우저는 UA에 크롬·사파리 표식도 있어 순서가 중요하다

// jsdom에는 maxTouchPoints가 없어 테스트마다 붙이고 뗀다
function as(ua: string, maxTouchPoints = 0) {
  vi.spyOn(Navigator.prototype, 'userAgent', 'get').mockReturnValue(ua)
  Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true })
}

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'maxTouchPoints')
})

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'

describe('browserKind', () => {
  it.each([
    [
      '카카오톡(안드로이드)',
      `${ANDROID_CHROME} KAKAOTALK 10.8.0`,
      { kind: 'inApp', app: '카카오톡' },
    ],
    ['카카오톡(아이폰)', `${IPHONE_SAFARI} KAKAOTALK 10.8.0`, { kind: 'inApp', app: '카카오톡' }],
    [
      '네이버 앱',
      `${ANDROID_CHROME} NAVER(inapp; search; 2000; 12.10.1)`,
      { kind: 'inApp', app: '네이버 앱' },
    ],
    ['인스타그램', `${IPHONE_SAFARI} Instagram 350.0.0`, { kind: 'inApp', app: '인스타그램' }],
    ['페이스북', `${IPHONE_SAFARI} [FBAN/FBIOS;FBAV/450.0]`, { kind: 'inApp', app: '페이스북' }],
    ['라인', `${ANDROID_CHROME} Line/14.0.0`, { kind: 'inApp', app: '라인' }],
    [
      '삼성 인터넷',
      'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36',
      { kind: 'samsung' },
    ],
    ['아이폰 사파리', IPHONE_SAFARI, { kind: 'iosSafari' }],
    [
      '아이폰 크롬',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1',
      { kind: 'iosOther' },
    ],
    ['안드로이드 크롬', ANDROID_CHROME, { kind: 'other' }],
  ] as const)('%s', (_, ua, expected) => {
    as(ua)
    expect(browserKind()).toEqual(expected)
  })

  it('아이패드는 데스크톱 Mac처럼 보여도 터치 지점 수로 사파리', () => {
    as(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
      5,
    )
    expect(browserKind()).toEqual({ kind: 'iosSafari' })
  })

  it('터치 없는 Mac은 그 밖', () => {
    as(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
      0,
    )
    expect(browserKind()).toEqual({ kind: 'other' })
  })
})
