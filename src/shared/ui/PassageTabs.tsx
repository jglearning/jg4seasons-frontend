import { useEffect, useRef, useState } from 'react'
import { NumberCircle } from './NumberCircle'
import styles from './PassageTabs.module.css'

// S-05 지문 번호(v0.2 지시문 §2.2-5). 지름 46 번호 동그라미(DESIGN.md 1.4) — 지금 듣는 지문은 크림 + 바깥 고리,
// 완료(서버 값)는 진한 레벨 채움, 아직은 흰 면. 지문 수는 레벨마다 1~12(ADR-27): 6개까지 한 줄 균등, 7개부터 6칸씩 줄을 바꾼다(A9).
// 지문이 완료되는 순간(완료 값이 false → true) 그 동그라미가 한 번 커졌다 돌아온다(지시문 §2.3, 220ms)
export type PassageTab = { no: number; done: boolean }

type PassageTabsProps = {
  tabs: PassageTab[]
  selected: number
  onSelect: (no: number) => void
}

export function PassageTabs({ tabs, selected, onSelect }: PassageTabsProps) {
  const justDone = useJustDone(tabs)
  return (
    <nav
      aria-label="지문 고르기"
      className={[styles.tabs, tabs.length > 6 && styles.wrap].filter(Boolean).join(' ')}
    >
      {tabs.map((tab) => {
        const current = tab.no === selected
        const state = current ? 'current' : tab.done ? 'done' : 'open'
        return (
          <button
            key={tab.no}
            type="button"
            className={[styles.tab, justDone.has(tab.no) && styles.pop].filter(Boolean).join(' ')}
            aria-current={current ? 'true' : undefined}
            aria-label={`지문 ${tab.no} ${current ? '듣는 중' : tab.done ? '완료' : '아직 안 들음'}${current && tab.done ? ' · 완료' : ''}`}
            data-done={tab.done || undefined}
            onClick={() => onSelect(tab.no)}
          >
            <NumberCircle state={state} size={46} fontSize={19} pressable>
              {tab.no}
            </NumberCircle>
          </button>
        )
      })}
    </nav>
  )
}

/** 이번 렌더에 완료로 바뀐 지문 번호(커졌다 돌아오는 표시 동안만) */
function useJustDone(tabs: PassageTab[]): Set<number> {
  const before = useRef(new Map(tabs.map((t) => [t.no, t.done])))
  const [popped, setPopped] = useState<Set<number>>(new Set())
  const key = tabs.map((t) => `${t.no}:${t.done ? 1 : 0}`).join(',')

  useEffect(() => {
    const now = tabs.filter((t) => t.done && before.current.get(t.no) === false).map((t) => t.no)
    before.current = new Map(tabs.map((t) => [t.no, t.done]))
    if (now.length === 0) return
    setPopped(new Set(now))
    const timer = window.setTimeout(() => setPopped(new Set()), 300)
    return () => window.clearTimeout(timer)
    // 완료 값이 바뀔 때만
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return popped
}
