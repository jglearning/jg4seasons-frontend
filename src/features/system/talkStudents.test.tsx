import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../../app/routes'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { resetSystemMock } from '../../mocks/systemData'
import { renderRoutes } from '../../test/render'

// O-04 학생별 프리토킹 켜기·끄기(BE #97) — 줄 버튼은 한 명, 묶음 바는 고른 여러 명, 둘 다 PUT 한 번

let sent: Array<{ method: string; path: string; body: unknown }>

beforeEach(() => {
  resetAuthMock()
  resetSystemMock()
  setMockSession('superadmin')
  sent = []
  server.events.on('request:start', async ({ request }) => {
    const path = new URL(request.url).pathname
    if (!path.startsWith('/api/v1/system')) return
    const text = request.method === 'GET' ? '' : await request.clone().text()
    sent.push({ method: request.method, path, body: text ? JSON.parse(text) : null })
  })
})

afterEach(() => {
  server.events.removeAllListeners()
})

const LIST = '/api/v1/system/academies/1/talk/students'
const puts = () => sent.filter((s) => s.method === 'PUT').map((s) => s.body)
const listGets = () => sent.filter((s) => s.method === 'GET' && s.path === LIST).length
const table = () => screen.getByRole('table', { name: '프리토킹 학생' })
// 줄마다 [반, 이름, 프리토킹]
const rows = () =>
  within(table())
    .getAllByRole('row')
    .slice(1)
    .map((r) =>
      within(r)
        .getAllByRole('cell')
        .slice(1, 4)
        .map((c) => c.textContent),
    )

async function open(path = '/system/academies/1/talk') {
  renderRoutes(routes, { initialEntries: [path] })
  await screen.findByRole('heading', { name: '프리토킹 학생', level: 1 })
}

describe('O-04 프리토킹 학생', () => {
  it('O-03에서 링크로 들어오고, 학생을 서버 순서 그대로·켜짐 수와 함께 보인다', async () => {
    const user = userEvent.setup()
    renderRoutes(routes, { initialEntries: ['/system/academies/1'] })
    await user.click(await screen.findByRole('link', { name: '학생별 켜기·끄기 →' }))

    expect(
      await screen.findByRole('heading', { name: '프리토킹 학생', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByText('JEY 어학원 · 켜짐 3명 / 재원생 6명')).toBeInTheDocument()
    expect(
      screen.getByText(/학원 프리토킹이 꺼져 있으면 켜 둔 학생도 쓸 수 없습니다/),
    ).toBeInTheDocument()
    expect(rows()).toEqual([
      ['그린 B', '김하늘', '꺼짐'],
      ['그린 B', '정민지', '켜짐'],
      ['그린 B', '최유나', '꺼짐'],
      ['블루 A', '박서준', '꺼짐'],
      ['블루 A', '이도윤', '켜짐'],
      ['반 없음', '한지호반이 생겨야 사용 가능', '켜짐'],
    ])
    expect(screen.getByRole('link', { name: '← JEY 어학원' })).toHaveAttribute(
      'href',
      '/system/academies/1',
    )
  })

  it('줄 버튼은 그 학생 하나만 PUT 한 번, 응답으로 줄·켜짐 수를 바꾸고 목록은 다시 받지 않는다', async () => {
    const user = userEvent.setup()
    await open()
    const before = listGets()

    await user.click(screen.getByRole('button', { name: '최유나 프리토킹 켜기' }))

    expect(await screen.findByRole('status')).toHaveTextContent('최유나 프리토킹을 켰습니다')
    expect(puts()).toEqual([{ studentIds: [103], enabled: true }])
    expect(await screen.findByRole('button', { name: '최유나 프리토킹 끄기' })).toBeInTheDocument()
    expect(rows()[2]).toEqual(['그린 B', '최유나', '켜짐'])
    expect(screen.getByText('JEY 어학원 · 켜짐 4명 / 재원생 6명')).toBeInTheDocument()
    expect(listGets()).toBe(before)

    await user.click(screen.getByRole('button', { name: '정민지 프리토킹 끄기' }))
    expect(await screen.findByText('정민지 프리토킹을 껐습니다')).toBeInTheDocument()
    expect(puts()[1]).toEqual({ studentIds: [102], enabled: false })
  })

  it('여러 명을 고르면 묶음 바가 나오고, 한 번에 켠 뒤 선택을 비운다', async () => {
    const user = userEvent.setup()
    await open()
    expect(screen.queryByRole('group', { name: '고른 학생' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: '김하늘 선택' }))
    await user.click(screen.getByRole('checkbox', { name: '박서준 선택' }))
    const bar = screen.getByRole('group', { name: '고른 학생' })
    expect(within(bar).getByText('2명 선택')).toBeInTheDocument()

    await user.click(within(bar).getByRole('button', { name: '2명 켜기' }))

    expect(await screen.findByText('2명 프리토킹을 켰습니다')).toBeInTheDocument()
    expect(puts()).toEqual([{ studentIds: [101, 104], enabled: true }])
    await screen.findByRole('button', { name: '김하늘 프리토킹 끄기' })
    expect(rows().map((r) => r[2])).toEqual(['켜짐', '켜짐', '꺼짐', '켜짐', '켜짐', '켜짐'])
    expect(screen.queryByRole('group', { name: '고른 학생' })).not.toBeInTheDocument()
    // 묶음 바가 사라지면 포커스는 머리 체크 칸으로
    expect(screen.getByRole('checkbox', { name: '보이는 학생 모두 선택' })).toHaveFocus()
  })

  it('반·이름·켜진 학생만으로 화면 안에서 거르고, 머리 체크 칸·묶음은 보이는 학생만', async () => {
    const user = userEvent.setup()
    await open()

    // 거르기 전에 고른 학생(블루 A)은 거른 뒤 묶음에 섞이지 않는다
    await user.click(screen.getByRole('checkbox', { name: '박서준 선택' }))
    await user.selectOptions(screen.getByLabelText('반'), '그린 B')
    expect(rows().map((r) => r[1])).toEqual(['김하늘', '정민지', '최유나'])
    expect(screen.queryByRole('group', { name: '고른 학생' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: '보이는 학생 모두 선택' }))
    await user.click(screen.getByRole('button', { name: '3명 끄기' }))
    expect(await screen.findByText('3명 프리토킹을 껐습니다')).toBeInTheDocument()
    expect(puts()).toEqual([{ studentIds: [101, 102, 103], enabled: false }])

    await user.selectOptions(screen.getByLabelText('반'), '반 없음')
    expect(rows().map((r) => r[1])).toEqual(['한지호반이 생겨야 사용 가능'])

    await user.selectOptions(screen.getByLabelText('반'), '전체 반')
    await user.click(screen.getByRole('checkbox', { name: '켜진 학생만' }))
    expect(rows().map((r) => r[1])).toEqual(['이도윤', '한지호반이 생겨야 사용 가능'])

    await user.type(screen.getByLabelText('이름'), '없는')
    expect(within(table()).getByText('조건에 맞는 학생 없음')).toBeInTheDocument()
  })

  it('재원생이 아닌 학생이 섞여 404면 아무것도 바꾸지 않았다고 알리고 명단을 다시 받는다', async () => {
    const user = userEvent.setup()
    await open()
    server.use(
      http.put('*' + LIST, () =>
        HttpResponse.json(
          { title: '학생을 찾을 수 없습니다', status: 404, code: 'NOT_FOUND' },
          { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    const before = listGets()

    await user.click(screen.getByRole('button', { name: '김하늘 프리토킹 켜기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '재원생이 아닌 학생이 있어 아무것도 바꾸지 않았습니다',
    )
    expect(rows()[0]).toEqual(['그린 B', '김하늘', '꺼짐'])
    await screen.findByRole('button', { name: '김하늘 프리토킹 켜기' })
    expect(listGets()).toBe(before + 1)
  })

  it('재원생이 없는 학원은 빈 표', async () => {
    await open('/system/academies/2/talk')
    expect(screen.getByText('한빛 영어학원 · 켜짐 0명 / 재원생 0명')).toBeInTheDocument()
    expect(within(table()).getByText('재원생 없음')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '보이는 학생 모두 선택' })).toBeDisabled()
  })
})
