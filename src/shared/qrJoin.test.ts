import { describe, expect, it } from 'vitest'
import { qrJoinUrl, readQrJoinHash } from './qrJoin'

describe('카드 QR 주소(#38)', () => {
  it('두 코드는 # 뒤에만 싣고, 읽으면 그대로 돌아온다', () => {
    const url = new URL(qrJoinUrl('https://www.jg4seasons.com', 'G7KM2XP4', '0381'))

    expect(url.pathname).toBe('/join')
    expect(url.search).toBe('')
    expect(readQrJoinHash(url.hash)).toEqual({
      joinCode: 'G7KM2XP4',
      personalCode: '0381',
      dropped: false,
    })
  })

  it('모양이 맞는 코드만 꺼낸다(가입 코드 소문자는 대문자로). 버린 값이 있으면 dropped', () => {
    expect(readQrJoinHash('#c=g7km2xp4&p=12')).toEqual({
      joinCode: 'G7KM2XP4',
      personalCode: undefined,
      dropped: true,
    })
    expect(readQrJoinHash('#c=G7KM&p=12345')).toEqual({
      joinCode: undefined,
      personalCode: undefined,
      dropped: true,
    })
    // 공백은 지우고 본다(QR 앱이 줄 끝 공백을 붙이는 경우)
    expect(readQrJoinHash('#c=%20G7KM2XP4%20')).toEqual({
      joinCode: 'G7KM2XP4',
      personalCode: undefined,
      dropped: false,
    })
  })

  it('개인 코드는 가입 코드도 맞을 때만 쓴다(#70)', () => {
    expect(readQrJoinHash('#p=0381')).toEqual({
      joinCode: undefined,
      personalCode: undefined,
      dropped: true,
    })
  })

  it('c·p가 없으면 QR 주소가 아니다(모르는 키는 무시)', () => {
    expect(readQrJoinHash('')).toBeUndefined()
    expect(readQrJoinHash('#')).toBeUndefined()
    expect(readQrJoinHash('#utm=abc')).toBeUndefined()
    expect(readQrJoinHash(`#c=G7KM2XP4&utm=abc`)).toEqual({
      joinCode: 'G7KM2XP4',
      personalCode: undefined,
      dropped: false,
    })
  })
})
