import { describe, expect, it } from 'vitest'
import { pageCurl, type Point } from './pageCurl'

/** 다각형 넓이(신발끈 공식) */
function area(points: Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

const W = 360
const HALF = 290

describe('pageCurl — 종이 모서리 말아 넘기기', () => {
  it('아래 자리(0)·다 넘어감(1)과 그 바깥은 null — 부르는 쪽이 한 장으로 그린다', () => {
    for (const t of [-0.1, 0, 1, 1.2]) expect(pageCurl(W, HALF, t)).toBeNull()
    expect(pageCurl(0, HALF, 0.5)).toBeNull()
    expect(pageCurl(W, 0, 0.5)).toBeNull()
  })

  it('남은 앞면 + 넘어가는 뒷면 = 종이 한 장(접어도 넓이는 같다)', () => {
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const curl = pageCurl(W, HALF, t)
      expect(curl).not.toBeNull()
      expect(area(curl!.cover) + area(curl!.flap)).toBeCloseTo(W * HALF, 0)
    }
  })

  it('넘길수록 아래 자리에 남는 종이가 줄어든다', () => {
    const covers = [0.1, 0.3, 0.5, 0.7, 0.9].map((t) => area(pageCurl(W, HALF, t)!.cover))
    for (let i = 1; i < covers.length; i++) expect(covers[i]).toBeLessThan(covers[i - 1])
  })

  it('앞면은 아래 자리 안에만 있다(위 절반의 단어 칸으로 나가지 않는다)', () => {
    const curl = pageCurl(W, HALF, 0.4)!
    for (const p of curl.cover) {
      expect(p.y).toBeGreaterThanOrEqual(HALF - 1e-6)
      expect(p.y).toBeLessThanOrEqual(2 * HALF + 1e-6)
    }
  })

  it('조금 넘기면 오른쪽 아래 모서리부터 접힌다', () => {
    const curl = pageCurl(W, HALF, 0.05)!
    expect(curl.crease.x).toBeGreaterThan(W / 2)
    expect(curl.crease.y).toBeGreaterThan(HALF * 1.5)
  })
})
