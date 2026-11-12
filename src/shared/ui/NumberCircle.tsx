import type { CSSProperties, ReactNode } from 'react'
import styles from './NumberCircle.module.css'

// 번호 동그라미(DESIGN.md 1.4) — 회차·지문·레벨 번호. 상태는 색만이 아니라 모양(채움·테두리·점선·고리·턱)으로도 구분된다.
// 보이는 모양만 그린다: 누를 수 있는 동그라미는 부르는 쪽이 <button>/<a> 안에 넣고 pressable을 켠다
// (부모를 누르면 턱이 사라지며 3px 내려간다). 상태를 읽어 주는 이름도 부르는 쪽 요소에 붙인다.
//   done     완료 — 레벨 진한 색 채움 + 크림 글자(체크 또는 숫자) + 레벨 턱
//   current  오늘·듣는 중 — 크림 채움 + ink 숫자 + 1px 테두리 + 바깥 고리(Black은 코랄) + 턱
//   overdue  밀림 — 흰 채움 + --bad 2px 테두리 + 턱
//   open     열림·아직 — 흰 채움 + line-strong 1.5px 테두리 + 턱
//   locked   잠김 — 채움 없음 + faint 점선 + muted 숫자, 턱 없음
//   lockedSoft 잠김(S-04 도장판) — 옅은 면 + 옅은 테두리 + muted 숫자, 턱 없음
//   level    레벨 번호(S-02·S-07 머리) — 크림 채움 + 레벨 진한 색 숫자, 턱 없음(정보 표시)
export type NumberCircleState =
  'done' | 'current' | 'overdue' | 'open' | 'locked' | 'lockedSoft' | 'level'

type NumberCircleProps = {
  state: NumberCircleState
  /** 지름 px */
  size: number
  /** 글자 크기 px — 화면마다 와이어프레임 값이 달라 따로 받는다. 없으면 지름의 42% */
  fontSize?: number
  /** 부모(<button>/<a>)를 누르면 3px 내려가는 모양. locked·lockedSoft·level은 무시 */
  pressable?: boolean
  children: ReactNode
}

export function NumberCircle({
  state,
  size,
  fontSize,
  pressable = false,
  children,
}: NumberCircleProps) {
  const style = {
    '--nc-size': `${size}px`,
    '--nc-font': `${fontSize ?? Math.round(size * 0.42)}px`,
  } as CSSProperties
  const canPress = pressable && state !== 'locked' && state !== 'lockedSoft' && state !== 'level'
  const className = [styles.circle, styles[state], canPress && styles.pressable]
    .filter(Boolean)
    .join(' ')
  return (
    <span className={className} style={style} aria-hidden data-state={state}>
      {children}
    </span>
  )
}
