import type { CSSProperties } from 'react'

// 서버의 level.colorHex를 --level로 넣는 속성(학생 화면 틀·교사 화면이 같이 쓴다).
// #RRGGBB가 아니면 넣지 않는다 — 잘못된 값이면 --level을 쓰는 곳이 모두 색을 잃으므로 기본 ink를 유지한다.
// 붙인 요소에는 data-level도 달아 --level-tint가 그 색으로 다시 계산되게 한다(tokens.css)
const HEX = /^#[0-9a-f]{6}$/i

export type LevelProps = { style?: CSSProperties; 'data-level'?: '' }

export function levelProps(colorHex: string | undefined): LevelProps {
  if (colorHex === undefined || !HEX.test(colorHex)) return {}
  return { style: { '--level': colorHex } as CSSProperties, 'data-level': '' }
}
