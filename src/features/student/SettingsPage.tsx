import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, CircleAlert, Share } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { logout, meQuery } from '../../api/session'
import { levelEnglish } from '../../shared/level'
import { ActionRow } from '../../shared/ui/ActionRow'
import { Button } from '../../shared/ui/Button'
import { NumberCircle } from '../../shared/ui/NumberCircle'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { HOME_SCREEN_SECTION_ID, isIos, isStandalone } from './homeScreen'
import { homeQuery } from './studentApi'
import styles from './SettingsPage.module.css'

// S-07 설정 v0.2(지시문 §6.5): 내 정보 · 홈 화면에 추가(줄을 누르면 아래에 펼침) · 맨 아래 로그아웃. 탭 바 없음.
// 로그아웃은 확인 없이 바로 → S-02(기기에 기억한 가입 코드는 남는다). 실패하면 화면 그대로 두고 다시 누르게.
// 홈 응답을 받는 동안은 아무것도 그리지 않고, 못 받으면 내 정보만 빼고 보인다
export function SettingsPage() {
  const home = useQuery(homeQuery)
  const me = useQuery(meQuery)
  const klass = home.data?.class

  return (
    <StudentLayout levelCode={klass?.level.code}>
      <header className={styles.header}>
        <Link to="/" className={styles.back} aria-label="홈으로">
          <ChevronLeft size={24} strokeWidth={2} aria-hidden />
        </Link>
        <h1 className={styles.title}>설정</h1>
      </header>

      {!home.isPending && (
        <>
          <div className={styles.body}>
            {klass && (
              <section aria-label="내 정보" className={styles.me}>
                <NumberCircle state="level" size={52} fontSize={26}>
                  {levelMark(klass.level.code)}
                </NumberCircle>
                <div className={styles.meText}>
                  <p className={styles.name}>{me.data?.name}</p>
                  <p className={styles.classLine}>
                    {klass.name} ·{' '}
                    {[levelEnglish(klass.level.code), klass.level.nameKo].filter(Boolean).join(' ')}
                  </p>
                </div>
              </section>
            )}
            <HomeScreenGroup />
          </div>
          <LogoutFooter />
        </>
      )}
    </StudentLayout>
  )
}

/** 레벨 번호 동그라미 글자: L1~L4 → 1~4, 번호 없는 레벨(Black K)은 코드 그대로 */
function levelMark(code: string): string {
  return /^L\d$/.test(code) ? code.slice(1) : code
}

const STEPS_ID = 'home-screen-steps'

/** "앱" 묶음 — 홈 화면에 추가 줄(누르면 기기별 안내를 펼침). 이미 홈 화면 앱이면 한 줄 */
function HomeScreenGroup() {
  const { hash } = useLocation()
  const fromHint = hash === `#${HOME_SCREEN_SECTION_ID}`
  const rowRef = useRef<HTMLButtonElement>(null)
  const [standalone] = useState(isStandalone)
  const [ios] = useState(isIos)
  // 홈 카드 "방법 보기"(/settings#home-screen)로 오면 펼친 채로 시작하고 이 줄로 옮겨 포커스.
  // 이 묶음은 홈 응답을 받은 뒤 처음 그려지므로 첫 값으로 충분하다(설정 화면 안에는 이 주소로 가는 링크가 없다)
  const [open, setOpen] = useState(fromHint)

  useEffect(() => {
    if (!fromHint) return
    const row = rowRef.current
    row?.scrollIntoView?.({ block: 'start' })
    row?.focus({ preventScroll: true })
  }, [fromHint])

  return (
    <section id={HOME_SCREEN_SECTION_ID} aria-labelledby="app-group-title" className={styles.group}>
      <h2 id="app-group-title" className={styles.groupTitle}>
        앱
      </h2>
      {standalone ? (
        <p className={styles.note}>홈 화면 앱으로 쓰고 있어요</p>
      ) : (
        <>
          <ActionRow
            ref={rowRef}
            title="홈 화면에 추가"
            detail="앱처럼 바로 열 수 있어요 · 방법 보기"
            expanded={open}
            controls={STEPS_ID}
            onToggle={() => setOpen((value) => !value)}
          />
          <div id={STEPS_ID} className={styles.panel} hidden={!open}>
            {ios ? (
              <ol className={styles.steps}>
                <li>
                  1. 아래 공유 버튼{' '}
                  <Share size={18} strokeWidth={2} className={styles.stepIcon} aria-hidden />을
                  눌러요
                </li>
                <li>2. '홈 화면에 추가'를 골라요</li>
              </ol>
            ) : (
              <ol className={styles.steps}>
                <li>1. 오른쪽 위 ⋮ 를 눌러요</li>
                <li>2. '홈 화면에 추가'를 골라요</li>
              </ol>
            )}
          </div>
        </>
      )}
    </section>
  )
}

/** 로그아웃. 성공하면 S-02로 옮기고 캐시를 비운다(이 기기에 이 학생 데이터가 남지 않게) */
function LogoutFooter() {
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
    <div className={styles.footer}>
      <Button
        variant="secondary"
        block
        onClick={() => void onLogout()}
        disabled={state === 'pending'}
      >
        {state === 'pending' ? '나가는 중' : '로그아웃'}
      </Button>
      {state === 'failed' && (
        <p className={styles.error} role="alert">
          <CircleAlert size={18} strokeWidth={2} aria-hidden />
          로그아웃하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요
        </p>
      )}
    </div>
  )
}
