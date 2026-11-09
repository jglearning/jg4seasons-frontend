import { useState } from 'react'
import { Card } from '../../shared/ui/Card'
import styles from './Student.module.css'

// S-03 홈 맨 위 "홈 화면에 추가" 안내(#38, 와이어프레임 S01q ④ 안 B). 닫으면 이 기기에서 다시 안 보인다.
// localStorage 예외(11/8 동섭 승인): 닫은 표시 하나만 둔다 — 학습 기록·코드가 아니다.
// 이미 홈 화면 앱으로 열었으면(standalone) 보이지 않는다.
// "방법 보기"(→ S-07 설정)는 S-07을 만들 때 붙인다
const DISMISSED_KEY = 'jg4s.homeScreenHintDismissed'

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function standalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  const displayStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches
  return iosStandalone || displayStandalone
}

export function HomeScreenHint() {
  const [visible, setVisible] = useState(() => !dismissed() && !standalone())
  if (!visible) return null

  function close() {
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // 저장하지 못하면 다음에 다시 보인다
    }
    setVisible(false)
  }

  return (
    <Card aria-label="홈 화면에 추가" className={styles.hint}>
      <p className={styles.hintText}>홈 화면에 추가하면 다음부터 바로 열 수 있어요</p>
      <button type="button" className={styles.hintClose} onClick={close}>
        닫기
      </button>
    </Card>
  )
}
