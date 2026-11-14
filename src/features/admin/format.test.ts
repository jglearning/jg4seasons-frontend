import { describe, expect, it } from 'vitest'
import { classStatusLabel, koreaDateTime, roleLabel, weekdaysText } from './format'

describe('요일·상태·역할', () => {
  it('1=월 … 7=일, 받은 순서 그대로', () => {
    expect(weekdaysText([2, 4, 6])).toBe('화·목·토')
    expect(weekdaysText([7])).toBe('일')
  })

  it('반 상태와 역할은 명사형', () => {
    expect(classStatusLabel('active')).toBe('운영 중')
    expect(classStatusLabel('finished')).toBe('종강')
    expect(classStatusLabel('archived')).toBe('보관')
    expect(roleLabel('admin')).toBe('관리자')
    expect(roleLabel('teacher')).toBe('교사')
  })
})

describe('koreaDateTime — 서버 UTC를 한국 시간으로', () => {
  it('2026-11-06T09:20:00Z → 2026-11-06 18:20', () => {
    expect(koreaDateTime('2026-11-06T09:20:00Z')).toBe('2026-11-06 18:20')
  })

  it('자정을 넘는 시각도 한국 날짜로', () => {
    expect(koreaDateTime('2026-11-06T16:05:00Z')).toBe('2026-11-07 01:05')
  })
})
