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
})

describe('needsCsrf', () => {
  it('GET·HEAD·OPTIONS 밖의 메서드만', () => {
    expect(['GET', 'head', 'OPTIONS'].map(needsCsrf)).toEqual([false, false, false])
    expect(['POST', 'PUT', 'patch', 'DELETE'].map(needsCsrf)).toEqual([true, true, true, true])
  })
})
