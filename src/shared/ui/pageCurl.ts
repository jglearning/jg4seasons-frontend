// WordCard 종이 넘기기(가이드 §5 WordCard, #64). 종이는 카드 아래 절반, 위 끝(가운데선)이 책의 등이다.
// 오른쪽 아래 모서리 C를 잡아 위로 올리면 모서리는 P로 가고, 접힌 선은 C–P의 수직이등분선이다.
// 접힌 선의 모서리 쪽은 아래 자리에서 빠지고(뜻이 보임), 그 부분을 접힌 선에 비춰 뒤집은 것이 종이 뒷면(flap)이다.
// t = 1이면 모서리가 위 절반 끝(카드 위 오른쪽)에 닿아 종이 전체가 위 절반으로 넘어간다.
// 좌표는 카드 기준 px(왼쪽 위 0,0). 종이 아래 자리는 y = half ~ 2·half

export type Point = { x: number; y: number }

export type Curl = {
  /** 아래 자리에 남은 종이 */
  cover: Point[]
  /** 뒤집혀 넘어가는 종이 뒷면 */
  flap: Point[]
  /** 접힌 선의 가운데와 각도(도, 선 방향) */
  crease: { x: number; y: number; angle: number }
  /** 카드 대각선 길이 — 접힌 선 띠의 길이로 쓴다 */
  diagonal: number
}

/** 모서리가 올라가며 왼쪽으로 휘는 정도(종이 폭에 대한 비율, 가운데에서 가장 크다) */
const BOW = 0.55

/**
 * width: 카드 폭, half: 종이(카드 절반) 높이, t: 0(아래 자리) ~ 1(위로 다 넘어감).
 * 0 이하·1 이상은 null — 부르는 쪽이 아래·위 자리 종이로 그린다
 */
export function pageCurl(width: number, half: number, t: number): Curl | null {
  if (!(t > 0 && t < 1) || !(width > 0) || !(half > 0)) return null
  const corner = { x: width, y: 2 * half }
  // 모서리는 손가락 높이를 그대로 따라 위로(아래 끝 → 위 끝), 가로로는 활처럼 왼쪽으로 휜다
  const p = { x: width - width * BOW * Math.sin(Math.PI * t), y: 2 * half - 2 * half * t }
  const len = Math.hypot(corner.x - p.x, corner.y - p.y)
  if (len === 0) return null
  const u = { x: (corner.x - p.x) / len, y: (corner.y - p.y) / len }
  const m = { x: (corner.x + p.x) / 2, y: (corner.y + p.y) / 2 }
  const side = (q: Point) => (q.x - m.x) * u.x + (q.y - m.y) * u.y
  const sheet: Point[] = [
    { x: 0, y: half },
    { x: width, y: half },
    { x: width, y: 2 * half },
    { x: 0, y: 2 * half },
  ]
  const cover = clip(sheet, side, (v) => v <= 0)
  const removed = clip(sheet, side, (v) => v >= 0)
  const flap = removed.map((q) => {
    const d = side(q)
    return { x: q.x - 2 * d * u.x, y: q.y - 2 * d * u.y }
  })
  const angle = (Math.atan2(u.y, u.x) * 180) / Math.PI - 90
  return { cover, flap, crease: { x: m.x, y: m.y, angle }, diagonal: Math.hypot(width, 2 * half) }
}

/** 다각형을 직선 한쪽으로 자른다(Sutherland–Hodgman, 직선 하나) */
function clip(poly: Point[], side: (p: Point) => number, keep: (v: number) => boolean): Point[] {
  const out: Point[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const va = side(a)
    const vb = side(b)
    if (keep(va)) out.push(a)
    if (keep(va) !== keep(vb) && va !== vb) {
      const k = va / (va - vb)
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k })
    }
  }
  return out
}

export function polygon(points: Point[]): string {
  if (points.length === 0) return 'polygon(0 0, 0 0, 0 0)'
  return `polygon(${points.map((p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(', ')})`
}
