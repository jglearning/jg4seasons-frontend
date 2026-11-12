import { describe, expect, it } from 'vitest'
import {
  lessonCircleNo,
  lessonDayLabel,
  lessonLevelCode,
  lessonNoLabel,
  lessonTileNo,
  voiceLabel,
} from './lessonLabel'

describe('회차 번호는 code 끝(백엔드 ADR-27)', () => {
  it('정규 회차: 5회 · 05 · Day 5', () => {
    expect(lessonNoLabel('L2-B1-05')).toBe('5회')
    expect(lessonTileNo('L2-B1-05')).toBe('05')
    expect(lessonDayLabel('L2-B1-05')).toBe('Day 5')
  })

  it('블랙: number(진도표 순서)와 다른 교재 번호 — K-B1-07 → 7회, K-B1-24 → 24', () => {
    expect(lessonNoLabel('K-B1-07')).toBe('7회')
    expect(lessonTileNo('K-B1-24')).toBe('24')
  })

  it('번호 동그라미: 5 · S1(앞의 0 없이)', () => {
    expect(lessonCircleNo('L2-B1-05')).toBe('5')
    expect(lessonCircleNo('K-B1-24')).toBe('24')
    expect(lessonCircleNo('K-B1-S1')).toBe('S1')
  })

  it('보충: K-B1-S1 → 보충 1 · S1', () => {
    expect(lessonNoLabel('K-B1-S1')).toBe('보충 1')
    expect(lessonTileNo('K-B1-S4')).toBe('S4')
    expect(lessonDayLabel('K-B1-S2')).toBe('보충 2')
  })

  it('모양이 다른 code는 그대로', () => {
    expect(lessonNoLabel('ABC')).toBe('ABC')
  })
})

describe('회차 code 앞의 레벨 코드(S-06 레벨 색용)', () => {
  it('L1~L4·K, 보충 회차 포함. 모양이 다르면 undefined', () => {
    expect(
      ['L1-B1-05', 'L2-B2-24', 'L3-B1-01', 'L4-B4-08', 'K-B1-07', 'K-B1-S1'].map(lessonLevelCode),
    ).toEqual(['L1', 'L2', 'L3', 'L4', 'K', 'K'])
    expect(lessonLevelCode('L5-B1-05')).toBeUndefined()
    expect(lessonLevelCode('L2-05')).toBeUndefined()
    expect(lessonLevelCode('')).toBeUndefined()
  })
})

describe('목소리 이름', () => {
  it('us_w·us_m·uk_w·uk_m, 목소리가 아니면 null', () => {
    expect(['us_w', 'us_m', 'uk_w', 'uk_m'].map(voiceLabel)).toEqual([
      '미국 여',
      '미국 남',
      '영국 여',
      '영국 남',
    ])
    expect(voiceLabel('1.0')).toBeNull()
  })
})
