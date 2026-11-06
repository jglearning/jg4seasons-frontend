import { describe, expect, it } from 'vitest'
import {
  BOOK_OPTIONS,
  bookLabel,
  classStatusLabel,
  koreaDateTime,
  roleLabel,
  weekdaysText,
} from './format'

describe('권 고르기(백엔드 기준 데이터 V2와 같은 17권, 문법 제목은 보이지 않음)', () => {
  it('L1~L4 × 겨울·봄·여름·가을 + 블랙 1권', () => {
    expect(BOOK_OPTIONS).toHaveLength(17)
    expect(BOOK_OPTIONS[0]).toEqual({ value: 'L1-B1', label: '민트 · 겨울 (L1-B1)' })
    expect(BOOK_OPTIONS).toContainEqual({ value: 'L2-B4', label: '그린 · 가을 (L2-B4)' })
    expect(BOOK_OPTIONS.at(-1)).toEqual({ value: 'K-B1', label: '블랙 · 겨울 (K-B1)' })
  })

  it('반 응답(levelCode·season·bookCode)을 같은 모양으로', () => {
    expect(bookLabel('L2-B1', 'L2', '겨울')).toBe('그린 · 겨울 (L2-B1)')
    // 모르는 레벨이면 코드 그대로
    expect(bookLabel('L9-B1', 'L9', '봄')).toBe('L9 · 봄 (L9-B1)')
  })
})

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
