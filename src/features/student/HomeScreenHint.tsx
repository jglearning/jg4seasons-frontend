import { useState } from 'react'
import { Link } from 'react-router'
import { promptInstall, useCanInstall } from '../../shared/installPrompt'
import { Card } from '../../shared/ui/Card'
import { HOME_SCREEN_SECTION_ID, isStandalone } from './homeScreen'
import styles from './Student.module.css'

// S-03 홈 맨 위 "홈 화면에 추가" 안내(#38, 와이어프레임 S01q ④ 안 B). 닫으면 이 기기에서 다시 안 보인다.
// localStorage 예외(11/8 동섭 승인): 닫은 표시 하나만 둔다 — 학습 기록·코드가 아니다.
// 이미 홈 화면 앱으로 열었으면(standalone) 보이지 않는다.
// "방법 보기"는 S-07 설정의 홈 화면 추가 카드로 바로 간다(S07 검토 H3a, 11/9).
// 크롬·삼성 인터넷이 설치를 허락하면(#164) "방법 보기" 대신 "추가하기" — 누르면 바로 설치 창.
// 설치하면 카드를 닫는다(홈 화면 앱으로 열면 어차피 안 보인다). 취소하면 "방법 보기"로 돌아간다
const DISMISSED_KEY = 'jg4s.homeScreenHintDismissed'

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function HomeScreenHint() {
  const [visible, setVisible] = useState(() => !dismissed() && !isStandalone())
  const canInstall = useCanInstall()
  if (!visible) return null

  function close() {
    try {
      localStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // 저장하지 못하면 다음에 다시 보인다
    }
    setVisible(false)
  }

  async function install() {
    if ((await promptInstall()) === 'accepted') close()
  }

  return (
    <Card aria-label="홈 화면에 추가" className={styles.hint}>
      <p className={styles.hintText}>홈 화면에 추가하면 다음부터 바로 열 수 있어요</p>
      <div className={styles.hintActions}>
        {canInstall ? (
          <button type="button" className={styles.hintLink} onClick={install}>
            추가하기
          </button>
        ) : (
          <Link to={`/settings#${HOME_SCREEN_SECTION_ID}`} className={styles.hintLink}>
            방법 보기
          </Link>
        )}
        <button type="button" className={styles.hintClose} onClick={close}>
          닫기
        </button>
      </div>
    </Card>
  )
}
