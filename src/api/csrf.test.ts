import { describe, expect, it } from 'vitest'
import { needsCsrf, readCsrfToken } from './csrf'

describe('readCsrfToken', () => {
  it('여러 쿠키 중 csrf 값만 꺼낸다(= 이 들어간 값 포함)', () => {
    expect(readCsrfToken('a=1; csrf=ab%3Dc=d; b=2')).toBe('ab=c=d')
  })

  it('없으면 undefined', () => {
    expect(readCsrfToken('a=1; xcsrf=2')).toBeUndefined()
    expect(readCsrfToken('')).toBeUndefined()
  })

  it('잘못된 % 인코딩이어도 던지지 않고 받은 값을 준다(모든 상태 변경 요청이 막히지 않게)', () => {
    expect(readCsrfToken('csrf=abc%E0%A4')).toBe('abc%E0%A4')
  })
})

describe('needsCsrf', () => {
  it('GET·HEAD·OPTIONS 밖의 메서드만', () => {
    expect(['GET', 'head', 'OPTIONS'].map(needsCsrf)).toEqual([false, false, false])
    expect(['POST', 'PUT', 'patch', 'DELETE'].map(needsCsrf)).toEqual([true, true, true, true])
  })
})
