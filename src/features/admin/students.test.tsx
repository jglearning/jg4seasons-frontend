import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QRCode from 'qrcode'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { resetAdminMock, STUDENT_MOCK } from '../../mocks/adminData'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { renderRoutes } from '../../test/render'

// A-02 학생 관리·A-04 학원 현황(03 §5.2·§5.4, BE #27 계약 기준 목)

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

const rosterTable = () => screen.findByRole('table', { name: '학생 명단' })

/** 이 주소로 만든 QR의 검은 칸을 카드 SVG 경로와 같은 꼴로(여백 2칸) */
function qrPath(text: string): string {
  const modules = QRCode.create(text, { errorCorrectionLevel: 'M' }).modules
  let d = ''
  for (let row = 0; row < modules.size; row++)
    for (let col = 0; col < modules.size; col++)
      if (modules.get(row, col)) d += `M${col + 2},${row + 2}h1v1h-1z`
  return d
}

describe('A-02 진입', () => {
  it('학생 관리: 반 고르기 표에서 반 이름이 명단으로 간다', async () => {
    renderAt('/admin/students')
    const table = await screen.findByRole('table', { name: '반 고르기' })

    const row = within(table).getByRole('row', { name: /겨울 그린 A반/ })
    expect(row).toHaveTextContent('18명')
    expect(within(row).getByRole('link', { name: '겨울 그린 A반' })).toHaveAttribute(
      'href',
      '/admin/classes/12/students',
    )
  })

  it('반 상세에 학생 명단 링크', async () => {
    renderAt('/admin/classes/12')
    expect(await screen.findByRole('link', { name: '학생 명단' })).toHaveAttribute(
      'href',
      '/admin/classes/12/students',
    )
  })
})

describe('A-02 학생 명단', () => {
  it('표: 재원·퇴원 수, 학교·학년·상태, 퇴원생은 선택 칸 없이 복귀만', async () => {
    renderAt('/admin/classes/12/students')
    const table = await rosterTable()

    expect(screen.getByRole('heading', { name: '겨울 그린 A반 학생 명단' })).toBeInTheDocument()
    expect(screen.getByText('재원 18명 · 퇴원 1명')).toBeInTheDocument()
    const first = within(table).getByRole('row', { name: /김민준/ })
    expect(first).toHaveTextContent('A중')
    expect(first).toHaveTextContent('중1')
    expect(first).toHaveTextContent('재원')
    // 코드 발급·최근 접속은 연도 없이 한국 시간(11/8)
    expect(first).toHaveTextContent('11/2 10:00')
    expect(first).toHaveTextContent('11/6 18:00')
    expect(first).not.toHaveTextContent('2026-')
    expect(within(first).getByRole('checkbox', { name: '김민준 선택' })).toBeInTheDocument()
    // 개인 코드가 없으면(codeIssuedAt null) 코드 발급 칸은 "없음"
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent)
    const noCode = within(within(table).getByRole('row', { name: /강수아/ })).getAllByRole('cell')
    expect(noCode[headers.indexOf('코드 발급')]).toHaveTextContent(/^없음$/)

    const gone = within(table).getByRole('row', { name: new RegExp(STUDENT_MOCK.inactiveName) })
    expect(gone).toHaveTextContent('퇴원')
    expect(within(gone).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(
      within(gone).getByRole('button', { name: `${STUDENT_MOCK.inactiveName} 복귀` }),
    ).toBeInTheDocument()
  })

  it('개인 코드 재발급: 고른 학생만 보내고, 결과 코드는 화면에만(쿼리 캐시에 없음), 카드 인쇄', async () => {
    const user = userEvent.setup()
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const { client } = renderAt('/admin/classes/12/students')
    await rosterTable()

    const regen = screen.getByRole('button', { name: '개인 코드 재발급' })
    expect(regen).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: '김민준 선택' }))
    await user.click(screen.getByRole('checkbox', { name: '이서연 선택' }))
    expect(screen.getByText('선택 2명')).toBeInTheDocument()
    await user.click(regen)
    expect(sent).toEqual([])
    // 확인 중에는 전체 선택을 숨긴다
    expect(screen.queryByRole('button', { name: '재원 전체 선택' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '2명 재발급' }))

    const result = await screen.findByRole('table', { name: '개인 코드' })
    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/api/v1/admin/classes/12/students/personal-codes/regenerate',
        body: { studentIds: [301, 302] },
      },
    ])
    const rows = within(result).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/^김민준\d{4}$/),
      expect.stringMatching(/^이서연\d{4}$/),
    ])
    expect(screen.getByRole('heading', { name: '재발급 결과 2명' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(
      '이 화면을 떠나면 개인 코드를 다시 볼 수 없음',
    )
    expect(screen.getByText('선택 0명')).toBeInTheDocument()

    // 평문 코드가 쿼리 캐시에 남지 않는다
    const code = rows[0].textContent!.slice(-4)
    const cached = JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((q) => q.state.data),
    )
    expect(cached).not.toContain(code)
    expect(client.getMutationCache().getAll()).toHaveLength(0)

    // 인쇄용 카드: body 바로 아래, 가입 코드 + 개인 코드
    const cards = document.body.querySelectorAll(':scope > [aria-hidden="true"] > div')
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveTextContent('겨울 그린 A반')
    expect(cards[0]).toHaveTextContent('G7KM2XP4')
    expect(cards[0]).toHaveTextContent(code)
    expect(cards[0]).toHaveTextContent('그린 · 겨울')
    const boxes = cards[0].querySelectorAll('dl > div')
    expect([...boxes].map((d) => d.textContent)).toEqual(['가입 코드G7KM2XP4', `개인 코드${code}`])
    // QR(#38): 라이브러리를 불러온 뒤 인쇄할 수 있고, 카드마다 그 학생의 S-01 주소(# 뒤 두 코드)
    const printButton = screen.getByRole('button', { name: '카드 인쇄' })
    await waitFor(() => expect(printButton).toBeEnabled())
    expect(cards[0]).toHaveTextContent('폰 카메라로 찍어요')
    const qrOf = (card: Element) => card.querySelector('svg path')?.getAttribute('d')
    expect(qrOf(cards[0])).toBe(qrPath(`${window.location.origin}/join#c=G7KM2XP4&p=${code}`))
    const code2 = rows[1].textContent!.slice(-4)
    expect(qrOf(cards[1])).toBe(qrPath(`${window.location.origin}/join#c=G7KM2XP4&p=${code2}`))
    await user.click(printButton)
    expect(print).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /닫기/ })).not.toBeInTheDocument()

    // 퇴원 칸을 열기만 하면 남고, 처리가 끝나면 결과 상자와 인쇄 카드가 사라진다
    await user.click(screen.getByRole('button', { name: '박지호 퇴원' }))
    expect(screen.getByRole('heading', { name: '재발급 결과 2명' })).toBeInTheDocument()
    const panel = screen.getByRole('region', { name: '박지호 퇴원' })
    await user.click(within(panel).getByRole('button', { name: '퇴원' }))
    expect(await screen.findByRole('status')).toHaveTextContent('박지호 퇴원 처리함')
    expect(screen.queryByRole('heading', { name: '재발급 결과 2명' })).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(code)
  })

  it('재발급 확인에서 취소하면 보내지 않는다', async () => {
    const user = userEvent.setup()
    renderAt('/admin/classes/12/students')
    await rosterTable()

    await user.click(screen.getByRole('checkbox', { name: '김민준 선택' }))
    await user.click(screen.getByRole('button', { name: '개인 코드 재발급' }))
    await user.click(screen.getByRole('button', { name: '취소' }))

    expect(screen.getByRole('button', { name: '개인 코드 재발급' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '재원 전체 선택' })).toBeInTheDocument()
    expect(sent).toEqual([])
  })

  it('재원 전체 선택 ↔ 선택 해제', async () => {
    const user = userEvent.setup()
    renderAt('/admin/classes/12/students')
    await rosterTable()

    await user.click(screen.getByRole('button', { name: '재원 전체 선택' }))
    expect(screen.getByText('선택 18명')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '선택 해제' }))
    expect(screen.getByText('선택 0명')).toBeInTheDocument()
  })

  it('퇴원: 확인 칸에서 한 번 더 → PATCH status inactive, 명단 갱신', async () => {
    const user = userEvent.setup()
    renderAt('/admin/classes/12/students')
    await rosterTable()

    await user.click(screen.getByRole('button', { name: '김민준 퇴원' }))
    const panel = screen.getByRole('region', { name: '김민준 퇴원' })
    expect(panel).toHaveTextContent('퇴원하면 이 학생은 들어올 수 없음')
    await user.click(within(panel).getByRole('button', { name: '퇴원' }))

    expect(await screen.findByRole('status')).toHaveTextContent('김민준 퇴원 처리함')
    expect(sent).toEqual([
      { method: 'PATCH', path: '/api/v1/admin/students/301', body: { status: 'inactive' } },
    ])
    expect(await screen.findByText('재원 17명 · 퇴원 2명')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '김민준 퇴원' })).not.toBeInTheDocument()
  })

  it('복귀: PATCH status active', async () => {
    const user = userEvent.setup()
    renderAt('/admin/classes/12/students')
    await rosterTable()

    await user.click(screen.getByRole('button', { name: `${STUDENT_MOCK.inactiveName} 복귀` }))
    const panel = screen.getByRole('region', { name: `${STUDENT_MOCK.inactiveName} 복귀` })
    await user.click(within(panel).getByRole('button', { name: '복귀' }))

    expect(await screen.findByText('재원 19명')).toBeInTheDocument()
    expect(sent).toEqual([
      { method: 'PATCH', path: '/api/v1/admin/students/330', body: { status: 'active' } },
    ])
  })

  it('반 이동: 운영 중인 다른 반만 고를 수 있고, 옮기면 이 반 명단에서 빠진다', async () => {
    const user = userEvent.setup()
    renderAt('/admin/classes/12/students')
    await rosterTable()

    await user.click(screen.getByRole('button', { name: '이서연 반 이동' }))
    const panel = screen.getByRole('region', { name: '이서연 반 이동' })
    const move = within(panel).getByRole('button', { name: '반 이동' })
    expect(move).toBeDisabled()
    const select = within(panel).getByRole('combobox', { name: '옮길 반' })
    await within(panel).findByRole('option', { name: '겨울 그린 B반' })
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['반 고르기', '겨울 그린 B반'])
    await user.selectOptions(select, '13')
    await user.click(move)

    expect(await screen.findByRole('status')).toHaveTextContent('이서연 → 겨울 그린 B반 이동함')
    expect(sent).toEqual([
      { method: 'POST', path: '/api/v1/admin/students/302/move', body: { toClassId: 13 } },
    ])
    expect(await screen.findByText('재원 17명 · 퇴원 1명')).toBeInTheDocument()
    expect(
      within(await rosterTable()).queryByRole('row', { name: /이서연/ }),
    ).not.toBeInTheDocument()
  })
})

describe('A-02 학생 추가', () => {
  it('빈 줄은 빼고 보내고, 결과 코드를 보이고, 명단으로 가면 코드는 사라진다', async () => {
    const user = userEvent.setup()
    renderAt('/admin/classes/12/students/new')
    await screen.findByRole('heading', { name: '겨울 그린 A반 학생 추가' })

    const row1 = screen.getByRole('group', { name: '1번 학생' })
    const row3 = screen.getByRole('group', { name: '3번 학생' })
    await user.type(within(row1).getByRole('textbox', { name: '이름' }), ' 새학생 ')
    await user.type(within(row1).getByRole('textbox', { name: '학교' }), 'D중')
    await user.type(within(row3).getByRole('textbox', { name: '3번 학생 이름' }), '둘째')
    await user.type(within(row3).getByRole('textbox', { name: '3번 학생 학년' }), '중2')
    await user.click(screen.getByRole('button', { name: '2명 등록' }))

    const result = await screen.findByRole('table', { name: '개인 코드' })
    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/api/v1/admin/classes/12/students',
        body: {
          students: [
            { name: '새학생', school: 'D중' },
            { name: '둘째', grade: '중2' },
          ],
        },
      },
    ])
    expect(screen.getByRole('heading', { name: '등록 결과 2명' })).toBeInTheDocument()
    const code = within(result).getAllByRole('row')[1].textContent!.slice(-4)
    expect(code).toMatch(/^\d{4}$/)

    await user.click(screen.getByRole('link', { name: '학생 명단으로' }))
    const table = await rosterTable()
    expect(within(table).getByRole('row', { name: /새학생/ })).toBeInTheDocument()
    expect(screen.getByText('재원 20명 · 퇴원 1명')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(code)
  })

  it('모두 비어 있으면 보내지 않고 안내', async () => {
    const user = userEvent.setup()
    renderAt('/admin/classes/12/students/new')
    await screen.findByRole('heading', { name: '겨울 그린 A반 학생 추가' })

    await user.click(screen.getByRole('button', { name: '등록' }))
    expect(screen.getByRole('alert')).toHaveTextContent('학생 이름을 하나 이상 입력')
    expect(sent).toEqual([])
  })

  it('서버 칸 오류(students[i].name)는 보낸 줄 기준으로 그 줄 이름 칸에', async () => {
    const user = userEvent.setup()
    renderAt('/admin/classes/12/students/new')
    await screen.findByRole('heading', { name: '겨울 그린 A반 학생 추가' })

    // 1번 줄은 비워 두고(안 보냄) 2번 줄에 서버가 거절하는 이름 → 오류 i = 0 이 2번 줄로 가야 한다
    const row1 = screen.getByRole('group', { name: '1번 학생' })
    const row2 = screen.getByRole('group', { name: '2번 학생' })
    await user.type(
      within(row2).getByRole('textbox', { name: '2번 학생 이름' }),
      STUDENT_MOCK.invalidName,
    )
    await user.click(screen.getByRole('button', { name: '1명 등록' }))

    const name2 = within(row2).getByRole('textbox', { name: '2번 학생 이름' })
    expect(await within(row2).findByText('이름은 1~30자')).toBeInTheDocument()
    expect(name2).toHaveAttribute('aria-invalid', 'true')
    expect(within(row1).getByRole('textbox', { name: '이름' })).not.toHaveAttribute(
      'aria-invalid',
      'true',
    )
    // 칸 옆에 보였으니 폼 아래 일반 오류는 없다
    expect(screen.queryByText('입력값을 확인해 주세요')).not.toBeInTheDocument()
  })

  it('줄 추가·지우기 — 마지막 한 줄은 지울 수 없다', async () => {
    const user = userEvent.setup()
    renderAt('/admin/classes/12/students/new')
    await screen.findByRole('heading', { name: '겨울 그린 A반 학생 추가' })

    // 보이는 라벨은 첫 줄에만(2번 줄부터는 읽는 이름만)
    const visibleLabels = () =>
      [...document.querySelectorAll('form label')]
        .filter((l) => !/srOnly/.test(l.className))
        .map((l) => l.textContent)
    expect(visibleLabels()).toEqual(['이름', '학교', '학년'])

    await user.click(screen.getByRole('button', { name: '줄 추가' }))
    expect(screen.getAllByRole('group', { name: /번 학생$/ })).toHaveLength(4)
    expect(screen.getByRole('textbox', { name: '4번 학생 학교' })).toBeInTheDocument()
    for (const n of [4, 3, 2])
      await user.click(screen.getByRole('button', { name: `${n}번 줄 지우기` }))
    expect(screen.getAllByRole('group', { name: /번 학생$/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: '1번 줄 지우기' })).toBeDisabled()
    expect(visibleLabels()).toEqual(['이름', '학교', '학년'])
  })
})

describe('A-04 학원 현황', () => {
  it('오늘 접속 학생 수, 반별 현재 회차·완료율(서버 값 그대로 %)', async () => {
    renderAt('/admin/dashboard')
    const table = await screen.findByRole('table', { name: '반별 완료율' })

    expect(screen.getByText('오늘 접속 학생 12명')).toBeInTheDocument()
    const a = within(table).getByRole('row', { name: /겨울 그린 A반/ })
    expect(a).toHaveTextContent('Reading Day 5 · 2026-12-19')
    // 칸 글자 전체가 같아야 한다(0.64%도 '64%'를 품는다)
    expect(within(a).getByRole('cell', { name: '64%' })).toBeInTheDocument()
    expect(within(a).getByRole('link', { name: '겨울 그린 A반' })).toHaveAttribute(
      'href',
      '/admin/classes/12',
    )
    const b = within(table).getByRole('row', { name: /겨울 그린 B반/ })
    expect(b).toHaveTextContent('수업 전')
    expect(within(b).getByRole('cell', { name: '0%' })).toBeInTheDocument()
  })

  it('교사는 학생 관리·현황 주소로 들어와도 안내만', async () => {
    setMockSession('teacher')
    renderAt('/admin/dashboard')
    expect(await screen.findByRole('alert')).toHaveTextContent('관리자만 볼 수 있는 화면입니다')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
