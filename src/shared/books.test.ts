import { describe, expect, it } from 'vitest'
import {
  BOOK_OPTIONS,
  bookLabel,
  levelSeasonLabel,
  licenseBookLabel,
  licenseStatusLabel,
} from './books'

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

  it('레벨 칩 글자는 권 코드 없이', () => {
    expect(levelSeasonLabel('K', '겨울')).toBe('블랙 · 겨울')
  })
})

describe('교재 사용권 글자', () => {
  it('권 코드의 레벨로 반 관리와 같은 모양', () => {
    expect(licenseBookLabel('L3-B2', '봄')).toBe('블루 · 봄 (L3-B2)')
    expect(licenseBookLabel('K-B1', '겨울')).toBe('블랙 · 겨울 (K-B1)')
  })

  it('상태는 서버 값을 이름으로만', () => {
    expect(licenseStatusLabel('before_start')).toBe('시작 전')
    expect(licenseStatusLabel('active')).toBe('사용 중')
    expect(licenseStatusLabel('expired')).toBe('끝남')
  })
})
