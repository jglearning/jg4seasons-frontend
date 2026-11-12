import type { CSSProperties } from 'react'

// 교사·관리자 화면: 서버의 level.colorHex를 --level로 넣는 속성.
// #RRGGBB가 아니면 넣지 않는다 — 잘못된 값이면 --level을 쓰는 곳이 모두 색을 잃으므로 기본 ink를 유지한다
const HEX = /^#[0-9a-f]{6}$/i

export type LevelProps = { style?: CSSProperties; 'data-level'?: '' }

export function levelProps(colorHex: string | undefined): LevelProps {
  if (colorHex === undefined || !HEX.test(colorHex)) return {}
  return { style: { '--level': colorHex } as CSSProperties, 'data-level': '' }
}

// 학생 화면: 서버 level.code → DESIGN.md의 레벨 이름(<html data-level="green">).
// 색은 서버 colorHex가 아니라 교재 표지 기준 토큰(tokens.css [data-level='…'])에서 온다
export type LevelName = 'mint' | 'green' | 'blue' | 'navy' | 'black'

const NAMES: Record<string, LevelName> = {
  L1: 'mint',
  L2: 'green',
  L3: 'blue',
  L4: 'navy',
  K: 'black',
}

/** 모르는 code면 undefined — 그 화면은 레벨 없는 기본값(회색 바탕, ink 버튼)으로 그린다 */
export function levelName(code: string | undefined): LevelName | undefined {
  return code === undefined ? undefined : NAMES[code]
}
