import { describe, expect, it } from 'vitest'
import { fitSize, MAX_EDGE } from './resizeImage'

// 그리기(캔버스·JPEG)는 jsdom이 못 해서 실기기에서 본다. 여기서는 크기 계산만
describe('fitSize', () => {
  it('세로 사진은 높이를 1600에 맞추고 비율을 지킨다', () => {
    expect(fitSize(3024, 4032)).toEqual({ width: 1200, height: MAX_EDGE })
  })

  it('가로 사진은 너비를 1600에 맞춘다', () => {
    expect(fitSize(4032, 3024)).toEqual({ width: MAX_EDGE, height: 1200 })
  })

  it('작은 사진은 키우지 않는다', () => {
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('긴 변이 딱 1600이면 그대로', () => {
    expect(fitSize(1600, 900)).toEqual({ width: 1600, height: 900 })
  })
})
