import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import QRCode from 'qrcode'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { resetAdminMock } from '../../mocks/adminData'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { resetTeacherMock, TEACHER_MOCK } from '../../mocks/teacherData'
import { renderRoutes } from '../../test/render'

// T-02 반 목록·T-03 청취 현황 매트릭스(03 §4.1·§4.2, 계약 전 목).
// 목 서버의 오늘은 12/19(토) — 겨울 그린 A반 5회가 지금 회차, 6회부터 수업 전

let matrixUrls: string[]

beforeEach(() => {
  resetAuthMock()
  resetAdminMock()
  resetTeacherMock()
  setMockSession('admin')
  matrixUrls = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname.endsWith('/matrix')) matrixUrls.push(url.pathname + url.search)
  })
})

afterEach(() => {
  server.events.removeAllListeners()
})

function renderAt(path: string) {
  return renderRoutes(routes, { initialEntries: [path] })
}

const card = async (name: string) => {
  const link = await screen.findByRole('link', { name })
  return link.closest('section') as HTMLElement
}

describe('T-02 반 목록', () => {
  it('반 카드에 지금 회차·완료/진행/미시작·밀린 학생·다음 수업을 서버 값 그대로', async () => {
    renderAt('/teacher')
    expect(await screen.findByRole('heading', { name: '반 목록', level: 1 })).toBeInTheDocument()

    const a = await card('겨울 그린 A반')
    expect(within(a).getByRole('link', { name: '겨울 그린 A반' })).toHaveAttribute(
      'href',
      '/teacher/classes/12',
    )
    expect(a).toHaveTextContent('그린 · 겨울')
    expect(a).toHaveTextContent('학생 18명')
    expect(a).toHaveTextContent('현재 Reading Day 5 · 12/19 (토)')
    expect(a).toHaveTextContent('완료 11 · 진행 중 4 · 미시작 3')
    expect(a).toHaveTextContent('밀린 학생 4명')
    expect(a).toHaveTextContent('다음 수업 12/22 (화)')
    expect(a).not.toHaveTextContent('개인 코드 입력 실패')
    expect(screen.getByText('반 2개')).toBeInTheDocument()
  })

  it('로그인 실패 경고(한국 시간)와 밀린 학생 없음', async () => {
    renderAt('/teacher')
    const b = await card('겨울 그린 B반')
    expect(b).toHaveTextContent(
      `개인 코드 입력 실패 ${TEACHER_MOCK.alertFailures}회 · 12/19 19:12부터`,
    )
    expect(b).toHaveTextContent('밀린 학생 없음')
  })

  it('카드에 서버 레벨 색을 --level로', async () => {
    renderAt('/teacher')
    const a = await card('겨울 그린 A반')
    expect(a.style.getPropertyValue('--level')).toBe('#1F7A4F')
    expect(a).toHaveAttribute('data-level')
  })

  it('교사는 담당 반만(서버가 거름)', async () => {
    resetAuthMock()
    setMockSession('teacher')
    renderAt('/teacher')
    expect(await screen.findByText('반 1개')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '겨울 그린 B반' })).not.toBeInTheDocument()
  })

  it('수업 전·다음 수업 없음·담당 반 없음', async () => {
    server.use(
      http.get('*/api/v1/teacher/classes', () =>
        HttpResponse.json({
          items: [
            {
              id: 50,
              name: '봄 민트반',
              level: { code: 'L1', nameKo: '민트', colorHex: 'nope' },
              book: { code: 'L1-B2', label: 'Book 2', season: '봄' },
              studentCount: 0,
              current: null,
              overdueStudents: 0,
              loginAlert: null,
              next: null,
            },
          ],
        }),
      ),
    )
    renderAt('/teacher')
    const c = await card('봄 민트반')
    expect(c).toHaveTextContent('수업 전')
    expect(c).toHaveTextContent('다음 수업 없음')
    // #RRGGBB가 아니면 넣지 않는다
    expect(c).not.toHaveAttribute('data-level')
  })

  it('반이 없으면 안내', async () => {
    server.use(http.get('*/api/v1/teacher/classes', () => HttpResponse.json({ items: [] })))
    renderAt('/teacher')
    expect(await screen.findByText('담당 반이 없습니다')).toBeInTheDocument()
  })

  it('못 받으면(5xx) 문구와 다시 시도', async () => {
    server.use(
      http.get('*/api/v1/teacher/classes', () =>
        HttpResponse.json(
          { title: '잠시 뒤에 다시 시도해 주세요', status: 503, code: 'UNAVAILABLE' },
          { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderAt('/teacher')
    expect(await screen.findByRole('alert')).toHaveTextContent('잠시 뒤에 다시 시도해 주세요')
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })
})

const matrixTable = () => screen.findByRole('table', { name: '학생별 회차 청취 현황' })

/** 낭독 글자로 칸을 찾고, 그 칸의 보이는 상태를 돌려준다 */
function pill(label: string) {
  const sr = screen.getByText(label)
  return sr.parentElement as HTMLElement
}

// 반 입장 QR·링크(#71, BE #52·#53) — 교실 화면에 크게 띄우거나 단톡방에 링크를 올린다. 주소는 # 뒤 가입 코드만
describe('T-02 반 입장 QR·링크', () => {
  function qrPath(text: string): string {
    const modules = QRCode.create(text, { errorCorrectionLevel: 'M' }).modules
    let d = ''
    for (let row = 0; row < modules.size; row++)
      for (let col = 0; col < modules.size; col++)
        if (modules.get(row, col)) d += `M${col + 2},${row + 2}h1v1h-1z`
    return d
  }
  const joinUrl = (code: string) => `${window.location.origin}/join#c=${code}`

  it('"입장 QR" → 전체 화면 창: 반 이름·그 반 가입 코드 QR·코드 글자(이름 없이)·안내, 포커스는 닫기', async () => {
    renderAt('/teacher')
    const user = userEvent.setup()
    const a = await card('겨울 그린 A반')

    await user.click(within(a).getByRole('button', { name: '겨울 그린 A반 입장 QR' }))

    const dialog = screen.getByRole('dialog', { name: '겨울 그린 A반 입장 QR' })
    const qr = await within(dialog).findByRole('img', { name: '겨울 그린 A반 입장 QR 코드' })
    expect(qr.querySelector('path')?.getAttribute('d')).toBe(qrPath(joinUrl('G7KM2XP4')))
    // 간단하게 "가입 코드" 이름은 빼고 코드 글자만 — QR을 못 읽으면 보고 친다(동섭 11/14)
    expect(dialog).not.toHaveTextContent('가입 코드')
    expect(within(dialog).getByText('G7KM 2XP4')).toBeInTheDocument()
    expect(dialog).toHaveTextContent('폰 카메라로 찍고 개인 코드 4자리를 입력해요')
    expect(within(dialog).getByRole('button', { name: '닫기' })).toHaveFocus()
  })

  it('반마다 그 반 가입 코드로', async () => {
    renderAt('/teacher')
    const user = userEvent.setup()
    const b = await card('겨울 그린 B반')

    await user.click(within(b).getByRole('button', { name: '겨울 그린 B반 입장 QR' }))

    const qr = await screen.findByRole('img', { name: '겨울 그린 B반 입장 QR 코드' })
    expect(qr.querySelector('path')?.getAttribute('d')).toBe(qrPath(joinUrl('H4PN8RT2')))
  })

  it('Esc·닫기로 닫히고 포커스는 연 버튼으로 돌아간다', async () => {
    renderAt('/teacher')
    const user = userEvent.setup()
    const a = await card('겨울 그린 A반')
    const open = within(a).getByRole('button', { name: '겨울 그린 A반 입장 QR' })

    await user.click(open)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(open).toHaveFocus()

    await user.click(open)
    await user.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(open).toHaveFocus()
  })

  it('Tab은 창 안에서만 돈다', async () => {
    renderAt('/teacher')
    const user = userEvent.setup()
    const a = await card('겨울 그린 A반')
    await user.click(within(a).getByRole('button', { name: '겨울 그린 A반 입장 QR' }))
    const close = screen.getByRole('button', { name: '닫기' })

    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(close).toHaveFocus()
  })

  it('"입장 링크 복사" → 클립보드에 # 뒤 가입 코드만 실은 주소, "링크를 복사함"', async () => {
    renderAt('/teacher')
    const user = userEvent.setup()
    const a = await card('겨울 그린 A반')

    await user.click(within(a).getByRole('button', { name: '겨울 그린 A반 입장 링크 복사' }))

    expect(await navigator.clipboard.readText()).toBe(joinUrl('G7KM2XP4'))
    expect(within(a).getByRole('status')).toHaveTextContent('링크를 복사함')
  })

  it('복사하지 못하면 링크를 글자로 보여 준다(직접 복사)', async () => {
    renderAt('/teacher')
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
    const a = await card('겨울 그린 A반')

    await user.click(within(a).getByRole('button', { name: '겨울 그린 A반 입장 링크 복사' }))

    expect(await within(a).findByRole('status')).toHaveTextContent(
      `복사하지 못함 — ${joinUrl('G7KM2XP4')}`,
    )
  })
})

describe('T-03 청취 현황 매트릭스', () => {
  it('처음에는 범위 없이 요청하고, 서버가 고른 묶음(겨울 1)을 보인다', async () => {
    renderAt('/teacher/classes/12')
    const table = await matrixTable()

    expect(matrixUrls).toEqual(['/api/v1/teacher/classes/12/matrix'])
    expect(await screen.findByRole('button', { name: /겨울 1/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /겨울 2/ })).toHaveAttribute('aria-pressed', 'false')

    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent)
    expect(headers[0]).toBe('학생')
    expect(headers.slice(1)).toEqual([
      'Day 1 12/10',
      'Day 2 12/12',
      'Day 3 12/15',
      'Day 4 12/17',
      'Day 5 12/19 지금 회차',
      'Day 6 12/22',
      'Day 7 12/24',
      'Day 8 12/26',
    ])
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 18)
    // 지금 회차 열만 배경 강조(서버 isCurrent)
    const heads = within(table).getAllByRole('columnheader')
    expect(heads[5].className).toMatch(/current/)
    expect(heads.filter((h) => /current/.test(h.className))).toHaveLength(1)
  })

  it('머리글: 반 이름·레벨·학생 수와 지금 회차 요약(4.1 값)', async () => {
    renderAt('/teacher/classes/12')
    expect(
      await screen.findByRole('heading', { name: '겨울 그린 A반 청취 현황', level: 1 }),
    ).toBeInTheDocument()
    const summary = screen.getByRole('list', { name: '지금 회차 요약' })
    expect(summary).toHaveTextContent('현재 Reading Day 5 · 12/19 (토)')
    expect(summary).toHaveTextContent('완료 11 / 18')
    expect(summary).toHaveTextContent('진행 중 4')
    expect(summary).toHaveTextContent('미시작 3')
    expect(summary).toHaveTextContent('밀린 학생 4명')
    expect(screen.getByRole('link', { name: '← 반 목록' })).toHaveAttribute('href', '/teacher')
  })

  it('칸: 완료 ✓ · 진행 n/m · 미시작 — · 밀림 · 수업 전 — 낭독은 학생·회차·상태', async () => {
    renderAt('/teacher/classes/12')
    await matrixTable()

    const done = pill('김민준 Reading Day 1 완료')
    expect(done).toHaveAttribute('data-status', 'completed')

    const progress = pill('박지호 Reading Day 5 진행 중 3 / 6')
    expect(progress).toHaveAttribute('data-status', 'in_progress')
    expect(progress).toHaveTextContent('3/6')

    const none = pill('오서윤 Reading Day 5 미시작')
    expect(none).toHaveAttribute('data-status', 'open')
    expect(none).toHaveTextContent('—')

    const late = pill('이서연 Reading Day 2 밀림, 진행 중 4 / 6')
    expect(late).toHaveAttribute('data-status', 'overdue')
    expect(late).toHaveTextContent('밀림')
    expect(pill('최하은 Reading Day 3 밀림, 미시작')).toHaveAttribute('data-status', 'overdue')

    const before = pill('김민준 Reading Day 6 수업 전')
    expect(before).toHaveAttribute('data-status', 'locked')
    // 지금 회차(5회)는 진행 중이어도 밀림이 아니다(서버 overdue 없음)
    expect(pill('강수아 Reading Day 5 진행 중 1 / 6')).toHaveAttribute('data-status', 'in_progress')
  })

  it('서버 기본 범위가 9회부터면 겨울 2 탭이 눌린 상태', async () => {
    server.use(
      http.get('*/api/v1/teacher/classes/:classId/matrix', () =>
        HttpResponse.json({
          sessions: [
            {
              seq: 9,
              lesson: { code: 'L2-B1-09', number: 9, title: 'Reading Day 9' },
              scheduledDate: '2026-12-29',
              status: 'scheduled',
              isCurrent: true,
              opened: true,
            },
          ],
          students: [],
          cells: {},
        }),
      ),
    )
    renderAt('/teacher/classes/12')
    await matrixTable()
    expect(await screen.findByRole('button', { name: /겨울 2/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /겨울 1/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('묶음 탭을 누르면 그 범위(9~16회)를 요청한다', async () => {
    const user = userEvent.setup()
    renderAt('/teacher/classes/12')
    await matrixTable()

    await user.click(await screen.findByRole('button', { name: /겨울 2/ }))
    expect(await screen.findByText('Day 9')).toBeInTheDocument()
    expect(matrixUrls).toContain('/api/v1/teacher/classes/12/matrix?fromSeq=9&toSeq=16')
    expect(screen.getByRole('button', { name: /겨울 2/ })).toHaveAttribute('aria-pressed', 'true')
    expect(pill('김민준 Reading Day 9 수업 전')).toHaveAttribute('data-status', 'locked')
  })

  it('수업 전은 날짜가 아니라 서버 opened로, 미시작은 서버 칸 그대로', async () => {
    server.use(
      http.get('*/api/v1/teacher/classes/:classId/matrix', () =>
        HttpResponse.json({
          class: {
            id: 12,
            name: '겨울 그린 A반',
            level: { code: 'L2', nameKo: '그린', colorHex: '#1F7A4F' },
          },
          // 날짜는 일부러 반대로 — 지난 날짜여도 opened=false면 수업 전, 먼 날짜여도 opened=true면 열림
          sessions: [
            {
              seq: 1,
              lesson: { code: 'L2-B1-01', number: 1, title: 'Reading Day 1' },
              scheduledDate: '2030-01-01',
              status: 'scheduled',
              isCurrent: true,
              opened: true,
            },
            {
              seq: 2,
              lesson: { code: 'L2-B1-02', number: 2, title: 'Reading Day 2' },
              scheduledDate: '2020-01-05',
              status: 'scheduled',
              isCurrent: false,
              opened: false,
            },
          ],
          students: [{ id: 301, name: '김민준', school: null, grade: null }],
          // 열린 회차는 칸이 항상 온다(BE #28), 열리지 않은 회차는 칸이 없다
          cells: {
            '301': {
              'L2-B1-01': {
                status: 'not_started',
                requiredDone: 0,
                requiredTotal: 6,
                completedAt: null,
                overdue: false,
              },
            },
          },
        }),
      ),
    )
    renderAt('/teacher/classes/12')
    await matrixTable()

    expect(pill('김민준 Reading Day 1 미시작')).toHaveAttribute('data-status', 'open')
    expect(pill('김민준 Reading Day 2 수업 전')).toHaveAttribute('data-status', 'locked')
  })

  it('오늘 수업이 없는 날: 지금 회차가 지난 수업(done)이어도 지금 회차 강조·칸은 서버 값 그대로', async () => {
    // BE #46 — 오늘 수업이 없으면 가장 최근 지난 수업이 isCurrent이고 status는 done
    server.use(
      http.get('*/api/v1/teacher/classes/:classId/matrix', () =>
        HttpResponse.json({
          class: {
            id: 12,
            name: '겨울 그린 A반',
            level: { code: 'L2', nameKo: '그린', colorHex: '#1F7A4F' },
          },
          sessions: [
            {
              seq: 1,
              lesson: { code: 'L2-B1-01', number: 1, title: 'Reading Day 1' },
              scheduledDate: '2026-12-10',
              status: 'done',
              isCurrent: false,
              opened: true,
            },
            {
              seq: 2,
              lesson: { code: 'L2-B1-02', number: 2, title: 'Reading Day 2' },
              scheduledDate: '2026-12-12',
              status: 'done',
              isCurrent: true,
              opened: true,
            },
          ],
          students: [{ id: 301, name: '김민준', school: null, grade: null }],
          cells: {
            '301': {
              'L2-B1-01': {
                status: 'completed',
                requiredDone: 6,
                requiredTotal: 6,
                completedAt: '2026-12-10T09:00:00Z',
                overdue: false,
              },
              'L2-B1-02': {
                status: 'in_progress',
                requiredDone: 2,
                requiredTotal: 6,
                completedAt: null,
                overdue: false,
              },
            },
          },
        }),
      ),
    )
    renderAt('/teacher/classes/12')
    const table = await matrixTable()

    const heads = within(table).getAllByRole('columnheader')
    expect(heads.map((h) => h.textContent)).toEqual([
      '학생',
      'Day 1 12/10',
      'Day 2 12/12 지금 회차',
    ])
    expect(heads.filter((h) => /current/.test(h.className))).toEqual([heads[2]])
    expect(pill('김민준 Reading Day 1 완료')).toHaveAttribute('data-status', 'completed')
    expect(pill('김민준 Reading Day 2 진행 중 2 / 6')).toHaveAttribute('data-status', 'in_progress')
  })

  it('학생이 없으면 안내', async () => {
    renderAt(`/teacher/classes/${TEACHER_MOCK.alertClassId}`)
    const table = await matrixTable()
    expect(within(table).getByText('학생이 없습니다')).toBeInTheDocument()
  })

  it('담당이 아닌 반이면 서버 문구(403)를 보이고 다시 시도는 없다', async () => {
    resetAuthMock()
    setMockSession('teacher')
    renderAt(`/teacher/classes/${TEACHER_MOCK.alertClassId}`)
    expect(await screen.findByRole('alert')).toHaveTextContent('담당 반이 아닙니다')
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })
})
