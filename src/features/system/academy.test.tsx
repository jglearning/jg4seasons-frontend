import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { resetSystemMock } from '../../mocks/systemData'
import { renderRoutes } from '../../test/render'

// O-03 학원 상세·교재 사용권(7.3·7.4) — 여러 권을 체크해 기간·한도 한 벌로 저장(#117)

// 보낸 운영자 요청(메서드·경로·본문 — GET도 센다: 저장 뒤 상세를 다시 받는지 보려고)
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

function renderAt(path: string) {
  return renderRoutes(routes, { initialEntries: [path] })
}

const SEATS = '학생 수 한도(산 교재 부수)'
const licenseTable = () => screen.getByRole('table', { name: '교재 사용권' })
const rowsText = () =>
  within(licenseTable())
    .getAllByRole('row')
    .slice(1)
    .map((r) =>
      within(r)
        .getAllByRole('cell')
        .slice(0, 5)
        .map((c) => c.textContent),
    )
const detailGets = () =>
  sent.filter((s) => s.method === 'GET' && /\/system\/academies\/\d+$/.test(s.path)).length
const puts = () => sent.filter((s) => s.method === 'PUT')
// 보낸 권 코드(보낸 순서)
const putBooks = () => puts().map((s) => s.path.split('/').pop())
const box = (name: string) => screen.getByRole<HTMLInputElement>('checkbox', { name })
const checkedBooks = () =>
  screen
    .getAllByRole<HTMLInputElement>('checkbox')
    .filter((c) => c.checked && c.value !== 'on')
    .map((c) => c.value)

async function ready() {
  await screen.findByRole('heading', { name: 'JEY 어학원', level: 1 })
}

async function fill(user: ReturnType<typeof userEvent.setup>, seats = '30') {
  await user.type(screen.getByLabelText('시작일'), '2027-03-01')
  await user.type(screen.getByLabelText('종료일'), '2027-05-31')
  await user.type(screen.getByLabelText(SEATS), seats)
}

describe('O-03 학원 상세·교재 사용권', () => {
  it('학원 정보와 사용권 줄(교재·기간·상태·남은 날·학생 수 / 한도)을 서버 값·순서 그대로, 한도 넘음 표시', async () => {
    renderAt('/system/academies/1')

    expect(await screen.findByRole('heading', { name: 'JEY 어학원', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('기준일 12/19 (토)')).toBeInTheDocument()
    expect(screen.getByText('jey')).toBeInTheDocument()
    expect(
      within(licenseTable())
        .getAllByRole('columnheader')
        .slice(0, 5)
        .map((h) => h.textContent),
    ).toEqual(['교재', '기간', '상태', '남은 날', '학생 수 / 한도'])
    expect(rowsText()).toEqual([
      ['그린 · 겨울 (L2-B1)', '2026-12-01 ~ 2027-02-28', '사용 중', '72일', '18 / 20'],
      ['블루 · 겨울 (L3-B1)', '2026-12-01 ~ 2027-02-28', '사용 중', '72일', '22 / 20 한도 넘음'],
    ])
    expect(screen.getByRole('button', { name: '그린 · 겨울 (L2-B1) 고치기' })).toBeInTheDocument()
    expect(screen.queryByText(/직영 학원/)).not.toBeInTheDocument()
  })

  it('직영 학원: 안내 한 줄, 지정 전이면 "지정된 교재 없음"(지정 폼은 그대로)', async () => {
    renderAt('/system/academies/2')

    expect(
      await screen.findByText(
        '직영 학원 — 모든 교재 제한 없이 사용(지정한 사용권은 적용되지 않음)',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('지정된 교재 없음')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled()
  })

  it('이미 지정된 권은 체크했을 때만 지금 기간·한도를 보인다 — 체크 전·푼 뒤에는 줄이 없다(#135)', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/1')
    await ready()

    // 기간·한도는 위 표에 있다 — 체크 목록에는 덮어쓰려는 권에만
    expect(box('그린 · 겨울 (L2-B1)')).not.toHaveAccessibleDescription()
    expect(screen.queryByText(/지정됨/)).not.toBeInTheDocument()

    await user.click(box('그린 · 겨울 (L2-B1)'))
    expect(box('그린 · 겨울 (L2-B1)')).toHaveAccessibleDescription(
      '겨울 — 지정됨 2026-12-01 ~ 2027-02-28 · 한도 20',
    )
    // 지정되지 않은 권은 체크해도 줄이 없다
    await user.click(box('그린 · 봄 (L2-B2)'))
    expect(box('그린 · 봄 (L2-B2)')).not.toHaveAccessibleDescription()

    await user.click(box('그린 · 겨울 (L2-B1)'))
    expect(box('그린 · 겨울 (L2-B1)')).not.toHaveAccessibleDescription()
  })

  it('[고치기]는 그 권 하나만 체크하고 지금 값을 채운 뒤 그 체크 칸으로 포커스, 덮어쓰기 안내', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/1')
    await ready()
    await user.click(box('민트 세트'))

    await user.click(screen.getByRole('button', { name: '블루 · 겨울 (L3-B1) 고치기' }))

    expect(checkedBooks()).toEqual(['L3-B1'])
    expect(box('블루 · 겨울 (L3-B1)')).toHaveFocus()
    expect(screen.getByLabelText('시작일')).toHaveValue('2026-12-01')
    expect(screen.getByLabelText('종료일')).toHaveValue('2027-02-28')
    expect(screen.getByLabelText(SEATS)).toHaveValue(20)
    expect(screen.getByText('이미 지정된 1권은 기간·한도를 바꿈')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1권 저장' })).toBeEnabled()
    // 고치려는 권에만 지금 값(#135)
    expect(box('블루 · 겨울 (L3-B1)')).toHaveAccessibleDescription(
      '겨울 — 지정됨 2026-12-01 ~ 2027-02-28 · 한도 20',
    )
    expect(box('그린 · 겨울 (L2-B1)')).not.toHaveAccessibleDescription()
  })

  it('한 권을 고쳐 저장하면 PUT 하나, 상세를 다시 받아 그 줄이 바뀌고 폼은 비운다', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/1')
    await ready()

    await user.click(screen.getByRole('button', { name: '블루 · 겨울 (L3-B1) 고치기' }))
    await user.clear(screen.getByLabelText(SEATS))
    await user.type(screen.getByLabelText(SEATS), '25')
    await user.click(screen.getByRole('button', { name: '1권 저장' }))

    await vi.waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1권 저장함'))
    expect(puts()).toEqual([
      {
        method: 'PUT',
        path: '/api/v1/system/academies/1/licenses/L3-B1',
        body: { startDate: '2026-12-01', endDate: '2027-02-28', seats: 25 },
      },
    ])
    await vi.waitFor(() =>
      expect(rowsText()[1]).toEqual([
        '블루 · 겨울 (L3-B1)',
        '2026-12-01 ~ 2027-02-28',
        '사용 중',
        '72일',
        '22 / 25',
      ]),
    )
    expect(detailGets()).toBe(2)
    expect(checkedBooks()).toEqual([])
    // 저장 중 버튼이 비활성화되어 빠진 포커스를 교재 묶음의 첫 칸으로
    expect(box('전체 17권')).toHaveFocus()
    expect(screen.getByLabelText(SEATS)).toHaveValue(null)
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled()
  })

  it('세트를 체크하면 그 레벨 4권을 같은 기간·한도로 차례로 PUT, 표는 서버 순서(레벨·권)', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/1')
    await ready()

    await user.click(box('민트 세트'))
    expect(screen.queryByText(/이미 지정된/)).not.toBeInTheDocument()
    await fill(user, '15')
    await user.click(screen.getByRole('button', { name: '4권 저장' }))

    await vi.waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('4권 저장함'))
    expect(puts()).toEqual(
      ['L1-B1', 'L1-B2', 'L1-B3', 'L1-B4'].map((code) => ({
        method: 'PUT',
        path: `/api/v1/system/academies/1/licenses/${code}`,
        body: { startDate: '2027-03-01', endDate: '2027-05-31', seats: 15 },
      })),
    )
    await vi.waitFor(() => expect(rowsText()).toHaveLength(6))
    expect(rowsText()[1]).toEqual([
      '민트 · 봄 (L1-B2)',
      '2027-03-01 ~ 2027-05-31',
      '시작 전',
      '—',
      '0 / 15',
    ])
    // 상세는 끝난 뒤 한 번만 다시 받는다(권마다 받지 않음)
    expect(detailGets()).toBe(2)
    // 성공한 권에는 줄을 달지 않는다 — 요약 "4권 저장함" 한 줄만(#135)
    expect(box('민트 · 겨울 (L1-B1)')).not.toHaveAccessibleDescription()
    expect(screen.queryByText(/— (저장함|지정됨)/)).not.toBeInTheDocument()
  })

  it('전체 17권: 이미 지정된 권 수를 알리고 17권 모두 PUT', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/1')
    await ready()

    await user.click(box('전체 17권'))
    expect(screen.getByText('이미 지정된 2권은 기간·한도를 바꿈')).toBeInTheDocument()
    await fill(user)
    await user.click(screen.getByRole('button', { name: '17권 저장' }))

    await vi.waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('17권 저장함'))
    expect(putBooks()).toHaveLength(17)
    expect(putBooks()[0]).toBe('L1-B1')
    expect(putBooks()[16]).toBe('K-B1')
    await vi.waitFor(() => expect(rowsText()).toHaveLength(17))
    // 17권이 모두 지정돼도 체크 목록에 권별 줄이 쌓이지 않는다(#135)
    expect(screen.queryByText(/— (저장함|지정됨)/)).not.toBeInTheDocument()
  })

  it('중간에 실패하면 멈추고(뒤 권은 보내지 않음) 남은 권만 체크를 남긴다 — 다시 저장하면 남은 권만', async () => {
    const user = userEvent.setup()
    server.use(
      http.put(
        '*/api/v1/system/academies/1/licenses/L1-B3',
        () => new HttpResponse(null, { status: 500 }),
      ),
    )
    renderAt('/system/academies/1')
    await ready()

    await user.click(box('민트 세트'))
    await fill(user)
    await user.click(screen.getByRole('button', { name: '4권 저장' }))

    await vi.waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('4권 중 2권 저장함 · 2권 남음'),
    )
    expect(putBooks()).toEqual(['L1-B1', 'L1-B2', 'L1-B3'])
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(checkedBooks()).toEqual(['L1-B3', 'L1-B4'])
    // 저장된 권에는 줄이 없고, 남은 권에만 실패·안 보냄(#135)
    expect(box('민트 · 겨울 (L1-B1)')).not.toHaveAccessibleDescription()
    expect(box('민트 · 봄 (L1-B2)')).not.toHaveAccessibleDescription()
    expect(box('민트 · 여름 (L1-B3)')).toHaveAccessibleDescription('여름 — 실패')
    expect(box('민트 · 가을 (L1-B4)')).toHaveAccessibleDescription('가을 — 안 보냄')
    // 넣은 값은 그대로 — 다시 넣지 않게
    expect(screen.getByLabelText(SEATS)).toHaveValue(30)
    // 저장된 두 권은 표에
    await vi.waitFor(() => expect(rowsText()).toHaveLength(4))

    server.resetHandlers()
    sent = []
    await user.click(screen.getByRole('button', { name: '2권 저장' }))

    await vi.waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2권 저장함'))
    expect(putBooks()).toEqual(['L1-B3', 'L1-B4'])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await vi.waitFor(() => expect(rowsText()).toHaveLength(6))
  })

  it('교재를 안 고르거나 한도가 비면 보내지 않고 그 칸에 안내·포커스(빈 칸이 0으로 가지 않게)', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/1')
    await ready()

    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(screen.getByRole('group', { name: '교재' })).toHaveAccessibleDescription(
      '교재를 고르세요',
    )
    expect(box('전체 17권')).toHaveFocus()

    await user.click(box('네이비 · 겨울 (L4-B1)'))
    await user.click(screen.getByRole('button', { name: '1권 저장' }))
    expect(screen.getByLabelText(SEATS)).toHaveAccessibleDescription(/학생 수 한도를 입력하세요/)
    expect(screen.getByLabelText(SEATS)).toHaveFocus()
    expect(puts()).toEqual([])
  })

  it('종료일이 시작일보다 앞이면(400 endDate) 첫 권에서 멈추고 종료일 칸 옆에, 포커스도 그 칸', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/1')
    await ready()

    await user.click(box('네이비 세트'))
    await user.type(screen.getByLabelText('시작일'), '2027-03-01')
    await user.type(screen.getByLabelText('종료일'), '2027-02-01')
    await user.type(screen.getByLabelText(SEATS), '10')
    await user.click(screen.getByRole('button', { name: '4권 저장' }))

    const end = screen.getByLabelText('종료일')
    await vi.waitFor(() => expect(end).toHaveAccessibleDescription(/종료일은 시작일과 같거나 뒤/))
    await vi.waitFor(() => expect(end).toHaveFocus())
    expect(putBooks()).toEqual(['L4-B1'])
    expect(screen.getByRole('status')).toHaveTextContent('4권 중 0권 저장함 · 4권 남음')
    expect(checkedBooks()).toEqual(['L4-B1', 'L4-B2', 'L4-B3', 'L4-B4'])
    // 저장된 권이 없으면 상세를 다시 받지 않는다
    expect(detailGets()).toBe(1)
  })

  it('없는 학원(404)이면 서버 문구, 다시 시도는 없다', async () => {
    renderAt('/system/academies/999')

    expect(await screen.findByRole('alert')).toHaveTextContent('학원을 찾을 수 없습니다')
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })
})
