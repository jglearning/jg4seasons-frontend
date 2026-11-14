import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { clearMockAcademies, resetSystemMock, SYSTEM_MOCK } from '../../mocks/systemData'
import { renderRoutes } from '../../test/render'

// 보낸 운영자 요청(메서드·경로·본문)
let sent: Array<{ method: string; path: string; body: unknown }>

beforeEach(() => {
  resetAuthMock()
  resetSystemMock()
  setMockSession('superadmin')
  sent = []
  server.events.on('request:start', async ({ request }) => {
    const path = new URL(request.url).pathname
    if (!path.startsWith('/api/v1/system') || request.method === 'GET') return
    const text = await request.clone().text()
    sent.push({ method: request.method, path, body: text ? JSON.parse(text) : null })
  })
})

afterEach(() => {
  server.events.removeAllListeners()
})

function renderAt(path: string) {
  return renderRoutes(routes, { initialEntries: [path] })
}

const PASSWORD = 'first-admin-1234'

describe('O-01 학원 관리', () => {
  it('학원 이름·주소·사용권(직영/연계)·타임존·상태를 서버 순서대로, 학원 수', async () => {
    renderAt('/system/academies')
    const table = await screen.findByRole('table', { name: '학원 목록' })

    const rows = within(table).getAllByRole('row').slice(1)
    expect(
      rows.map((r) =>
        within(r)
          .getAllByRole('cell')
          .map((c) => c.textContent),
      ),
    ).toEqual([
      ['JEY 어학원', 'jey', '연계', 'Asia/Seoul', '운영'],
      ['한빛 영어학원', 'hanbit-english', '직영', 'Asia/Seoul', '운영'],
    ])
    expect(screen.getByText('2개 학원')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '학원 만들기' })).toHaveAttribute(
      'href',
      '/system/academies/new',
    )
  })

  it('학원이 없으면 "만든 학원 없음"', async () => {
    clearMockAcademies()
    renderAt('/system/academies')

    expect(await screen.findByText('만든 학원 없음')).toBeInTheDocument()
    expect(screen.getByText('0개 학원')).toBeInTheDocument()
  })

  it('목록을 못 받으면(5xx) 문구와 다시 시도', async () => {
    server.use(
      http.get('*/api/v1/system/academies', () =>
        HttpResponse.json({ title: '서버 오류', status: 503 }, { status: 503 }),
      ),
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderAt('/system/academies')

    expect(await screen.findByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('O-02 학원 만들기', () => {
  async function fillValid(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('학원 이름'), ' 새봄 영어 ')
    await user.type(screen.getByLabelText('학원 주소'), 'saebom-eng')
    await user.click(screen.getByRole('radio', { name: /연계/ }))
    const admin = screen.getByRole('group', { name: '첫 관리자' })
    await user.type(within(admin).getByLabelText('아이디'), 'saebom_admin')
    await user.type(within(admin).getByLabelText('이름'), '김원장')
    await user.type(within(admin).getByLabelText('비밀번호'), PASSWORD)
  }

  it('타임존은 Asia/Seoul로 채워져 있고 사용권은 아무것도 고르지 않은 상태', async () => {
    renderAt('/system/academies/new')
    await screen.findByRole('heading', { name: '학원 만들기', level: 1 })

    expect(screen.getByLabelText('타임존')).toHaveValue('Asia/Seoul')
    const license = screen.getByRole('group', { name: '사용권 적용' })
    expect(
      within(license)
        .getAllByRole('radio')
        .map((r) => (r as HTMLInputElement).checked),
    ).toEqual([false, false])
    // 설명 글자는 그 라디오의 설명으로 읽힌다
    expect(within(license).getByRole('radio', { name: '직영' })).toHaveAccessibleDescription(
      '모든 교재 제한 없이 사용',
    )
  })

  it('사용권을 고르지 않으면 보내지 않고 그 칸에 안내, 고르면 안내가 사라진다', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/new')
    await screen.findByRole('heading', { name: '학원 만들기', level: 1 })

    await user.click(screen.getByRole('button', { name: '만들기' }))

    const license = screen.getByRole('group', { name: '사용권 적용' })
    expect(license).toHaveAccessibleDescription('직영 또는 연계를 고르세요')
    expect(license).toHaveAttribute('aria-invalid', 'true')
    expect(within(license).getByRole('radio', { name: '직영' })).toHaveFocus()
    expect(sent).toEqual([])

    await user.click(within(license).getByRole('radio', { name: /직영/ }))
    expect(license).not.toHaveAttribute('aria-invalid')
  })

  it('보내면 POST 본문(이름·주소 앞뒤 공백 정리, 연계 = licenseEnforced true) → O-01에 새 학원', async () => {
    const user = userEvent.setup()
    const { router, client } = renderAt('/system/academies/new')
    await screen.findByRole('heading', { name: '학원 만들기', level: 1 })

    await fillValid(user)
    await user.click(screen.getByRole('button', { name: '만들기' }))

    expect(await screen.findByRole('heading', { name: '학원 관리', level: 1 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/system/academies')
    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/api/v1/system/academies',
        body: {
          name: '새봄 영어',
          slug: 'saebom-eng',
          timezone: 'Asia/Seoul',
          licenseEnforced: true,
          admin: { loginId: 'saebom_admin', name: '김원장', password: PASSWORD },
        },
      },
    ])
    const table = await screen.findByRole('table', { name: '학원 목록' })
    expect(await within(table).findByRole('cell', { name: '새봄 영어' })).toBeInTheDocument()
    // 첫 관리자 비밀번호는 쿼리·뮤테이션 캐시와 주소·history에 남지 않는다
    const cached = JSON.stringify([
      client
        .getQueryCache()
        .getAll()
        .map((q) => q.state.data),
      client
        .getMutationCache()
        .getAll()
        .map((m) => m.state.variables),
      router.state.location,
    ])
    expect(cached).not.toContain(PASSWORD)
  })

  it('타임존을 비우면 보내지 않는다(서버 기본값 Asia/Seoul)', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/new')
    await screen.findByRole('heading', { name: '학원 만들기', level: 1 })

    await fillValid(user)
    await user.clear(screen.getByLabelText('타임존'))
    await user.click(screen.getByRole('button', { name: '만들기' }))

    await screen.findByRole('heading', { name: '학원 관리', level: 1 })
    expect(sent[0]?.body).not.toHaveProperty('timezone')
  })

  it('이미 쓰는 학원 주소(409)는 주소 칸 옆에, 비밀번호는 비운다', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/new')
    await screen.findByRole('heading', { name: '학원 만들기', level: 1 })

    await fillValid(user)
    await user.clear(screen.getByLabelText('학원 주소'))
    await user.type(screen.getByLabelText('학원 주소'), SYSTEM_MOCK.takenSlug)
    await user.click(screen.getByRole('button', { name: '만들기' }))

    const slug = screen.getByLabelText('학원 주소')
    await vi.waitFor(() => expect(slug).toHaveAccessibleDescription(/이미 쓰는 학원 주소입니다/))
    expect(slug).toHaveAttribute('aria-invalid', 'true')
    // 긴 폼 — 오류 칸으로 포커스가 간다
    expect(slug).toHaveFocus()
    expect(screen.getByLabelText('비밀번호')).toHaveValue('')
    // 칸 옆에 보인 오류는 폼 아래에 다시 보이지 않는다
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('이미 쓰는 관리자 아이디(409)는 첫 관리자 아이디 칸 옆에', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/new')
    await screen.findByRole('heading', { name: '학원 만들기', level: 1 })

    await fillValid(user)
    const loginId = within(screen.getByRole('group', { name: '첫 관리자' })).getByLabelText(
      '아이디',
    )
    await user.clear(loginId)
    await user.type(loginId, SYSTEM_MOCK.takenLoginId)
    await user.click(screen.getByRole('button', { name: '만들기' }))

    await vi.waitFor(() => expect(loginId).toHaveAccessibleDescription(/이미 쓰는 아이디입니다/))
  })

  it('400 VALIDATION은 errors[].field(admin.password·timezone)대로 칸마다', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/new')
    await screen.findByRole('heading', { name: '학원 만들기', level: 1 })

    await fillValid(user)
    await user.clear(screen.getByLabelText('타임존'))
    await user.type(screen.getByLabelText('타임존'), '+09:00')
    const password = screen.getByLabelText('비밀번호')
    await user.clear(password)
    await user.type(password, 'short')
    await user.click(screen.getByRole('button', { name: '만들기' }))

    await vi.waitFor(() =>
      expect(screen.getByLabelText('타임존')).toHaveAccessibleDescription(
        /IANA 타임존 이름이 아닙니다/,
      ),
    )
    expect(password).toHaveAccessibleDescription(/8자 이상, 72바이트 이하/)
  })

  it('칸에 붙지 않는 오류(403)는 폼 아래에 운영자 문구', async () => {
    server.use(
      http.post('*/api/v1/system/academies', () =>
        HttpResponse.json(
          { title: '권한이 없습니다', status: 403, code: 'FORBIDDEN' },
          { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    const user = userEvent.setup()
    renderAt('/system/academies/new')
    await screen.findByRole('heading', { name: '학원 만들기', level: 1 })

    await fillValid(user)
    await user.click(screen.getByRole('button', { name: '만들기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('운영자만 할 수 있습니다')
  })

  it('보내는 중에는 버튼이 막혀 두 번 만들지 않는다', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/new')
    await screen.findByRole('heading', { name: '학원 만들기', level: 1 })

    await fillValid(user)
    const button = screen.getByRole('button', { name: '만들기' })
    await user.click(button)
    await user.click(button)

    await screen.findByRole('heading', { name: '학원 관리', level: 1 })
    expect(sent).toHaveLength(1)
  })
})
