import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  CircleAlert,
  Copy,
  Ellipsis,
  EllipsisVertical,
  Menu,
  Share,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ApiError } from '../../api/errors'
import { logout, meQuery } from '../../api/session'
import { promptInstall, useCanInstall } from '../../shared/installPrompt'
import { levelEnglish } from '../../shared/level'
import { ActionRow } from '../../shared/ui/ActionRow'
import { Button } from '../../shared/ui/Button'
import { NumberCircle } from '../../shared/ui/NumberCircle'
import { StudentLayout } from '../../shared/ui/StudentLayout'
import { browserKind, HOME_SCREEN_SECTION_ID, isStandalone, siteUrl } from './homeScreen'
import { homeQuery } from './studentApi'
import styles from './SettingsPage.module.css'

// S-07 설정 v0.2(지시문 §6.5): 내 정보 · 홈 화면에 추가(줄을 누르면 아래에 펼침) · 맨 아래 로그아웃. 탭 바 없음.
// 로그아웃은 확인 없이 바로 → S-02(기기에 기억한 가입 코드는 남는다). 실패하면 화면 그대로 두고 다시 누르게.
// 홈 응답을 받는 동안은 아무것도 그리지 않고(내 정보가 뒤늦게 끼어들지 않게), 못 받거나 오프라인이라
// 요청이 멈췄으면(paused) 내 정보만 빼고 보인다 — 로그아웃은 언제나 누를 수 있게
export function SettingsPage() {
  const home = useQuery(homeQuery)
  const me = useQuery(meQuery)
  const klass = home.data?.class
  const waiting = home.isPending && home.fetchStatus !== 'paused'

  return (
    <StudentLayout levelCode={klass?.level.code}>
      <header className={styles.header}>
        <Link to="/" className={styles.back} aria-label="홈으로">
          <ChevronLeft size={24} strokeWidth={2} aria-hidden />
        </Link>
        <h1 className={styles.title}>설정</h1>
      </header>

      {!waiting && (
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
            <InstallGuide />
          </div>
        </>
      )}
    </section>
  )
}

const LAST_STEP = '홈 화면의 4 Seasons 아이콘으로 열어요'

/** 메뉴 버튼 그림 — 읽을 때는 이름으로 */
function MenuIcon({ icon: Icon, label }: { icon: typeof Share; label: string }) {
  return (
    <Icon size={18} strokeWidth={2} className={styles.stepIcon} role="img" aria-label={label} />
  )
}

/**
 * 펼친 안내(#164): 설치 이벤트가 있으면(크롬·삼성 인터넷) 버튼 하나, 없거나 취소하면 브라우저별 단계.
 * 메뉴 이름은 브라우저 버전마다 바뀐다 — 실기기에서 맞춘 값(11/23 조사, 백엔드 frontend-notes)
 */
function InstallGuide() {
  const canInstall = useCanInstall()
  const [installed, setInstalled] = useState(false)
  const [browser] = useState(browserKind)

  if (installed) {
    return <p className={styles.lead}>추가했어요. {LAST_STEP}</p>
  }

  if (canInstall) {
    return (
      <div className={styles.install}>
        <Button
          block
          onClick={async () => {
            if ((await promptInstall()) === 'accepted') setInstalled(true)
          }}
        >
          홈 화면에 추가하기
        </Button>
        <p className={styles.note}>누르면 바로 설치 창이 떠요</p>
      </div>
    )
  }

  switch (browser.kind) {
    case 'inApp':
      return <InAppGuide app={browser.app} />
    case 'samsung':
      return (
        <ol className={styles.steps}>
          <li>
            1. 오른쪽 아래 <MenuIcon icon={Menu} label="줄 세 개 메뉴" /> 를 눌러요
          </li>
          <li>2. '현재 페이지 추가'를 골라요</li>
          <li>3. '홈 화면'을 골라요</li>
          <li>4. {LAST_STEP}</li>
        </ol>
      )
    case 'iosSafari':
      return (
        <ol className={styles.steps}>
          <li>
            1. 주소창 옆 <MenuIcon icon={Ellipsis} label="점 세 개 메뉴" /> 를 누르고 '공유'를
            골라요. 공유 버튼 <MenuIcon icon={Share} label="공유" /> 이 보이면 그것을 눌러요
          </li>
          <li>2. 아래로 내려 '홈 화면에 추가'를 골라요</li>
          <li>3. '추가'를 눌러요</li>
          <li>4. {LAST_STEP}</li>
        </ol>
      )
    case 'iosOther':
      return (
        <>
          <ol className={styles.steps}>
            <li>
              1. 공유 버튼 <MenuIcon icon={Share} label="공유" /> 을 눌러요
            </li>
            <li>2. '홈 화면에 추가'를 골라요</li>
            <li>3. '추가'를 눌러요</li>
            <li>4. {LAST_STEP}</li>
          </ol>
          <p className={styles.note}>메뉴에 없으면 사파리로 열어 주세요</p>
        </>
      )
    case 'other':
      return (
        <ol className={styles.steps}>
          <li>
            1. 오른쪽 위 <MenuIcon icon={EllipsisVertical} label="점 세 개 메뉴" /> 를 눌러요
          </li>
          {/* 크롬 버전에 따라 메뉴 이름이 '앱 설치' 또는 '홈 화면에 추가'(11/24 조사) */}
          <li>2. '앱 설치' 또는 '홈 화면에 추가'를 골라요</li>
          <li>3. 창이 뜨면 '설치'를 골라요</li>
          <li>4. {LAST_STEP}</li>
        </ol>
      )
  }
}

/** 앱 안 브라우저: 먼저 다른 브라우저로 열기. 주소 복사가 막히면 주소 글자를 길게 눌러 복사(선택 예외, #163) */
function InAppGuide({ app }: { app: string }) {
  const [copy, setCopy] = useState<'idle' | 'done' | 'failed'>('idle')
  const url = siteUrl()

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopy('done')
    } catch {
      setCopy('failed')
    }
  }

  return (
    <div className={styles.install}>
      <p className={styles.lead}>{app} 안에서는 홈 화면에 추가할 수 없어요</p>
      <ol className={styles.steps}>
        <li>
          1. 화면 위나 아래의 메뉴 <MenuIcon icon={EllipsisVertical} label="점 세 개 메뉴" /> 를
          눌러요
        </li>
        <li>2. '다른 브라우저로 열기'를 골라요</li>
        <li>3. 열린 브라우저에서 다시 이 안내대로 추가해요</li>
      </ol>
      <p className={styles.note}>메뉴가 없으면 주소를 복사해 크롬에 붙여 넣어요</p>
      {/* 주소 + 복사를 한 상자로(11/24 동섭 — 턱 없음, 무엇을 복사하는지 묶어 보이게) */}
      <div className={styles.copyBox}>
        <span className={styles.url}>{url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
        <button type="button" className={styles.copyButton} aria-label="주소 복사" onClick={onCopy}>
          <Copy size={18} strokeWidth={2} aria-hidden />
          복사
        </button>
      </div>
      <p className={styles.note} role="status">
        {copy === 'done' && '복사했어요. 다른 브라우저 주소창에 붙여 넣어요'}
        {copy === 'failed' && '복사하지 못했어요. 주소를 길게 눌러 복사해요'}
      </p>
    </div>
  )
}

/** 로그아웃. 성공하면 S-02로 옮기고 캐시를 비운다(이 기기에 이 학생 데이터가 남지 않게) */
function LogoutFooter() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [state, setState] = useState<'idle' | 'pending' | 'offline' | 'failed'>('idle')

  async function onLogout() {
    setState('pending')
    try {
      await logout()
    } catch (error) {
      // 연결 실패(fetch TypeError)만 "인터넷 연결" 안내. 서버 오류는 잠시 뒤 다시 — 원인은 기록에
      if (error instanceof TypeError) {
        setState('offline')
        return
      }
      console.error(
        '[logout]',
        error instanceof ApiError
          ? { status: error.status, code: error.code, requestId: error.requestId }
          : error,
      )
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
      {(state === 'offline' || state === 'failed') && (
        <p className={styles.error} role="alert">
          <CircleAlert size={18} strokeWidth={2} aria-hidden />
          {state === 'offline'
            ? '로그아웃하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요'
            : '로그아웃하지 못했어요. 잠시 후 다시 눌러 주세요'}
        </p>
      )}
    </div>
  )
}
