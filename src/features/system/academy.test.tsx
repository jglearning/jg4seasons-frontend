import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { resetSystemMock } from '../../mocks/systemData'
import { renderRoutes } from '../../test/render'

// O-03 학원 상세·교재 사용권(7.3·7.4)

// 보낸 운영자 요청(메서드·경로·본문 — GET도 센다: 그 줄만 바꾸는지 보려고)
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

describe('O-03 학원 상세·교재 사용권', () => {
  it('학원 정보와 사용권 줄(교재·기간·상태·남은 날·학생 수)을 서버 값·순서 그대로, 한도 넘음 표시', async () => {
    renderAt('/system/academies/1')

    expect(await screen.findByRole('heading', { name: 'JEY 어학원', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('기준일 12/19 (토)')).toBeInTheDocument()
    expect(screen.getByText('jey')).toBeInTheDocument()
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

  it('[고치기]는 아래 폼에 그 줄 값을 채우고 교재 칸으로 포커스', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/1')
    await screen.findByRole('heading', { name: 'JEY 어학원', level: 1 })

    await user.click(screen.getByRole('button', { name: '블루 · 겨울 (L3-B1) 고치기' }))

    expect(screen.getByLabelText('교재')).toHaveValue('L3-B1')
    expect(screen.getByLabelText('교재')).toHaveFocus()
    expect(screen.getByLabelText('시작일')).toHaveValue('2026-12-01')
    expect(screen.getByLabelText('종료일')).toHaveValue('2027-02-28')
    expect(screen.getByLabelText('학생 수')).toHaveValue(20)
    expect(screen.getByText('지정된 교재 — 저장하면 기간·학생 수를 고침')).toBeInTheDocument()
  })

  it('있는 줄을 고치면 PUT 응답으로 그 줄만 바꾼다(상세를 다시 받지 않음), 폼은 비우고 저장 안내', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/1')
    await screen.findByRole('heading', { name: 'JEY 어학원', level: 1 })

    await user.click(screen.getByRole('button', { name: '블루 · 겨울 (L3-B1) 고치기' }))
    await user.clear(screen.getByLabelText('학생 수'))
    await user.type(screen.getByLabelText('학생 수'), '25')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await vi.waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('저장함 — 블루 · 겨울 (L3-B1)'),
    )
    expect(sent.filter((s) => s.method === 'PUT')).toEqual([
      {
        method: 'PUT',
        path: '/api/v1/system/academies/1/licenses/L3-B1',
        body: { startDate: '2026-12-01', endDate: '2027-02-28', seats: 25 },
      },
    ])
    // 캐시 변경은 쿼리 알림(다음 틱)으로 그려진다
    await vi.waitFor(() =>
      expect(rowsText()[1]).toEqual([
        '블루 · 겨울 (L3-B1)',
        '2026-12-01 ~ 2027-02-28',
        '사용 중',
        '72일',
        '22 / 25',
      ]),
    )
    expect(detailGets()).toBe(1)
    expect(screen.getByLabelText('교재')).toHaveValue('')
    // 저장 중 버튼이 비활성화되어 빠진 포커스를 교재 칸으로
    expect(screen.getByLabelText('교재')).toHaveFocus()
    expect(screen.getByLabelText('학생 수')).toHaveValue(null)
  })

  it('새 교재는 저장 뒤 상세를 다시 받아 서버 순서(레벨·권)대로, 상태는 서버 값', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/1')
    await screen.findByRole('heading', { name: 'JEY 어학원', level: 1 })

    await user.selectOptions(screen.getByLabelText('교재'), 'L1-B2')
    await user.type(screen.getByLabelText('시작일'), '2027-03-01')
    await user.type(screen.getByLabelText('종료일'), '2027-05-31')
    await user.type(screen.getByLabelText('학생 수'), '15')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await vi.waitFor(() => expect(rowsText()).toHaveLength(3))
    expect(rowsText()[0]).toEqual([
      '민트 · 봄 (L1-B2)',
      '2027-03-01 ~ 2027-05-31',
      '시작 전',
      '—',
      '0 / 15',
    ])
    expect(detailGets()).toBe(2)
  })

  it('이미 지정된 교재를 고르면 지금 값을 채운다(같은 교재 = 고치기)', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/1')
    await screen.findByRole('heading', { name: 'JEY 어학원', level: 1 })

    await user.selectOptions(screen.getByLabelText('교재'), 'L2-B1')

    expect(screen.getByLabelText('시작일')).toHaveValue('2026-12-01')
    expect(screen.getByLabelText('학생 수')).toHaveValue(20)
  })

  it('교재를 안 고르거나 학생 수가 비면 보내지 않고 그 칸에 안내·포커스(빈 칸이 0으로 가지 않게)', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/1')
    await screen.findByRole('heading', { name: 'JEY 어학원', level: 1 })

    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(screen.getByLabelText('교재')).toHaveAccessibleDescription('교재를 고르세요')
    expect(screen.getByLabelText('교재')).toHaveFocus()

    await user.selectOptions(screen.getByLabelText('교재'), 'L4-B1')
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(screen.getByLabelText('학생 수')).toHaveAccessibleDescription(/학생 수를 입력하세요/)
    expect(screen.getByLabelText('학생 수')).toHaveFocus()
    expect(sent.filter((s) => s.method === 'PUT')).toEqual([])
  })

  it('종료일이 시작일보다 앞이면(400 endDate) 종료일 칸 옆에, 포커스도 그 칸', async () => {
    const user = userEvent.setup()
    renderAt('/system/academies/1')
    await screen.findByRole('heading', { name: 'JEY 어학원', level: 1 })

    await user.selectOptions(screen.getByLabelText('교재'), 'L4-B1')
    await user.type(screen.getByLabelText('시작일'), '2027-03-01')
    await user.type(screen.getByLabelText('종료일'), '2027-02-01')
    await user.type(screen.getByLabelText('학생 수'), '10')
    await user.click(screen.getByRole('button', { name: '저장' }))

    const end = screen.getByLabelText('종료일')
    await vi.waitFor(() => expect(end).toHaveAccessibleDescription(/종료일은 시작일과 같거나 뒤/))
    await vi.waitFor(() => expect(end).toHaveFocus())
    expect(screen.queryByRole('status')).toBeEmptyDOMElement()
  })

  it('없는 학원(404)이면 서버 문구, 다시 시도는 없다', async () => {
    renderAt('/system/academies/999')

    expect(await screen.findByRole('alert')).toHaveTextContent('학원을 찾을 수 없습니다')
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })
})
