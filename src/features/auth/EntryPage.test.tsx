import { focusManager, onlineManager } from '@tanstack/react-query'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { AUTH_MOCK, resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { buildHome } from '../../mocks/studentData'
import { renderRoutes } from '../../test/render'
import { readJoinCode, saveJoinCode } from './joinCode'
import { expectSecretNowhere, watchConsole } from './testUtils'

// 들어가기(S-01·S-02를 화면 하나로, #88): ① 가입 코드 8칸 → ② 반 카드 + 개인 코드 4칸

// 반 확인 요청 수는 request:start에서 바로 센다(본문을 읽어 코드를 적는 것은 비동기라 늦게 쌓인다 — 리뷰 11/13).
// "다시 부르지 않는다"는 settle()로 한 번 흘려 보낸 뒤 센다
let verifyCount: number
let verifyCodes: string[]
let loginCalls: number

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
  watchConsole()
  verifyCount = 0
  verifyCodes = []
  loginCalls = 0
  server.events.on('request:start', ({ request }) => {
    const path = new URL(request.url).pathname
    if (path.endsWith('/auth/code/verify')) {
      verifyCount++
      void request
        .clone()
        .json()
        .then((body: { code: string }) => verifyCodes.push(body.code))
    }
    if (path.endsWith('/auth/student/login')) loginCalls++
  })
  return () => server.events.removeAllListeners()
})

const FIVE_XX = '잠시 후 다시 시도해 주세요'

/** 오류 줄(alert 영역은 늘 있다)에 글이 들어올 때까지 기다린다 */
const alertSays = (text: string | RegExp) =>
  waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text))

/** 남은 effect·요청 시작을 한 번 흘려 보낸다 */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function renderAt(entry: string | { pathname: string; state?: unknown } = '/join') {
  // createMemoryRouter는 { pathname, state }도 받는다(renderRoutes의 기본값 때문에 string[]로 추론될 뿐)
  return renderRoutes(routes, { initialEntries: [entry as string] })
}

const joinInput = () => screen.getByLabelText('가입 코드 8자리')
const pinInput = () => screen.getByLabelText('개인 코드 숫자 4자리')
const joinStep = () => document.querySelector('[data-step="join"]')!
const pinStep = () => document.querySelector('[data-step="pin"]')!
const pinDots = () => pinStep().querySelectorAll('[data-box] > span').length
const classCard = () => screen.findByText('Green 그린')
const home = () => screen.findByRole('heading', { level: 1, name: 'Reading Day 5' })

/** 가입 코드 응답을 붙잡아 둔다 — release()로 기본 목에 넘긴다 */
function holdVerify() {
  // 문을 먼저 만든다 — 요청이 목에 닿기 전에 release()를 불러도 풀린다
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => (release = resolve))
  server.use(
    http.post(
      '*/api/v1/auth/code/verify',
      async () => {
        await gate
        return undefined
      },
      { once: true },
    ),
  )
  return release
}

describe('① 처음', () => {
  it('심볼·"4 Seasons"·가입 코드 8칸·"교사" 링크만. 설명 글·들어가기 버튼·개인 코드는 없다', () => {
    renderAt()

    expect(screen.getByRole('img', { name: '제이G' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: '4 Seasons' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '교사' })).toHaveAttribute('href', '/teacher/login')
    expect(joinStep().querySelectorAll('[data-box]')).toHaveLength(8)
    expect(screen.queryByRole('button', { name: '들어가기' })).not.toBeInTheDocument()
    expect(screen.queryByText(/대소문자|나만의 숫자|선생님께 받은/)).not.toBeInTheDocument()
    expect(pinStep()).toHaveAttribute('aria-hidden', 'true')
    expect(pinInput()).toHaveAttribute('tabindex', '-1')
    expect(document.documentElement).toHaveAttribute('data-level', 'none')
  })

  it('제이G 심볼은 받기 전에는 숨기고(data-loaded 없음), 파일이 없으면(error) 요소를 뺀다 — 원장님 확인 전', () => {
    renderAt()
    const symbol = screen.getByRole('img', { name: '제이G' })
    expect(symbol).not.toHaveAttribute('data-loaded')

    fireEvent.error(symbol)
    expect(screen.queryByRole('img', { name: '제이G' })).not.toBeInTheDocument()
  })

  it('제이G 심볼 파일을 받으면 보인다', () => {
    renderAt()
    fireEvent.load(screen.getByRole('img', { name: '제이G' }))
    expect(screen.getByRole('img', { name: '제이G' })).toHaveAttribute('data-loaded')
  })

  it('영문·숫자만 받고 소문자는 대문자로, 8자에서 멈춘다(0·O·1·I도 받는다)', async () => {
    renderAt()
    const user = userEvent.setup()

    await user.type(joinInput(), 'a0o1-i!')
    expect(joinInput()).toHaveValue('A0O1I')
  })
})

describe('① → ② 반을 찾음', () => {
  it('8자리가 차면 반을 확인하고 반 카드·개인 코드 4칸이 나타난다. 바탕은 그 반 레벨, "교사"는 숨김, 포커스는 개인 코드', async () => {
    renderAt()
    const user = userEvent.setup()

    await user.type(joinInput(), 'g7km2xp4')

    expect(await classCard()).toBeInTheDocument()
    expect(screen.getByText(AUTH_MOCK.className)).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('data-level', 'green')
    expect(screen.queryByRole('link', { name: '교사' })).not.toBeInTheDocument()
    expect(joinStep()).toHaveAttribute('aria-hidden', 'true')
    expect(pinStep()).not.toHaveAttribute('aria-hidden')
    expect(pinInput()).toHaveFocus()
    expect(pinInput()).toHaveAttribute('inputmode', 'numeric')
    await settle()
    expect(verifyCount).toBe(1)
    expect(verifyCodes).toEqual([AUTH_MOCK.joinCode])
  })

  it('8번째 글자를 친 그 순간 개인 코드 입력으로 포커스가 간다(응답 전 — 아이폰 숫자 키보드)', async () => {
    const release = holdVerify()
    renderAt()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    expect(pinInput()).toHaveFocus()
    expect(pinStep()).toHaveAttribute('aria-hidden', 'true') // 아직 ②가 아니다
    release()
    expect(await classCard()).toBeInTheDocument()
  })

  it('확인이 맞으면 먼저 ① 묶음이 사라지고(160ms) 그다음 ②가 나타난다. 그동안 가입 코드는 바뀌지 않는다', async () => {
    const release = holdVerify()
    renderAt()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    release()
    await waitFor(() => expect(joinStep().className).toMatch(/leaving/))
    expect(pinStep()).toHaveAttribute('aria-hidden', 'true')
    fireEvent.change(joinInput(), { target: { value: 'AAAA' } })
    expect(joinInput()).toHaveValue(AUTH_MOCK.joinCode)

    expect(await classCard()).toBeInTheDocument()
    expect(joinStep().className).not.toMatch(/leaving/)
  })

  it('움직임 줄이기면 사라지는 단계 없이 바로 ②', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' })),
    )
    renderAt()
    const user = userEvent.setup()
    // 160ms 뒤에는 어차피 빠지므로, 그동안 한 번이라도 붙었는지 기록한다
    const seen: string[] = []
    const observer = new MutationObserver(() => seen.push(joinStep().className))
    observer.observe(joinStep(), { attributes: true, attributeFilter: ['class'] })

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await classCard()
    observer.disconnect()
    expect(seen.some((name) => /leaving/.test(name))).toBe(false)
  })

  it('②가 나타나기 전에 친 숫자는 받지 않는다', async () => {
    const release = holdVerify()
    renderAt()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await user.keyboard('38')
    expect(pinInput()).toHaveValue('')
    release()
    await classCard()
    expect(pinInput()).toHaveValue('')
    expect(loginCalls).toBe(0)
  })

  it('확인이 1초를 넘으면 오류 줄에 "확인하는 중"', async () => {
    const release = holdVerify()
    renderAt()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    expect(screen.queryByText('확인하는 중')).not.toBeInTheDocument()
    expect(await screen.findByText('확인하는 중', undefined, { timeout: 2000 })).toBeInTheDocument()
    release()
    await classCard()
  })

  it('4자리가 차면 바로 로그인 → 홈. 가입 코드만 기기에 남고 개인 코드는 어디에도 없다', async () => {
    const { router, client } = renderAt()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await classCard()
    await user.type(pinInput(), AUTH_MOCK.personalCode)

    expect(await home()).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(readJoinCode()).toBe(AUTH_MOCK.joinCode)
    expect(Object.keys(localStorage)).toHaveLength(1)
    expect(loginCalls).toBe(1)
    expectSecretNowhere(AUTH_MOCK.personalCode, { client, router })
  })

  it('늦게 도착한 이전 코드의 확인 결과가 지금 코드의 결과를 덮지 않는다', async () => {
    const release = holdVerify()
    renderAt()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode) // 이 응답은 붙잡아 둔다
    await user.clear(joinInput())
    await user.type(joinInput(), 'AAAABBBB')
    await alertSays('없는 코드예요')

    release()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.getByRole('alert')).toHaveTextContent('없는 코드예요')
    expect(screen.queryByText('Green 그린')).not.toBeInTheDocument()
  })
})

describe('③ 없는 가입 코드', () => {
  it('8칸 오류 + "없는 코드예요. 선생님께 물어봐요", ①에 남고 포커스는 가입 코드로. 고치기 시작하면 사라진다', async () => {
    renderAt()
    const user = userEvent.setup()

    await user.type(joinInput(), 'AAAABBBB')

    await alertSays('없는 코드예요. 선생님께 물어봐요')
    expect(joinInput()).toHaveAttribute('aria-invalid', 'true')
    expect(joinInput()).toHaveAccessibleDescription('없는 코드예요. 선생님께 물어봐요')
    await waitFor(() => expect(joinInput()).toHaveFocus())
    expect(screen.getByRole('link', { name: '교사' })).toBeInTheDocument()

    await user.type(joinInput(), '{Backspace}')
    expect(screen.queryByText(/없는 코드예요/)).not.toBeInTheDocument()
    expect(joinInput()).not.toHaveAttribute('aria-invalid')
  })

  it('같은 없는 코드를 다시 쳐도 확인을 다시 부르지 않는다', async () => {
    renderAt()
    const user = userEvent.setup()

    await user.type(joinInput(), 'AAAABBBB')
    await alertSays('없는 코드예요')
    await user.type(joinInput(), '{Backspace}B')

    expect(screen.getByRole('alert')).toHaveTextContent('없는 코드예요')
    await settle()
    expect(verifyCount).toBe(1)
  })
})

describe('반을 확인하지 못함(429·네트워크·5xx)', () => {
  it('회색 카드("가입 코드 ZZZZ ZZZZ")로 ②, 레벨 색 없음, 로그인은 된다. 같은 코드로 다시 부르지 않는다', async () => {
    renderAt()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.rateLimitedJoinCode)

    expect(await screen.findByText('ZZZZ ZZZZ')).toBeInTheDocument()
    expect(
      screen.getByText('지금은 반을 확인하지 못했어요. 그대로 들어가도 돼요'),
    ).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('data-level', 'none')
    expect(pinInput()).toHaveFocus()

    // 로그인 요청은 그대로 나간다(이 코드는 목에 없는 반이라 401 — 어느 쪽이 틀렸는지 모르니 예전 문구)
    await user.type(pinInput(), '1234')
    await alertSays('가입 코드 또는 개인 코드가 맞지 않아요')
    expect(loginCalls).toBe(1)

    await user.click(screen.getByRole('button', { name: '다른 반 코드로 바꾸기' }))
    await user.type(joinInput(), AUTH_MOCK.rateLimitedJoinCode)
    expect(await screen.findByText('ZZZZ ZZZZ')).toBeInTheDocument()
    await settle()
    expect(verifyCount).toBe(1)
  })

  it('네트워크가 끊겨도 같은 회색 카드', async () => {
    server.use(http.post('*/api/v1/auth/code/verify', () => HttpResponse.error()))
    renderAt()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    expect(await screen.findByText('G7KM 2XP4')).toBeInTheDocument()
    expect(screen.queryByText('Green 그린')).not.toBeInTheDocument()
  })
})

describe('④ 개인 코드가 다름 · 잠금 · 그 밖 실패', () => {
  async function toPin() {
    const result = renderAt()
    const user = userEvent.setup()
    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await classCard()
    return { ...result, user }
  }

  it('틀리면 4칸을 비우고 "개인 코드가 달라요. 다시 눌러요", ②에 남고 가입 코드를 저장하지 않는다', async () => {
    const { user, router, client } = await toPin()

    await user.type(pinInput(), '1111')

    await alertSays('개인 코드가 달라요. 다시 눌러요')
    expect(pinInput()).toHaveValue('')
    expect(pinInput()).toHaveAttribute('aria-invalid', 'true')
    expect(router.state.location.pathname).toBe('/join')
    expect(readJoinCode()).toBeUndefined()
    expectSecretNowhere('1111', { client, router })

    // 다시 누르기 시작하면 오류가 사라진다
    await user.type(pinInput(), '3')
    expect(screen.queryByText(/개인 코드가 달라요/)).not.toBeInTheDocument()
    expect(pinInput()).not.toHaveAttribute('aria-invalid')
  })

  it('잠기면(423) 서버 문구와 해제 시각(한국 시간)을 오류 줄에', async () => {
    const { user } = await toPin()

    await user.type(pinInput(), AUTH_MOCK.lockedPersonalCode)

    await alertSays('오후 3시 42분부터 다시 할 수 있어요')
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(AUTH_MOCK.lockedTitle)
    expect(alert).toHaveTextContent('오후 3시 42분부터 다시 할 수 있어요')
    expect(readJoinCode()).toBeUndefined()
  })

  it('네트워크가 끊기면 연결 확인 문구', async () => {
    server.use(http.post('*/api/v1/auth/student/login', () => HttpResponse.error()))
    const { user } = await toPin()

    await user.type(pinInput(), AUTH_MOCK.personalCode)
    await alertSays('인터넷 연결을 확인하고 다시 시도해 주세요')
  })

  it('요청을 보내자마자 4칸을 비우고, 기다리는 동안 친 숫자는 무시한다(요청 한 번)', async () => {
    let release: () => void = () => {}
    server.use(
      http.post('*/api/v1/auth/student/login', async () => {
        await new Promise<void>((resolve) => (release = resolve))
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    const { user } = await toPin()

    await user.type(pinInput(), AUTH_MOCK.personalCode)
    expect(pinInput()).toHaveValue('')
    expect(screen.getByText('들어가는 중')).toBeInTheDocument()
    await user.type(pinInput(), '1234')
    expect(pinInput()).toHaveValue('')
    expect(loginCalls).toBe(1)
    release()
    await alertSays(FIVE_XX)
  })

  it('기기 저장소를 쓸 수 없어도 로그인은 된다', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    const { user, router } = await toPin()

    await user.type(pinInput(), AUTH_MOCK.personalCode)
    expect(await home()).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('로그인하면 이전 사용자의 캐시를 비운다(같은 기기를 다른 학생이 쓸 때)', async () => {
    const { user, client } = await toPin()
    const previous = buildHome()
    previous.class.name = '이전 학생의 반'
    client.setQueryData(['student', 'home'], previous)
    client.setQueryData(['student', 'lessons', 99], { previous: true })

    await user.type(pinInput(), AUTH_MOCK.personalCode)

    expect(await screen.findByText('겨울 그린 A반 · 김민준')).toBeInTheDocument()
    expect(screen.queryByText(/이전 학생의 반/)).not.toBeInTheDocument()
    expect(client.getQueryData(['student', 'lessons', 99])).toBeUndefined()
  })

  it('응답을 기다리는 동안 다른 화면으로 가면, 로그인이 성공해도 학생 홈으로 끌고 오지 않는다', async () => {
    let release: () => void = () => {}
    server.use(
      http.post(
        '*/api/v1/auth/student/login',
        async () => {
          await new Promise<void>((resolve) => (release = resolve))
          return undefined
        },
        { once: true },
      ),
    )
    const { user, router } = await toPin()

    await user.type(pinInput(), AUTH_MOCK.personalCode)
    await act(() => router.navigate('/elsewhere'))
    release()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(router.state.location.pathname).toBe('/elsewhere')
  })
})

describe('바꾸기', () => {
  it('①로 돌아가 칸을 비우고 포커스는 가입 코드. 기기에 저장된 가입 코드는 지우지 않는다', async () => {
    saveJoinCode(AUTH_MOCK.joinCode)
    renderAt('/rejoin')
    const user = userEvent.setup()
    await classCard()

    await user.click(screen.getByRole('button', { name: '다른 반 코드로 바꾸기' }))

    expect(joinStep()).not.toHaveAttribute('aria-hidden')
    expect(joinInput()).toHaveValue('')
    expect(joinInput()).toHaveFocus()
    expect(screen.getByRole('link', { name: '교사' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('data-level', 'none')
    expect(readJoinCode()).toBe(AUTH_MOCK.joinCode)
  })
})

describe('다시 들어오기(저장된 가입 코드)', () => {
  it('②에서 시작 — 확인 전에는 작은 점·이름표만, 응답이 오면 반 카드와 4칸. 4자리면 바로 홈', async () => {
    saveJoinCode(AUTH_MOCK.joinCode)
    const release = holdVerify()
    const { router } = renderAt('/rejoin')
    const user = userEvent.setup()

    expect(screen.getByRole('heading', { level: 1, name: '4 Seasons' })).toBeInTheDocument()
    expect(joinStep()).toHaveAttribute('aria-hidden', 'true')
    expect(pinStep()).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('link', { name: '교사' })).not.toBeInTheDocument()

    release()
    expect(await classCard()).toBeInTheDocument()
    await waitFor(() => expect(pinInput()).toHaveFocus())
    await user.type(pinInput(), AUTH_MOCK.personalCode)

    expect(await home()).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    await settle()
    expect(verifyCount).toBe(1)
  })

  it('저장된 가입 코드를 서버가 모르면(404) 지우고 ①에서 "저장된 코드를 쓸 수 없어요. 다시 입력해요"', async () => {
    saveJoinCode('AAAABBBB')
    renderAt('/rejoin')
    const user = userEvent.setup()

    await alertSays('저장된 코드를 쓸 수 없어요. 다시 입력해요')
    expect(joinInput()).toHaveValue('')
    expect(readJoinCode()).toBeUndefined()

    await user.type(joinInput(), 'G')
    expect(screen.queryByText(/저장된 코드를/)).not.toBeInTheDocument()
  })

  it('확인이 다른 이유로 실패하면(429) 저장값을 지우지 않고 회색 카드로 로그인할 수 있다', async () => {
    saveJoinCode(AUTH_MOCK.rateLimitedJoinCode)
    renderAt('/rejoin')

    expect(await screen.findByText('ZZZZ ZZZZ')).toBeInTheDocument()
    expect(readJoinCode()).toBe(AUTH_MOCK.rateLimitedJoinCode)
  })

  it('세션이 끝나서 왔으면 안내를 muted로 한 번 — 누르기 시작하면 사라진다', async () => {
    saveJoinCode(AUTH_MOCK.joinCode)
    renderAt({ pathname: '/rejoin', state: { reason: 'sessionExpired' } })
    const user = userEvent.setup()
    await classCard()

    const notice = screen.getByText('로그인이 끝났어요. 다시 들어와 주세요.')
    expect(notice).toHaveAttribute('role', 'status')
    await user.type(pinInput(), '1')
    expect(screen.queryByText(/로그인이 끝났어요/)).not.toBeInTheDocument()
  })
})

describe('QR로 열기', () => {
  const qr = (hash: string) => `/join#${hash}`

  it('반 QR(가입 코드만): ①을 건너뛰고 ②, 주소에서 # 뒤를 지운다. 4자리면 로그인', async () => {
    const { router } = renderAt(qr(`c=g7km2xp4`))
    const user = userEvent.setup()

    await waitFor(() => expect(router.state.location.hash).toBe(''))
    expect(await classCard()).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '들어가기' })).not.toBeInTheDocument()
    await user.type(pinInput(), AUTH_MOCK.personalCode)
    expect(await home()).toBeInTheDocument()
  })

  it('카드 QR(개인 코드까지): 4칸을 채운 채 "들어가기" 버튼 — 자동으로 들어가지 않는다(ADR 0033)', async () => {
    const { router, client } = renderAt(qr(`c=${AUTH_MOCK.joinCode}&p=${AUTH_MOCK.personalCode}`))
    const user = userEvent.setup()

    await classCard()
    await waitFor(() => expect(router.state.location.hash).toBe(''))
    expect(pinDots()).toBe(4)
    expect(pinStep().textContent).not.toContain(AUTH_MOCK.personalCode)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(loginCalls).toBe(0)
    expectSecretNowhere(AUTH_MOCK.personalCode, { client, router })

    await user.click(within(pinStep() as HTMLElement).getByRole('button', { name: '들어가기' }))
    expect(await home()).toBeInTheDocument()
    expect(readJoinCode()).toBe(AUTH_MOCK.joinCode)
    expectSecretNowhere(AUTH_MOCK.personalCode, { client, router })
  })

  it('카드 QR 버튼을 두 번 눌러도 요청은 한 번', async () => {
    let release: () => void = () => {}
    server.use(
      http.post('*/api/v1/auth/student/login', async () => {
        await new Promise<void>((resolve) => (release = resolve))
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    renderAt(qr(`c=${AUTH_MOCK.joinCode}&p=${AUTH_MOCK.personalCode}`))
    await classCard()

    // 화면이 다시 그려지기 전에 두 번(같은 렌더 안) — userEvent.dblClick은 사이에 렌더가 끼어 막는 코드를 시험하지 못한다
    const button = screen.getByRole('button', { name: '들어가기' })
    act(() => {
      button.click()
      button.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(loginCalls).toBe(1)
    release()
    await alertSays(FIVE_XX)
  })

  it('카드 QR 개인 코드가 틀리면 칸을 비우고 "카드가 예전 것" 안내 — 버튼은 사라지고 이제 직접 4자리를 친다(#70)', async () => {
    renderAt(qr(`c=${AUTH_MOCK.joinCode}&p=1111`))
    const user = userEvent.setup()
    await classCard()

    await user.click(screen.getByRole('button', { name: '들어가기' }))

    await alertSays('카드가 예전 것일 수 있어요. 새 카드를 받아 주세요')
    expect(pinDots()).toBe(0)
    expect(screen.queryByRole('button', { name: '들어가기' })).not.toBeInTheDocument()
    // 직접 친 값이 틀리면 원래 문구
    await user.type(pinInput(), '2222')
    await alertSays('개인 코드가 달라요. 다시 눌러요')
    await user.type(pinInput(), AUTH_MOCK.personalCode)
    expect(await home()).toBeInTheDocument()
  })

  it('카드 QR 가입 코드가 없는 코드면 ③ — 8칸에 그 코드를 남기고 "카드가 예전 것" 안내(#70)', async () => {
    renderAt(qr(`c=AAAABBBB&p=${AUTH_MOCK.personalCode}`))

    await alertSays('카드가 예전 것일 수 있어요. 새 카드를 받아 주세요')
    expect(joinInput()).toHaveValue('AAAABBBB')
    expect(pinInput()).toHaveValue('')
    expect(loginCalls).toBe(0)
  })

  it('반 QR 가입 코드가 없는 코드면 ③ "반 QR이 바뀌었어요" — 직접 고쳐 치면 원래 문구(#70)', async () => {
    renderAt(qr('c=AAAABBBB'))
    const user = userEvent.setup()

    await alertSays('반 QR이 바뀌었어요. 새 QR을 받아 주세요')
    await user.clear(joinInput())
    await user.type(joinInput(), 'AAAACCCC')
    await alertSays('없는 코드예요. 선생님께 물어봐요')
  })

  it('개인 코드가 잘린 카드 QR은 가입 코드만 채우고 ②에 "QR을 끝까지 읽지 못했어요"(#70)', async () => {
    const { router } = renderAt(qr(`c=${AUTH_MOCK.joinCode}&p=38`))
    const user = userEvent.setup()

    expect(await classCard()).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.hash).toBe(''))
    await alertSays('QR을 끝까지 읽지 못했어요. 직접 입력해 주세요')
    // 안내일 뿐 틀린 값이 아니다 — 칸은 오류 모양이 아니다
    expect(pinInput()).not.toHaveAttribute('aria-invalid')
    expect(pinDots()).toBe(0)
    expect(screen.queryByRole('button', { name: '들어가기' })).not.toBeInTheDocument()
    await user.type(pinInput(), AUTH_MOCK.personalCode)
    expect(await home()).toBeInTheDocument()
  })

  it('QR 가입 코드는 기기에 저장된 반보다 우선한다(저장값은 로그인 성공 뒤에만 바뀐다)', async () => {
    saveJoinCode(AUTH_MOCK.rateLimitedJoinCode)
    renderAt(qr(`c=${AUTH_MOCK.joinCode}`))

    expect(await classCard()).toBeInTheDocument()
    expect(readJoinCode()).toBe(AUTH_MOCK.rateLimitedJoinCode)
  })

  it('이미 열린 화면에 QR 주소가 다시 들어와도(같은 탭) ②로 채우고 주소에서 지운다', async () => {
    const { router, client } = renderAt()
    expect(joinInput()).toHaveValue('')

    await act(() => router.navigate(qr(`c=${AUTH_MOCK.joinCode}&p=${AUTH_MOCK.personalCode}`)))

    expect(await classCard()).toBeInTheDocument()
    expect(pinDots()).toBe(4)
    await waitFor(() => expect(router.state.location.hash).toBe(''))
    expectSecretNowhere(AUTH_MOCK.personalCode, { client, router })
  })

  it('모양이 틀린 # 뒤 값은 채우지 않고 주소에서 지운다. ①에 "QR을 끝까지 읽지 못했어요", 치기 시작하면 사라진다(#70)', async () => {
    const { router } = renderAt(qr('c=G7KM&p=12345'))
    const user = userEvent.setup()

    await waitFor(() => expect(router.state.location.hash).toBe(''))
    expect(joinInput()).toHaveValue('')
    // QR로 열었으니 누가 들어와 있는지 먼저 확인한다(아무도 없으면 ①)
    await waitFor(() => expect(joinStep()).not.toHaveAttribute('aria-hidden'))
    await alertSays('QR을 끝까지 읽지 못했어요. 직접 입력해 주세요')
    expect(joinInput()).not.toHaveAttribute('aria-invalid')
    await settle()
    expect(verifyCount).toBe(0)

    await user.type(joinInput(), 'G')
    expect(screen.getByRole('alert').textContent).toBe('')
  })

  it('c·p가 없는 # 뒤 값(모르는 키)은 QR로 보지 않는다 — 안내 없음', async () => {
    const { router } = renderAt(qr('utm=abc'))

    await waitFor(() => expect(router.state.location.hash).toBe(''))
    await settle()
    expect(screen.getByRole('alert').textContent).toBe('')
  })
})

// 이미 로그인된 기기로 QR을 찍으면 그냥 바꾸지 않고 먼저 묻는다(#70) — 다른 학생의 청취가 지금 학생 기록으로 쌓이지 않게
describe('로그인된 기기에서 QR', () => {
  const qr = (hash: string) => `/join#${hash}`
  const cardQr = qr(`c=${AUTH_MOCK.joinCode}&p=${AUTH_MOCK.personalCode}`)
  const askText = () => screen.findByText('지금 김민준으로 들어와 있어요.')
  const switchButton = () => screen.getByRole('button', { name: '다른 학생으로 들어가기' })
  const stayButton = () => screen.getByRole('button', { name: '그대로 있기' })

  let logoutCalls: number
  let meCalls: number
  // 응답을 오래 붙잡는 목(PR #103 CI) — 끝나지 않는 Promise로 두면 그 요청이 다음 테스트까지 남아, 다음 테스트의
  // /me가 목에 잡히지 않고 실제 네트워크로 나가는 일이 CI에서 두 번 났다(추정 원인). 테스트가 끝날 때 모두 503으로 푼다
  let hung: Array<() => void>
  const hang = () =>
    new Promise<Response>((resolve) =>
      hung.push(() => resolve(HttpResponse.json({}, { status: 503 }))),
    )
  beforeEach(() => {
    logoutCalls = 0
    meCalls = 0
    hung = []
    server.events.on('request:start', ({ request }) => {
      const path = new URL(request.url).pathname
      if (path.endsWith('/auth/logout')) logoutCalls++
      if (path.endsWith('/api/v1/me')) meCalls++
    })
  })
  afterEach(() => {
    // 화면을 먼저 내린 뒤 푼다 — 늦은 503이 화면 state를 바꾸지 않게(전역 afterEach의 cleanup은 이보다 늦다)
    vi.useRealTimers()
    cleanup()
    hung.splice(0).forEach((release) => release())
  })

  it('학생이 들어와 있으면 이름과 함께 묻고, 칸은 감춘다. 로그인은 부르지 않는다', async () => {
    setMockSession('student')
    const { router, client } = renderAt(cardQr)

    expect(await askText()).toBeInTheDocument()
    expect(screen.getByText('다른 학생으로 들어갈까요?')).toBeInTheDocument()
    expect(joinStep()).toHaveAttribute('aria-hidden', 'true')
    expect(pinStep()).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('button', { name: '들어가기' })).not.toBeInTheDocument()
    // 감춘 칸 쪽의 버튼("바꾸기"·"들어가기")은 키보드로도 닿지 않게 그리지 않는다(반 확인이 끝난 뒤에도)
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(pinStep().querySelectorAll('button')).toHaveLength(0)
    expect(joinStep().querySelectorAll('button')).toHaveLength(0)
    await waitFor(() => expect(router.state.location.hash).toBe(''))
    expect(loginCalls).toBe(0)
    expectSecretNowhere(AUTH_MOCK.personalCode, { client, router })
  })

  it('"다른 학생으로 들어가기" → 로그아웃 → 카드 QR 값으로 ② → "들어가기" → 새 학생 홈', async () => {
    setMockSession('student')
    renderAt(cardQr)
    const user = userEvent.setup()
    await askText()

    await user.click(switchButton())

    expect(await classCard()).toBeInTheDocument()
    expect(logoutCalls).toBe(1)
    expect(pinDots()).toBe(4)
    expect(screen.queryByText('다른 학생으로 들어갈까요?')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '들어가기' }))
    expect(await home()).toBeInTheDocument()
  })

  it('"그대로 있기" → QR 값을 버리고 홈으로. 로그아웃하지 않는다', async () => {
    setMockSession('student')
    const { router, client } = renderAt(cardQr)
    const user = userEvent.setup()
    await askText()

    await user.click(stayButton())

    expect(await home()).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(logoutCalls).toBe(0)
    expect(loginCalls).toBe(0)
    expectSecretNowhere(AUTH_MOCK.personalCode, { client, router })
  })

  it('로그아웃이 실패하면 묻는 화면에 남아 문구를 보이고 다시 누를 수 있다', async () => {
    setMockSession('student')
    server.use(
      http.post('*/api/v1/auth/logout', () => HttpResponse.json({}, { status: 500 }), {
        once: true,
      }),
    )
    renderAt(cardQr)
    const user = userEvent.setup()
    await askText()

    await user.click(switchButton())

    await alertSays('로그아웃하지 못했어요. 잠시 후 다시 눌러 주세요')
    expect(screen.getByText('다른 학생으로 들어갈까요?')).toBeInTheDocument()
    await user.click(switchButton())
    expect(await classCard()).toBeInTheDocument()
  })

  it('교사가 들어와 있으면 같은 질문, "그대로 있기"는 교사 첫 화면으로', async () => {
    setMockSession('teacher')
    const { router } = renderAt(qr(`c=${AUTH_MOCK.joinCode}`))
    const user = userEvent.setup()

    expect(await screen.findByText('지금 이선생으로 들어와 있어요.')).toBeInTheDocument()
    await user.click(stayButton())
    await waitFor(() => expect(router.state.location.pathname).toBe('/teacher'))
  })

  it.each([
    ['이하나', '지금 이하나로 들어와 있어요.'],
    ['김하늘', '지금 김하늘로 들어와 있어요.'],
    ['Alex', '지금 Alex(으)로 들어와 있어요.'],
  ])('이름 끝 받침에 맞춰 "로"·"으로" — %s', async (name, text) => {
    server.use(
      http.get('*/api/v1/me', () =>
        HttpResponse.json({
          id: 302,
          name,
          role: 'student',
          academy: { id: 1, name: AUTH_MOCK.academyName },
        }),
      ),
    )
    renderAt(cardQr)

    expect(await screen.findByText(text)).toBeInTheDocument()
  })

  it('들어와 있지 않으면 묻지 않고 바로 ②', async () => {
    renderAt(cardQr)

    expect(await classCard()).toBeInTheDocument()
    expect(screen.queryByText('다른 학생으로 들어갈까요?')).not.toBeInTheDocument()
  })

  it('QR 없이 열면 들어와 있는지 묻지 않는다(/me 요청 없음)', async () => {
    setMockSession('student')
    renderAt()
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(meCalls).toBe(0)
    expect(joinStep()).not.toHaveAttribute('aria-hidden')
  })

  // 11/14 리뷰 — /me가 401이 아닌 이유로 실패하면 "아무도 없음"으로 보지 않는다
  const failedText = () =>
    screen.findByText('지금 누가 들어와 있는지 확인하지 못했어요.', undefined, { timeout: 4000 })

  it('/me가 5xx면 확인 실패 화면 — 칸·감춘 버튼 없음, 로그인 안 부름, 상태만 기록', async () => {
    setMockSession('student')
    server.use(http.get('*/api/v1/me', () => HttpResponse.json({}, { status: 503 })))
    renderAt(cardQr)

    expect(await failedText()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 확인하기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '그래도 이 QR로 들어가기' })).toBeInTheDocument()
    expect(pinStep().querySelectorAll('button')).toHaveLength(0)
    expect(joinStep()).toHaveAttribute('aria-hidden', 'true')
    expect(loginCalls).toBe(0)
    expect(console.error).toHaveBeenCalledWith('[me]', expect.objectContaining({ status: 503 }))
  })

  it('/me가 네트워크 오류여도 확인 실패 화면', async () => {
    setMockSession('student')
    server.use(http.get('*/api/v1/me', () => HttpResponse.error()))
    renderAt(cardQr)

    expect(await failedText()).toBeInTheDocument()
  })

  it('확인 실패 → "다시 확인하기"가 성공하면 이름과 함께 묻는다', async () => {
    setMockSession('student')
    let fail = true
    server.use(
      http.get('*/api/v1/me', () => (fail ? HttpResponse.json({}, { status: 503 }) : undefined)),
    )
    renderAt(cardQr)
    const user = userEvent.setup()
    await failedText()

    fail = false
    await user.click(screen.getByRole('button', { name: '다시 확인하기' }))

    expect(await askText()).toBeInTheDocument()
  })

  it('확인 실패 → "그래도 이 QR로 들어가기"면 묻지 않고 ②, 들어가기로 홈', async () => {
    setMockSession('student')
    server.use(
      http.get('*/api/v1/me', () => HttpResponse.json({}, { status: 503 }), { once: true }),
      http.get('*/api/v1/me', () => HttpResponse.json({}, { status: 503 }), { once: true }),
    )
    renderAt(cardQr)
    const user = userEvent.setup()
    await failedText()

    await user.click(screen.getByRole('button', { name: '그래도 이 QR로 들어가기' }))

    expect(await classCard()).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '들어가기' }))
    expect(await home()).toBeInTheDocument()
  })

  it('오프라인이면(쿼리가 멈춤) 붙잡지 않고 바로 ② — 빈 화면에 머물지 않는다', async () => {
    setMockSession('student')
    onlineManager.setOnline(false)
    let unmount = () => {}
    try {
      ;({ unmount } = renderAt(cardQr))
      expect(await classCard()).toBeInTheDocument()
      expect(screen.queryByText('다른 학생으로 들어갈까요?')).not.toBeInTheDocument()
      expect(meCalls).toBe(0)
    } finally {
      // 화면을 먼저 닫는다 — 온라인으로 돌리면 멈춰 있던 /me가 이어서 나가 다음 테스트로 샌다
      unmount()
      onlineManager.setOnline(true)
    }
  })

  it('/me가 10초 안에 오지 않으면 확인 실패 화면 — 갇히지 않는다', async () => {
    setMockSession('student')
    server.use(http.get('*/api/v1/me', () => hang()))
    vi.useFakeTimers()
    renderAt(cardQr)

    await act(() => vi.advanceTimersByTimeAsync(10_000))

    expect(screen.getByText('지금 누가 들어와 있는지 확인하지 못했어요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '그래도 이 QR로 들어가기' })).toBeEnabled()
  })

  it('"다시 확인하기"가 걸려 있어도 "그래도 이 QR로 들어가기"는 눌린다 → ②', async () => {
    setMockSession('student')
    let stuck = false
    server.use(
      http.get('*/api/v1/me', () => (stuck ? hang() : HttpResponse.json({}, { status: 503 }))),
    )
    renderAt(cardQr)
    const user = userEvent.setup()
    await failedText()

    stuck = true
    await user.click(screen.getByRole('button', { name: '다시 확인하기' }))
    expect(screen.getByRole('button', { name: '확인하는 중' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '그래도 이 QR로 들어가기' }))

    expect(await classCard()).toBeInTheDocument()
  })

  // 가짜 타이머로 1초를 정확히 넘긴다. 응답은 오지 않게 둔다(붙잡았다 기본 목으로 넘기는 방식은 CI에서
  // 목에 잡히지 않고 실제 네트워크로 나가 흔들렸다 — PR #103, 11/14). 응답이 온 뒤 묻는 것은 다른 테스트가 본다
  it('확인이 1초를 넘으면 "확인하는 중"', async () => {
    setMockSession('student')
    server.use(http.get('*/api/v1/me', () => hang()))
    vi.useFakeTimers()
    renderAt(cardQr)

    await act(() => vi.advanceTimersByTimeAsync(999))
    expect(screen.queryByText('확인하는 중')).not.toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(screen.getByText('확인하는 중')).toBeInTheDocument()
    expect(screen.queryByText('지금 누가 들어와 있는지 확인하지 못했어요.')).not.toBeInTheDocument()
  })

  it('묻는 화면에서 창을 오가도 다시 조회하지 않는다(화면이 뒤바뀌지 않게)', async () => {
    setMockSession('student')
    renderAt(cardQr)
    await askText()
    const before = meCalls

    try {
      act(() => {
        focusManager.setFocused(false)
        focusManager.setFocused(true)
      })
      await settle()
      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(meCalls).toBe(before)
    } finally {
      focusManager.setFocused(undefined)
    }
  })

  it('가입 코드가 잘린 QR로 열어도 들어와 있는지 묻는다', async () => {
    setMockSession('student')
    renderAt(qr('c=G7KM&p=3817'))

    expect(await askText()).toBeInTheDocument()
  })

  it('바꾸면 이전 사람의 캐시를 비우고 /me를 다시 부르지 않는다', async () => {
    setMockSession('student')
    const { client } = renderAt(cardQr)
    const user = userEvent.setup()
    await askText()
    client.setQueryData(['student', 'home'], { previous: true })
    const before = meCalls

    await user.click(switchButton())
    await classCard()
    await settle()

    expect(client.getQueryData(['me'])).toBeUndefined()
    expect(client.getQueryData(['student', 'home'])).toBeUndefined()
    expect(meCalls).toBe(before)
  })

  it('로그아웃 중에 화면을 떠나도 성공하면 캐시를 비운다', async () => {
    setMockSession('student')
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    server.use(
      http.post(
        '*/api/v1/auth/logout',
        async () => {
          await gate
          return undefined
        },
        { once: true },
      ),
    )
    const { router, client } = renderAt(cardQr)
    const user = userEvent.setup()
    await askText()

    await user.click(switchButton())
    await act(() => router.navigate('/teacher/login'))
    release()
    await waitFor(() => expect(logoutCalls).toBe(1))
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(client.getQueryData(['me'])).toBeUndefined()
  })

  it('로그아웃이 10초 안에 오지 않으면 연결 확인 문구 — 두 버튼이 다시 눌린다', async () => {
    setMockSession('student')
    server.use(http.post('*/api/v1/auth/logout', () => hang()))
    renderAt(cardQr)
    await askText()
    vi.useFakeTimers()

    act(() => switchButton().click())
    expect(screen.getByRole('button', { name: '나가는 중' })).toBeDisabled()
    expect(stayButton()).toBeDisabled()
    await act(() => vi.advanceTimersByTimeAsync(10_000))

    expect(screen.getByRole('alert')).toHaveTextContent(
      '로그아웃하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요',
    )
    expect(switchButton()).toBeEnabled()
    expect(stayButton()).toBeEnabled()
  })

  it('"다른 학생으로 들어가기"를 같은 렌더에서 두 번 눌러도 로그아웃은 한 번', async () => {
    setMockSession('student')
    renderAt(cardQr)
    await askText()

    act(() => {
      switchButton().click()
      switchButton().click()
    })
    await classCard()

    expect(logoutCalls).toBe(1)
  })
})

// 11/13 리뷰 보강 — 옛 JoinPage·RejoinPage 테스트에서 빠졌던 것, 리뷰에서 찾은 빈칸
describe('리뷰 보강', () => {
  const qr = (hash: string) => `/join#${hash}`
  const never = () => new Promise<never>(() => {})

  it('다시 들어오기에서 개인 코드가 틀려도 저장된 가입 코드는 남는다', async () => {
    saveJoinCode(AUTH_MOCK.joinCode)
    renderAt('/rejoin')
    const user = userEvent.setup()
    await classCard()

    await user.type(pinInput(), '1111')
    await alertSays('개인 코드가 달라요')
    expect(readJoinCode()).toBe(AUTH_MOCK.joinCode)
  })

  it('반을 확인하지 못한 회색 카드에서도 로그인이 되면 홈으로 가고 가입 코드를 저장한다', async () => {
    server.use(http.post('*/api/v1/auth/code/verify', () => HttpResponse.error()))
    const { router } = renderAt()
    const user = userEvent.setup()

    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await screen.findByText('G7KM 2XP4')
    await user.type(pinInput(), AUTH_MOCK.personalCode)

    expect(await home()).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(readJoinCode()).toBe(AUTH_MOCK.joinCode)
  })

  it('저장값 모양이 틀리면(소문자) 저장된 반이 없는 것으로 보고 ①, 확인을 부르지 않는다', async () => {
    localStorage.setItem('jg4s.joinCode', 'g7km2xp4')
    renderAt('/rejoin')

    expect(joinStep()).not.toHaveAttribute('aria-hidden')
    expect(joinInput()).toHaveValue('')
    await settle()
    expect(verifyCount).toBe(0)
    expect(screen.queryByText(/저장된 코드를/)).not.toBeInTheDocument()
  })

  it('저장된 가입 코드 없이 /rejoin으로 열면 ① — 가입 코드 8칸과 "교사" 링크', () => {
    renderAt('/rejoin')

    expect(joinStep()).not.toHaveAttribute('aria-hidden')
    expect(joinInput()).not.toHaveAttribute('tabindex')
    expect(screen.getByRole('link', { name: '교사' })).toBeInTheDocument()
  })

  it('잠금(423)일 때 서버의 고정 detail 문구는 보이지 않는다', async () => {
    renderAt()
    const user = userEvent.setup()
    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await classCard()

    await user.type(pinInput(), AUTH_MOCK.lockedPersonalCode)
    await alertSays('오후 3시 42분')
    const alert = screen.getByRole('alert')
    expect(alert).not.toHaveTextContent(AUTH_MOCK.lockedDetail)
  })

  it('로그인이 5xx면 "잠시 후 다시 시도해 주세요"', async () => {
    server.use(
      http.post('*/api/v1/auth/student/login', () => HttpResponse.json({}, { status: 500 })),
    )
    renderAt()
    const user = userEvent.setup()
    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await classCard()

    await user.type(pinInput(), AUTH_MOCK.personalCode)
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요'),
    )
  })

  it('다른 코드가 없는 코드여도 기기에 저장된 가입 코드는 지우지 않는다', async () => {
    saveJoinCode(AUTH_MOCK.joinCode)
    renderAt(qr('c=AAAABBBB'))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('반 QR이 바뀌었어요'))
    expect(readJoinCode()).toBe(AUTH_MOCK.joinCode)
  })

  it('StrictMode(effect 두 번)에서도 반 확인은 한 번만 — 직접 입력·다시 들어오기', async () => {
    renderRoutes(routes, { initialEntries: ['/join'], strict: true })
    const user = userEvent.setup()
    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await classCard()
    await settle()
    expect(verifyCount).toBe(1)
  })

  it('StrictMode 다시 들어오기도 반 확인 한 번', async () => {
    saveJoinCode(AUTH_MOCK.joinCode)
    renderRoutes(routes, { initialEntries: ['/rejoin'], strict: true })
    await classCard()
    await settle()
    expect(verifyCount).toBe(1)
  })

  it('이미 아는 없는 코드를 다시 치면 포커스는 가입 코드에 남는다', async () => {
    renderAt()
    const user = userEvent.setup()
    await user.type(joinInput(), 'AAAABBBB')
    await waitFor(() => expect(joinInput()).toHaveFocus())

    await user.type(joinInput(), '{Backspace}B')
    expect(joinInput()).toHaveFocus()
  })

  it('반 확인 실패는 상태·code·requestId만 콘솔에 남기고 가입 코드 값은 남기지 않는다', async () => {
    renderAt()
    const user = userEvent.setup()
    await user.type(joinInput(), AUTH_MOCK.rateLimitedJoinCode)
    await screen.findByText('ZZZZ ZZZZ')

    expect(console.error).toHaveBeenCalledWith(
      '[api] verify',
      expect.objectContaining({ status: 429, code: 'RATE_LIMITED' }),
    )
    const logged = vi.mocked(console.error).mock.calls.map((args) => JSON.stringify(args))
    for (const line of logged) expect(line).not.toContain(AUTH_MOCK.rateLimitedJoinCode)
  })

  it('반 확인이 10초 안에 오지 않으면 1초 뒤 "확인하는 중", 10초에 끊고 회색 카드로', async () => {
    server.use(http.post('*/api/v1/auth/code/verify', never))
    vi.useFakeTimers()
    renderAt()

    fireEvent.change(joinInput(), { target: { value: AUTH_MOCK.joinCode } })
    await act(() => vi.advanceTimersByTimeAsync(999))
    expect(screen.queryByText('확인하는 중')).not.toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(screen.getByText('확인하는 중')).toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(9_000))
    await act(() => vi.advanceTimersByTimeAsync(200)) // ① 사라짐 160ms
    expect(screen.getByText('G7KM 2XP4')).toBeInTheDocument()
    expect(
      screen.getByText('지금은 반을 확인하지 못했어요. 그대로 들어가도 돼요'),
    ).toBeInTheDocument()
  })

  it('다시 들어오기에서 확인이 늦으면 이름표 아래 "확인하는 중"', async () => {
    saveJoinCode(AUTH_MOCK.joinCode)
    server.use(http.post('*/api/v1/auth/code/verify', never))
    vi.useFakeTimers()
    renderAt('/rejoin')

    await act(() => vi.advanceTimersByTimeAsync(1_000))
    expect(document.getElementById('wait-line')).toHaveTextContent('확인하는 중')
  })

  it('로그인이 10초 안에 오지 않으면 끊고 연결 확인 문구, 다시 칠 수 있다', async () => {
    renderAt()
    const user = userEvent.setup()
    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await classCard()
    server.use(http.post('*/api/v1/auth/student/login', never))
    vi.useFakeTimers()

    fireEvent.change(pinInput(), { target: { value: AUTH_MOCK.personalCode } })
    expect(screen.getByText('들어가는 중')).toBeInTheDocument()
    await act(() => vi.advanceTimersByTimeAsync(10_000))

    expect(screen.getByRole('alert')).toHaveTextContent('인터넷 연결을 확인하고 다시 시도해 주세요')
    fireEvent.change(pinInput(), { target: { value: '3' } })
    expect(pinInput()).toHaveValue('3')
  })

  it('카드 QR 4칸을 하나 지우면 "들어가기"는 막힌다', async () => {
    renderAt(qr(`c=${AUTH_MOCK.joinCode}&p=${AUTH_MOCK.personalCode}`))
    await classCard()

    fireEvent.change(pinInput(), { target: { value: '381' } })
    expect(screen.getByRole('button', { name: '들어가기' })).toBeDisabled()
  })

  it('카드 QR 로그인이 실패하면 포커스가 개인 코드 입력으로 간다(버튼이 사라져도)', async () => {
    renderAt(qr(`c=${AUTH_MOCK.joinCode}&p=1111`))
    const user = userEvent.setup()
    await classCard()

    await user.click(screen.getByRole('button', { name: '들어가기' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('카드가 예전 것'))
    expect(pinInput()).toHaveFocus()
  })

  it('오류 줄의 alert·status 영역은 늘 있고 글만 바뀐다("들어가는 중" → 실패 문구)', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    server.use(
      http.post('*/api/v1/auth/student/login', async () => {
        await gate
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    renderAt()
    const user = userEvent.setup()
    await user.type(joinInput(), AUTH_MOCK.joinCode)
    await classCard()

    const line = document.getElementById('pin-line')!
    const alert = within(line).getByRole('alert')
    const status = within(line).getByRole('status')
    await user.type(pinInput(), AUTH_MOCK.personalCode)
    expect(status).toHaveTextContent('들어가는 중')
    expect(alert).toHaveTextContent('')

    release()
    await waitFor(() => expect(alert).toHaveTextContent('잠시 후 다시 시도해 주세요'))
    expect(within(line).getByRole('alert')).toBe(alert)
    expect(status).toHaveTextContent('')
  })
})
