import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../../app/routes'
import { ADMIN_MOCK, resetAdminMock } from '../../mocks/adminData'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { renderRoutes } from '../../test/render'

// 보낸 관리자 요청(메서드·경로·본문)
let sent: Array<{ method: string; path: string; body: unknown }>

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
  resetAdminMock()
  setMockSession('admin')
  sent = []
  server.events.on('request:start', async ({ request }) => {
    const path = new URL(request.url).pathname
    if (!path.startsWith('/api/v1/admin') || request.method === 'GET') return
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

const menu = () => screen.getByRole('navigation', { name: '관리 메뉴' })

describe('교사·관리자 틀과 관리자만', () => {
  it('관리자 메뉴: 반 목록·반 관리·교사 관리, 지금 메뉴 표시와 이름·역할', async () => {
    renderAt('/admin/classes')
    await screen.findByRole('heading', { name: '반 관리' })

    const links = within(menu()).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(['반 목록', '반 관리', '교사 관리'])
    expect(within(menu()).getByRole('link', { name: '반 관리' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByText('박원장 · 관리자')).toBeInTheDocument()
  })

  it('교사가 주소로 들어오면 안내만 — 관리 메뉴도 없다', async () => {
    setMockSession('teacher')
    renderAt('/admin/classes')

    expect(await screen.findByRole('alert')).toHaveTextContent('관리자만 볼 수 있는 화면입니다')
    expect(
      within(menu())
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['반 목록'])
    expect(screen.queryByRole('heading', { name: '반 관리' })).not.toBeInTheDocument()
  })
})

describe('A-01 반 관리', () => {
  it('목록 표: 반 이름·권(레벨·시즌)·요일·개강일·담당 교사·학생 수·가입 코드·상태', async () => {
    renderAt('/admin/classes')
    const table = await screen.findByRole('table', { name: '반 목록' })

    const row = within(table).getByRole('row', { name: /겨울 그린 A반/ })
    expect(row).toHaveTextContent('그린 · 겨울 (L2-B1)')
    expect(row).toHaveTextContent('화·목·토')
    expect(row).toHaveTextContent('2026-12-10')
    expect(row).toHaveTextContent('이선생')
    expect(row).toHaveTextContent('18명')
    expect(row).toHaveTextContent('G7KM2XP4')
    expect(row).toHaveTextContent('운영 중')
    expect(within(row).getByRole('link', { name: '겨울 그린 A반' })).toHaveAttribute(
      'href',
      '/admin/classes/12',
    )
  })

  it('반 만들기: 권은 레벨·시즌 목록, 요일·담당 교사(활성만) — 만들면 상세(가입 코드)로', async () => {
    const user = userEvent.setup()
    const { router } = renderAt('/admin/classes/new')
    await screen.findByRole('heading', { name: '반 만들기' })

    await user.type(screen.getByLabelText('반 이름'), ' 봄 그린 B반 ')
    await user.selectOptions(screen.getByLabelText('권'), 'L2-B2')
    await user.type(screen.getByLabelText('개강일'), '2027-03-02')
    const days = screen.getByRole('group', { name: '수업 요일' })
    await user.click(within(days).getByLabelText('화'))
    await user.click(within(days).getByLabelText('화')) // 다시 누르면 빠진다
    await user.click(within(days).getByLabelText('수'))
    await user.click(within(days).getByLabelText('월'))
    const teachers = await screen.findByRole('group', { name: '담당 교사' })
    expect(within(teachers).queryByLabelText('최선생')).not.toBeInTheDocument() // 비활성
    await user.click(within(teachers).getByLabelText('이선생'))
    await user.click(screen.getByRole('button', { name: '만들기' }))

    expect(await screen.findByRole('heading', { name: '봄 그린 B반' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/classes/100')
    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/api/v1/admin/classes',
        body: {
          name: '봄 그린 B반',
          bookCode: 'L2-B2',
          startDate: '2027-03-02',
          weekdays: [1, 3],
          teacherIds: [ADMIN_MOCK.teacherId],
        },
      },
    ])
    expect(screen.getByText('그린 · 봄 (L2-B2)')).toBeInTheDocument()
    expect(screen.getByText('N001K7QX')).toBeInTheDocument()
  })

  it('반 만들기: 서버 칸 오류는 그 칸 옆에', async () => {
    const user = userEvent.setup()
    renderAt('/admin/classes/new')
    await screen.findByRole('heading', { name: '반 만들기' })

    await user.click(screen.getByRole('button', { name: '만들기' }))

    expect(await screen.findByText('반 이름은 1~50자')).toBeInTheDocument()
    expect(screen.getByLabelText('반 이름')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('없는 권이에요')).toBeInTheDocument()
    expect(screen.getByText('수업 요일을 하나 이상 골라 주세요')).toBeInTheDocument()
    // 칸 옆에 보였으니 폼 아래 문구는 없다
    expect(screen.queryByText('입력값을 확인해 주세요')).not.toBeInTheDocument()
  })

  it('반 상세: 바뀐 칸만 보내고 "저장됨", 운영 중이 아니면 입장 불가 안내', async () => {
    const user = userEvent.setup()
    renderAt('/admin/classes/12')
    await screen.findByRole('heading', { name: '겨울 그린 A반' })
    expect(screen.getByText('그린 · 겨울 (L2-B1)')).toBeInTheDocument()
    expect(
      screen.queryByText('운영 중이 아니면 이 반 가입 코드로 들어올 수 없음'),
    ).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('상태'), 'finished')
    expect(
      screen.getByText('운영 중이 아니면 이 반 가입 코드로 들어올 수 없음'),
    ).toBeInTheDocument()
    await user.click(screen.getByLabelText('아직 수업하지 않은 회차도 미리 듣기 허용'))
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByRole('status')).toHaveTextContent('저장됨')
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/api/v1/admin/classes/12',
        body: { status: 'finished', allowFutureLessons: true },
      },
    ])
    expect(screen.getByText(/종강 · 학생 18명/)).toBeInTheDocument()
  })

  it('반 상세: 이미 담당인 비활성 교사도 목록에 남아 그대로 보낼 수 있다', async () => {
    const user = userEvent.setup()
    // 최선생(비활성)을 교사 수정 화면에서 반 12 담당으로 넣는다(교사 화면은 담당 반을 자유롭게 바꾼다)
    renderAt('/admin/teachers/22')
    await screen.findByRole('heading', { name: '최선생' })
    await user.click(
      await within(screen.getByRole('group', { name: '담당 반' })).findByLabelText('겨울 그린 A반'),
    )
    await user.click(screen.getByRole('button', { name: '저장' }))
    await screen.findByRole('heading', { name: '교사 관리' })

    await user.click(within(menu()).getByRole('link', { name: '반 관리' }))
    await user.click(await screen.findByRole('link', { name: '겨울 그린 A반' }))
    const group = await screen.findByRole('group', { name: '담당 교사' })

    expect(within(group).getByLabelText('최선생(비활성)')).toBeChecked()
  })

  it('가입 코드 재발급은 화면 안에서 한 번 더 확인 — 취소하면 요청 없음', async () => {
    const user = userEvent.setup()
    renderAt('/admin/classes/12')
    await screen.findByText('G7KM2XP4')
    expect(screen.getByText('발급 2026-11-01 10:00')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '재발급' }))
    const confirm = screen.getByRole('group', { name: '재발급 확인' })
    await user.click(within(confirm).getByRole('button', { name: '취소' }))
    expect(sent).toEqual([])

    await user.click(screen.getByRole('button', { name: '재발급' }))
    await user.click(
      within(screen.getByRole('group', { name: '재발급 확인' })).getByRole('button', {
        name: '재발급',
      }),
    )

    expect(await screen.findByText('N001K7QX')).toBeInTheDocument()
    expect(screen.getByText('발급 2026-11-06 20:30')).toBeInTheDocument()
    expect(sent).toEqual([
      { method: 'POST', path: '/api/v1/admin/classes/12/access-code/regenerate', body: null },
    ])
  })
})

describe('A-03 교사 관리', () => {
  it('목록 표: 아이디·역할·상태·담당 반(이름)·마지막 로그인(한국 시간)', async () => {
    renderAt('/admin/teachers')
    const table = await screen.findByRole('table', { name: '교사 목록' })

    const kim = within(table).getByRole('row', { name: /이선생/ })
    expect(kim).toHaveTextContent('teacher01')
    expect(kim).toHaveTextContent('교사')
    expect(kim).toHaveTextContent('활성')
    expect(await within(kim).findByText('겨울 그린 A반')).toBeInTheDocument()
    expect(kim).toHaveTextContent('2026-11-06 08:05')
    const choi = within(table).getByRole('row', { name: /최선생/ })
    expect(choi).toHaveTextContent('비활성')
    expect(choi).toHaveTextContent('없음')
    expect(within(table).getByRole('row', { name: /박원장/ })).toHaveTextContent('관리자')
  })

  it('교사 추가: 보낸 뒤 목록으로 — 비밀번호는 캐시·주소에 남지 않는다', async () => {
    const user = userEvent.setup()
    const { client, router } = renderAt('/admin/teachers/new')
    await screen.findByRole('heading', { name: '교사 추가' })

    await user.type(screen.getByLabelText('이름'), '정선생')
    await user.type(screen.getByLabelText('아이디'), 'Teacher03')
    await user.type(screen.getByLabelText('비밀번호'), 'secret-pass-9')
    await user.click(
      within(await screen.findByRole('group', { name: '담당 반' })).getByLabelText('겨울 그린 A반'),
    )
    await user.click(screen.getByRole('button', { name: '추가' }))

    const table = await screen.findByRole('table', { name: '교사 목록' })
    expect(within(table).getByRole('row', { name: /정선생/ })).toHaveTextContent('teacher03')
    expect(sent[0]).toEqual({
      method: 'POST',
      path: '/api/v1/admin/teachers',
      body: {
        name: '정선생',
        loginId: 'Teacher03',
        password: 'secret-pass-9',
        role: 'teacher',
        classIds: [ADMIN_MOCK.classId],
      },
    })
    const cache = JSON.stringify([
      client
        .getQueryCache()
        .getAll()
        .map((q) => q.state.data),
      client
        .getMutationCache()
        .getAll()
        .map((m) => m.state.variables),
    ])
    expect(cache).not.toContain('secret-pass-9')
    expect(JSON.stringify(router.state)).not.toContain('secret-pass-9')
  })

  it('아이디가 겹치면(409) 아이디 칸 옆에', async () => {
    const user = userEvent.setup()
    renderAt('/admin/teachers/new')
    await screen.findByRole('heading', { name: '교사 추가' })

    await user.type(screen.getByLabelText('이름'), '정선생')
    await user.type(screen.getByLabelText('아이디'), ADMIN_MOCK.takenLoginId)
    await user.type(screen.getByLabelText('비밀번호'), 'secret-pass-9')
    await user.click(screen.getByRole('button', { name: '추가' }))

    expect(await screen.findByText('이미 쓰는 아이디입니다')).toBeInTheDocument()
    expect(screen.getByLabelText('아이디')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('비밀번호')).toHaveValue('') // 보낸 뒤 비움
  })

  it('교사 수정: 바뀐 칸만 보낸다(비밀번호는 비우면 안 보냄)', async () => {
    const user = userEvent.setup()
    renderAt(`/admin/teachers/${ADMIN_MOCK.teacherId}`)
    await screen.findByRole('heading', { name: '이선생' })

    await user.selectOptions(screen.getByLabelText('상태'), 'inactive')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await screen.findByRole('heading', { name: '교사 관리' })
    expect(sent).toEqual([
      { method: 'PATCH', path: '/api/v1/admin/teachers/21', body: { status: 'inactive' } },
    ])
  })

  it('교사 수정: 담당 반만 바꾸면 담당 반만 보낸다', async () => {
    const user = userEvent.setup()
    renderAt(`/admin/teachers/${ADMIN_MOCK.teacherId}`)
    await screen.findByRole('heading', { name: '이선생' })

    await user.click(
      await within(screen.getByRole('group', { name: '담당 반' })).findByLabelText('겨울 그린 A반'),
    )
    await user.click(screen.getByRole('button', { name: '저장' }))

    await screen.findByRole('heading', { name: '교사 관리' })
    expect(sent).toEqual([
      { method: 'PATCH', path: '/api/v1/admin/teachers/21', body: { classIds: [] } },
    ])
  })

  it('자기 계정 비활성화(409)는 상태 칸 옆에', async () => {
    const user = userEvent.setup()
    renderAt(`/admin/teachers/${ADMIN_MOCK.adminId}`)
    await screen.findByRole('heading', { name: '박원장' })

    await user.selectOptions(screen.getByLabelText('상태'), 'inactive')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('자기 계정은 비활성화할 수 없습니다')).toBeInTheDocument()
    expect(screen.getByLabelText('상태')).toHaveAttribute('aria-invalid', 'true')
  })
})
