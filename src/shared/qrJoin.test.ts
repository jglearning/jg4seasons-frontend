import { describe, expect, it } from 'vitest'
import { qrJoinUrl, readQrJoinHash } from './qrJoin'

describe('카드 QR 주소(#38)', () => {
  it('두 코드는 # 뒤에만 싣고, 읽으면 그대로 돌아온다', () => {
    const url = new URL(qrJoinUrl('https://www.jg4seasons.com', 'G7KM2XP4', '0381'))

    expect(url.pathname).toBe('/join')
    expect(url.search).toBe('')
    expect(readQrJoinHash(url.hash)).toEqual({ joinCode: 'G7KM2XP4', personalCode: '0381' })
  })

  it('모양이 맞는 코드만 꺼낸다(가입 코드 소문자는 대문자로)', () => {
    expect(readQrJoinHash('#c=g7km2xp4&p=12')).toEqual({
      joinCode: 'G7KM2XP4',
      personalCode: undefined,
    })
    expect(readQrJoinHash('#c=G7KM&p=12345')).toBeUndefined()
    expect(readQrJoinHash('')).toBeUndefined()
    expect(readQrJoinHash('#')).toBeUndefined()
  })
})
