import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, CircleAlert, Share } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { logout, meQuery } from '../../api/session'
import { Button } from '../../shared/ui/Button'
import { Card } from '../../shared/ui/Card'
import { LevelChip } from '../../shared/ui/LevelChip'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { HOME_SCREEN_SECTION_ID, isIos, isStandalone } from './homeScreen'
import { StudentTabs } from './StudentTabs'
import { homeQuery } from './studentApi'
import styles from './Student.module.css'

// S-07 설정(와이어프레임 S07_* v2, 11/9 검토): 내 정보 · 홈 화면에 추가 방법 · 로그아웃.
// 로그아웃은 확인 없이 바로(안 B) → S-02(기기에 기억한 가입 코드는 남는다). 실패하면 화면 그대로 두고 다시 누르게.
// 홈 응답을 받는 동안은 아무것도 그리지 않고, 못 받으면 내 정보만 빼고 보인다
export function SettingsPage() {
  const home = useQuery(homeQuery)
  const me = useQuery(meQuery)
  const level = home.data?.class.level

  return (
    <StudentLayout levelColorHex={level?.colorHex}>
      <header className={styles.subHeader}>
        <Link to="/" className={styles.backButton} aria-label="홈으로">
          <ChevronLeft size={24} strokeWidth={2} aria-hidden />
        </Link>
        <h1 className={styles.subTitle}>설정</h1>
      </header>

      {!home.isPending && (
        <div className={styles.sections}>
          {home.data && (
            <Card aria-label="내 정보">
              <p className={styles.settingsName}>{me.data?.name}</p>
              <p className={styles.settingsClass}>
                <LevelChip>
                  {home.data.class.level.nameKo} · {home.data.class.book.season}
                </LevelChip>
                <span>{home.data.class.name}</span>
              </p>
            </Card>
          )}
          <HomeScreenCard />
          <LogoutCard />
        </div>
      )}

      <StudentTabs home={home.data} />
    </StudentLayout>
  )
}

/** 홈 화면에 추가 방법(3) — 아이폰은 공유 버튼, 그 밖은 ⋮ 메뉴. 이미 홈 화면 앱이면 한 줄 */
function HomeScreenCard() {
  const { hash } = useLocation()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [standalone] = useState(isStandalone)
  const [ios] = useState(isIos)

  // 홈 카드 "방법 보기"(/settings#home-screen)로 오면 이 카드로 옮기고 제목에 포커스
  useEffect(() => {
    if (hash !== `#${HOME_SCREEN_SECTION_ID}`) return
    const heading = headingRef.current
    heading?.scrollIntoView?.({ block: 'start' })
    heading?.focus({ preventScroll: true })
  }, [hash])

  if (standalone) {
    return <p className={styles.settingsNote}>홈 화면 앱으로 쓰고 있어요</p>
  }

  return (
    <Card id={HOME_SCREEN_SECTION_ID} aria-labelledby="home-screen-title">
      <h2 id="home-screen-title" ref={headingRef} tabIndex={-1} className={styles.settingsTitle}>
        홈 화면에 추가
      </h2>
      <p className={styles.settingsText}>앱처럼 바로 열 수 있어요</p>
      {ios ? (
        <ol className={styles.steps}>
          <li>
            1. 아래 공유 버튼{' '}
            <Share size={18} strokeWidth={2} className={styles.stepIcon} aria-hidden />을 눌러요
          </li>
          <li>2. '홈 화면에 추가'를 골라요</li>
        </ol>
      ) : (
        <ol className={styles.steps}>
          <li>1. 오른쪽 위 ⋮ 를 눌러요</li>
          <li>2. '홈 화면에 추가'를 골라요</li>
        </ol>
      )}
    </Card>
  )
}

/** 로그아웃(4~8). 성공하면 S-02로 옮기고 캐시를 비운다(이 기기에 이 학생 데이터가 남지 않게) */
function LogoutCard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [state, setState] = useState<'idle' | 'pending' | 'failed'>('idle')

  async function onLogout() {
    setState('pending')
    try {
      await logout()
    } catch {
      setState('failed')
      return
    }
    await navigate('/rejoin', { replace: true })
    queryClient.clear()
  }

  return (
    <Card aria-labelledby="logout-title">
      <h2 id="logout-title" className={styles.settingsTitle}>
        로그아웃
      </h2>
      <p className={styles.settingsText}>
        로그아웃하면 개인 코드 4자리를 다시 넣어야 들어올 수 있어요
      </p>
      <Button
        variant="secondary"
        block
        className={styles.settingsButton}
        onClick={() => void onLogout()}
        disabled={state === 'pending'}
      >
        {state === 'pending' ? '나가는 중' : '로그아웃'}
      </Button>
      {state === 'failed' && (
        <p className={styles.settingsError} role="alert">
          <CircleAlert size={18} strokeWidth={2} aria-hidden />
          로그아웃하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요
        </p>
      )}
    </Card>
  )
}
