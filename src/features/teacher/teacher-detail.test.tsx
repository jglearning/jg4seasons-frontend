import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { resetAdminMock } from '../../mocks/adminData'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { resetTeacherMock } from '../../mocks/teacherData'
import { renderRoutes } from '../../test/render'

// T-04 학생 상세·T-05 회차 상세·T-06 진도표(03 §4.3~§4.8, BE #28 계약의 목).
// 목 서버의 오늘은 12/19(토) — 겨울 그린 A반(12)은 화·목·토 수업, 5회(12/19)가 지금 회차

let sent: Array<{ method: string; path: string; body: unknown }>

beforeEach(() => {
  resetAuthMock()
  resetAdminMock()
  resetTeacherMock()
  setMockSession('teacher')
  sent = []
  server.events.on('request:start', async ({ request }) => {
    const path = new URL(request.url).pathname
    if (!path.startsWith('/api/v1/teacher') || request.method === 'GET') return
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

describe('T-03에서 들어가는 길', () => {
  it('학생 이름 → T-04, 회차 머리글 → T-05, 진도표 → T-06', async () => {
    renderAt('/teacher/classes/12')
    const table = await screen.findByRole('table', { name: '학생별 회차 청취 현황' })
    expect(within(table).getByRole('link', { name: '김민준' })).toHaveAttribute(
      'href',
      '/teacher/classes/12/students/301',
    )
    expect(within(table).getByRole('link', { name: /^Day 5 / })).toHaveAttribute(
      'href',
      '/teacher/classes/12/lessons/L2-B1-05',
    )
    expect(screen.getByRole('link', { name: '진도표' })).toHaveAttribute(
      'href',
      '/teacher/classes/12/sessions',
    )
  })

  it('반 카드에도 진도표 링크', async () => {
    renderAt('/teacher')
    expect(await screen.findByRole('link', { name: '겨울 그린 A반 진도표' })).toHaveAttribute(
      'href',
      '/teacher/classes/12/sessions',
    )
  })
})

describe('T-04 학생 상세', () => {
  it('머리글: 이름·학교·학년·마지막 로그인(한국 시간)', async () => {
    renderAt('/teacher/classes/12/students/301')
    expect(await screen.findByRole('heading', { name: '김민준', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('A중 · 중1 · 마지막 로그인 11/6 18:00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← 겨울 그린 A반 청취 현황' })).toHaveAttribute(
      'href',
      '/teacher/classes/12',
    )
  })

  it('회차마다 지문 표: 서버 값 그대로(들은 구간·재생/길이·재생 횟수·마지막 청취), 목소리는 들은 것만', async () => {
    renderAt('/teacher/classes/12/students/301')
    const headings = await screen.findAllByRole('heading', { level: 2 })
    // 서버가 준 순서(최근 먼저)
    expect(headings.map((h) => h.textContent)).toEqual([
      'Reading Day 5',
      'Reading Day 4',
      'Reading Day 3',
      'Reading Day 2',
      'Reading Day 1',
    ])

    const table = screen.getByRole('table', { name: 'Reading Day 5 지문 청취' })
    const rows = within(table).getAllByRole('row').slice(1)
    // 목소리 4개 × 지문 6 = 24 트랙 중 들은 것만: 지문 1(미국 여·영국 남), 지문 2(미국 남·미국 여), 지문 3~6(미국 여)
    expect(rows).toHaveLength(8)
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual([
      '지문 1 · 미국 여',
      '지문 1 · 영국 남',
      '지문 2 · 미국 여',
      '지문 2 · 미국 남',
      '지문 3 · 미국 여',
      '지문 4 · 미국 여',
      '지문 5 · 미국 여',
      '지문 6 · 미국 여',
    ])
    // 모두 필수라 필수 칸은 없다
    expect(within(table).queryByRole('columnheader', { name: '필수' })).not.toBeInTheDocument()
    const first = rows[0]
    expect(first).toHaveTextContent('91%')
    expect(first).toHaveTextContent('완료')
    expect(first).toHaveTextContent('1:06 / 1:03')
    expect(first).toHaveTextContent('1회')
    expect(first).toHaveTextContent('12/19 21:10')
    expect(rows[1]).toHaveTextContent('35%')
    expect(rows[1]).not.toHaveTextContent('완료')

    expect(
      screen.getAllByText('단어 카드 57 / 57 · 알아요 40 · 리콜 최고 51 · 스펠 최고 33')[0],
    ).toBeInTheDocument()
  })

  it('진행 중 회차: 상태 알약 n / m, 하나도 안 들은 지문은 "안 들음" 한 줄', async () => {
    renderAt('/teacher/classes/12/students/303')
    const table = await screen.findByRole('table', { name: 'Reading Day 5 지문 청취' })
    const card = table.closest('section') as HTMLElement
    expect(within(card).getByText('진행 중 3 / 6')).toHaveAttribute('data-status', 'in_progress')
    const fourth = within(table).getByRole('row', { name: /지문 4 · 미국 여/ })
    expect(fourth).toHaveTextContent('40%')
    expect(fourth).not.toHaveTextContent('완료')
    const fifth = within(table).getByRole('row', { name: /지문 5 · 안 들음/ })
    expect(fifth).not.toHaveTextContent('0%')
    expect(within(table).queryByRole('row', { name: /지문 5 · 미국/ })).not.toBeInTheDocument()
    // 지문 2는 미국 남으로 완료, 미국 여는 절반
    expect(within(table).getByRole('row', { name: /지문 2 · 미국 남/ })).toHaveTextContent('완료')
    expect(within(table).getByRole('row', { name: /지문 2 · 미국 여/ })).toHaveTextContent('50%')
    expect(screen.getAllByText(/^단어 카드 20 \/ 57 · /)[0]).toBeInTheDocument()
  })

  it('개인 코드 재발급: 확인 → 요청 → 새 코드는 화면에만(쿼리 캐시에 없음)', async () => {
    const user = userEvent.setup()
    const { client } = renderAt('/teacher/classes/12/students/301')
    await user.click(await screen.findByRole('button', { name: '개인 코드 재발급' }))

    const confirm = screen.getByRole('group', { name: '개인 코드 재발급 확인' })
    expect(confirm).toHaveTextContent('재발급하면 지금 개인 코드로는 들어갈 수 없습니다')
    // 확인 칸이 열리면 머리의 재발급 버튼은 숨는다
    expect(screen.queryByRole('button', { name: '개인 코드 재발급' })).not.toBeInTheDocument()
    expect(sent).toEqual([])

    await user.click(within(confirm).getByRole('button', { name: '재발급' }))
    const result = await screen.findByRole('status')
    const code = within(result).getByText(/^\d{4}$/).textContent ?? ''
    expect(result).toHaveTextContent(`김민준 새 개인 코드 ${code}`)
    expect(result).toHaveTextContent('이 화면을 나가면 다시 볼 수 없습니다')
    // 결과 상자가 있어도 재발급 버튼은 상자 안이 아니라 제목과 같은 머리 줄에 다시 보인다
    const again = screen.getByRole('button', { name: '개인 코드 재발급' })
    expect(result).not.toContainElement(again)
    expect(again.parentElement).toContainElement(screen.getByRole('heading', { level: 1 }))
    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/api/v1/teacher/students/301/personal-code/regenerate',
        body: null,
      },
    ])
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain(code)

    await user.click(within(result).getByRole('button', { name: '코드 닫기' }))
    expect(screen.queryByText(code)).not.toBeInTheDocument()
  })

  it('재발급 취소면 요청하지 않는다', async () => {
    const user = userEvent.setup()
    renderAt('/teacher/classes/12/students/301')
    await user.click(await screen.findByRole('button', { name: '개인 코드 재발급' }))
    await user.click(screen.getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('group', { name: '개인 코드 재발급 확인' })).not.toBeInTheDocument()
    expect(sent).toEqual([])
  })
})

describe('T-05 회차 상세', () => {
  it('학생 × 지문 열(목소리 4개를 한 칸에), 칸은 완료 ✓ · 들은 구간 % · 안 들음 —', async () => {
    renderAt('/teacher/classes/12/lessons/L2-B1-05')
    expect(
      await screen.findByRole('heading', { name: 'Reading Day 5', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByText('12/19 (토) 수업 · L2-B1-05')).toBeInTheDocument()

    const table = screen.getByRole('table', { name: 'Reading Day 5 학생별 지문 완료' })
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent)
    expect(headers).toEqual([
      '학생',
      '상태',
      '지문 1',
      '지문 2',
      '지문 3',
      '지문 4',
      '지문 5',
      '지문 6',
    ])

    const pill = (label: string) => within(table).getByText(label).parentElement as HTMLElement
    expect(pill('김민준 지문 1 완료 · 미국 여 91%')).toHaveAttribute('data-status', 'completed')
    // 어느 목소리로든 완료면 ✓ — 더 많이 들은 다른 목소리가 있어도 완료한 목소리를 보인다
    expect(pill('박지호 지문 2 완료 · 미국 남 92%')).toHaveAttribute('data-status', 'completed')
    expect(pill('박지호 지문 3 완료 · 미국 여 93%')).toHaveAttribute('data-status', 'completed')
    const partial = pill('박지호 지문 4 들은 구간 · 미국 여 40%')
    expect(partial).toHaveAttribute('data-status', 'in_progress')
    expect(partial).toHaveTextContent('40%')
    expect(pill('박지호 지문 5 안 들음')).toHaveAttribute('data-status', 'open')

    const row = within(table).getByRole('row', { name: /박지호/ })
    expect(within(row).getByText('진행 중')).toHaveAttribute('data-status', 'in_progress')
    expect(within(row).getByRole('link', { name: '박지호' })).toHaveAttribute(
      'href',
      '/teacher/classes/12/students/303',
    )
  })

  it('수업일이 null이면(진도표에 휴강 행만) 날짜 대신 "수업일 없음"', async () => {
    server.use(
      http.get('*/api/v1/teacher/classes/:classId/lessons/:code', () =>
        HttpResponse.json({
          lesson: { code: 'L2-B1-05', title: 'Reading Day 5', scheduledDate: null },
          tracks: [],
          rows: [],
        }),
      ),
    )
    renderAt('/teacher/classes/12/lessons/L2-B1-05')
    expect(
      await screen.findByRole('heading', { name: 'Reading Day 5', level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getByText('수업일 없음 · L2-B1-05')).toBeInTheDocument()
  })
})

describe('T-06 진도표', () => {
  const table = () => screen.findByRole('table', { name: '진도표' })

  it('24회 목록, 예정만 날짜·휴강, 메모는 모든 행', async () => {
    renderAt('/teacher/classes/12/sessions')
    const t = await table()
    expect(within(t).getAllByRole('row')).toHaveLength(1 + 24)
    expect(
      screen.getByRole('heading', { name: '겨울 그린 A반 진도표', level: 1 }),
    ).toBeInTheDocument()

    const first = within(t).getByRole('row', { name: /^1회/ })
    expect(first).toHaveTextContent('12/10 (목)')
    expect(first).toHaveTextContent('지난 수업')
    expect(within(first).getByRole('button', { name: '1회 메모' })).toBeInTheDocument()
    expect(within(first).queryByRole('button', { name: '1회 휴강' })).not.toBeInTheDocument()

    const fifth = within(t).getByRole('row', { name: /^5회/ })
    expect(fifth).toHaveTextContent('예정')
    expect(within(fifth).getByRole('button', { name: '5회 날짜 바꾸기' })).toBeInTheDocument()
    expect(within(fifth).getByRole('button', { name: '5회 휴강' })).toBeInTheDocument()
    expect(within(fifth).getByRole('button', { name: '5회 메모' })).toBeInTheDocument()
  })

  it('지난 수업이 예정(scheduled)으로 와도 버튼은 status대로, 서버 거절(409 SESSION_PAST) 문구를 보인다', async () => {
    // 실제 서버는 지난 행을 날짜로 판정한다(ADR-30) — 화면은 날짜로 버튼을 숨기지 않는다
    server.use(
      http.get('*/api/v1/teacher/classes/12/sessions', () =>
        HttpResponse.json({
          items: [
            {
              seq: 1,
              lesson: { code: 'L2-B1-01', title: 'Reading Day 1' },
              scheduledDate: '2026-12-10',
              status: 'scheduled',
              note: null,
            },
          ],
        }),
      ),
    )
    const user = userEvent.setup()
    renderAt('/teacher/classes/12/sessions')
    await user.click(within(await table()).getByRole('button', { name: '1회 휴강' }))
    const panel = screen.getByRole('region', { name: '1회 휴강' })
    await user.click(within(panel).getByRole('button', { name: '휴강하기' }))
    expect(await within(panel).findByRole('alert')).toHaveTextContent('지난 수업은 바꿀 수 없어요')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('휴강: 확인 칸 → 요청(shiftFollowing true) → 응답 진도표 그대로(휴강 행 + 뒤로 밀림)', async () => {
    const user = userEvent.setup()
    renderAt('/teacher/classes/12/sessions')
    await user.click(within(await table()).getByRole('button', { name: '5회 휴강' }))

    const panel = screen.getByRole('region', { name: '5회 휴강' })
    // 표 위에 열리므로 제목으로 포커스가 온다(아래 행에서 눌러도 보이게)
    expect(within(panel).getByRole('heading', { name: '5회 휴강' })).toHaveFocus()
    expect(panel).toHaveTextContent('이 회차부터 뒤 수업 날짜가 모두 다음 수업일로 밀립니다')
    await user.type(within(panel).getByLabelText('메모(휴강 이유)'), ' 내신 ')
    await user.click(within(panel).getByRole('button', { name: '휴강하기' }))

    expect(await screen.findByRole('status')).toHaveTextContent('5회(Reading Day 5) 휴강함')
    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/api/v1/teacher/classes/12/sessions/5/cancel',
        body: { note: '내신', shiftFollowing: true },
      },
    ])
    const t = await table()
    expect(within(t).getAllByRole('row')).toHaveLength(1 + 25)
    const cancelled = within(t).getByRole('row', { name: /^5회/ })
    expect(cancelled).toHaveTextContent('휴강')
    expect(cancelled).toHaveTextContent('내신')
    // 휴강 행은 메모만(서버가 휴강 행 메모도 받음)
    expect(
      within(cancelled)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['5회 메모'])
    // 휴강 행은 회색 배경(흐린 행)이고 줄 긋기 없음 — 회차는 다음 행으로 옮겨 갔을 뿐
    expect(cancelled.className).toMatch(/muted/)
    expect(cancelled.querySelector('s, del')).toBeNull()
    const moved = within(t).getByRole('row', { name: /^6회/ })
    expect(moved).not.toHaveAttribute('class')
    expect(moved).toHaveTextContent('12/22 (화)')
    expect(moved).toHaveTextContent('Reading Day 5')
    expect(screen.queryByRole('region', { name: '5회 휴강' })).not.toBeInTheDocument()

    // 매트릭스로 가면 머리글은 회차 번호 — Day 5 열이 밀린 날짜(12/22), 휴강 행은 열이 없다
    await user.click(screen.getByRole('link', { name: '← 겨울 그린 A반 청취 현황' }))
    const matrix = await screen.findByRole('table', { name: '학생별 회차 청취 현황' })
    const headers = within(matrix)
      .getAllByRole('columnheader')
      .map((h) => h.textContent)
    expect(headers.slice(1, 6)).toEqual([
      'Day 1 12/10',
      'Day 2 12/12',
      'Day 3 12/15',
      'Day 4 12/17 지금 회차',
      'Day 5 12/22',
    ])
    // 휴강 행이 seq를 하나 차지해 25행 — 마지막 회차(25)가 든 4번째 묶음 탭이 생긴다
    expect(screen.getByRole('button', { name: /겨울 4/ })).toHaveTextContent('25~32회')
  })

  it('휴강에서 있던 메모를 비우면 빈 글자(메모 없음)로, 그대로면 note를 빼고 보낸다', async () => {
    const user = userEvent.setup()
    renderAt('/teacher/classes/12/sessions')
    await user.click(within(await table()).getByRole('button', { name: '6회 메모' }))
    await user.type(screen.getByLabelText('메모'), '시험 주간')
    await user.click(screen.getByRole('button', { name: '저장' }))
    await screen.findByRole('status')

    await user.click(within(await table()).getByRole('button', { name: '6회 휴강' }))
    const input = screen.getByLabelText('메모(휴강 이유)')
    expect(input).toHaveValue('시험 주간')
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: '휴강하기' }))
    await vi.waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[1]?.body).toEqual({ note: '', shiftFollowing: true })
    await vi.waitFor(() =>
      expect(screen.getByRole('row', { name: /^6회/ })).not.toHaveTextContent('시험 주간'),
    )
  })

  it('휴강 행 메모는 note만 보낸다', async () => {
    const user = userEvent.setup()
    renderAt('/teacher/classes/12/sessions')
    await user.click(within(await table()).getByRole('button', { name: '5회 휴강' }))
    await user.click(screen.getByRole('button', { name: '휴강하기' }))
    await screen.findByRole('status')

    await user.click(within(await table()).getByRole('button', { name: '5회 메모' }))
    await user.type(screen.getByLabelText('메모'), '학교 행사')
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByRole('status')).toHaveTextContent('5회 메모 저장함')
    expect(sent[1]).toEqual({
      method: 'PATCH',
      path: '/api/v1/teacher/classes/12/sessions/5',
      body: { note: '학교 행사' },
    })
    const row = within(await table()).getByRole('row', { name: /^5회/ })
    expect(row).toHaveTextContent('휴강')
    expect(row).toHaveTextContent('학교 행사')
  })

  it('날짜 바꾸기: 이후 수업 밀기 기본 켬, 응답대로 다시 그림', async () => {
    const user = userEvent.setup()
    renderAt('/teacher/classes/12/sessions')
    await user.click(within(await table()).getByRole('button', { name: '6회 날짜 바꾸기' }))

    const panel = screen.getByRole('region', { name: '6회 날짜 바꾸기' })
    expect(within(panel).getByLabelText('이후 수업도 같이 밀기')).toBeChecked()
    fireEvent.change(within(panel).getByLabelText('새 날짜'), { target: { value: '2026-12-23' } })
    await user.click(within(panel).getByRole('button', { name: '저장' }))

    expect(await screen.findByRole('status')).toHaveTextContent('6회 날짜를 12/23 (수)로 바꿈')
    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/api/v1/teacher/classes/12/sessions/6',
        // 메모를 건드리지 않았으면 note를 보내지 않는다("" = 지움이라)
        body: { scheduledDate: '2026-12-23', shiftFollowing: true },
      },
    ])
    const t = await table()
    expect(within(t).getByRole('row', { name: /^6회/ })).toHaveTextContent('12/23 (수)')
    // 뒤 수업은 새 날짜의 다음 수업일(목)부터 차례로 — 서버 규칙(BE #42), 목도 같게
    expect(within(t).getByRole('row', { name: /^7회/ })).toHaveTextContent('12/24 (목)')
  })

  it('밀기를 끄면 shiftFollowing false로 보낸다', async () => {
    const user = userEvent.setup()
    renderAt('/teacher/classes/12/sessions')
    await user.click(within(await table()).getByRole('button', { name: '6회 날짜 바꾸기' }))
    const panel = screen.getByRole('region', { name: '6회 날짜 바꾸기' })
    await user.click(within(panel).getByLabelText('이후 수업도 같이 밀기'))
    fireEvent.change(within(panel).getByLabelText('새 날짜'), { target: { value: '2026-12-23' } })
    await user.click(within(panel).getByRole('button', { name: '저장' }))
    await screen.findByRole('status')
    expect(sent[0]?.body).toEqual({ scheduledDate: '2026-12-23', shiftFollowing: false })
  })

  it('날짜 오류(400 scheduledDate)는 날짜 칸 옆에 하나만 — 패널은 열린 채', async () => {
    const user = userEvent.setup()
    renderAt('/teacher/classes/12/sessions')
    await user.click(within(await table()).getByRole('button', { name: '6회 날짜 바꾸기' }))
    const panel = screen.getByRole('region', { name: '6회 날짜 바꾸기' })
    const input = within(panel).getByLabelText('새 날짜')

    fireEvent.change(input, { target: { value: '2026-12-01' } })
    await user.click(within(panel).getByRole('button', { name: '저장' }))
    expect(await within(panel).findByText('오늘이나 그 뒤 날짜로 골라 주세요')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    // 칸 옆 문구 하나만(폼 아래에 같은 오류를 또 보이지 않음)
    expect(within(panel).getAllByRole('alert')).toHaveLength(1)

    // 앞 수업(5회 12/19)과 같은 날 — 서버는 순서 위반도 scheduledDate 칸 오류로 준다
    fireEvent.change(input, { target: { value: '2026-12-19' } })
    await user.click(within(panel).getByRole('button', { name: '저장' }))
    expect(await within(panel).findByText('앞 수업보다 뒤 날짜로 골라 주세요')).toBeInTheDocument()
    expect(within(panel).getAllByRole('alert')).toHaveLength(1)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('지난 수업 메모 저장은 note만 보낸다', async () => {
    const user = userEvent.setup()
    renderAt('/teacher/classes/12/sessions')
    await user.click(within(await table()).getByRole('button', { name: '2회 메모' }))
    const panel = screen.getByRole('region', { name: '2회 메모' })
    await user.type(within(panel).getByLabelText('메모'), '보강 필요')
    await user.click(within(panel).getByRole('button', { name: '저장' }))
    expect(await screen.findByRole('status')).toHaveTextContent('2회 메모 저장함')
    expect(sent[0]?.body).toEqual({ note: '보강 필요' })
    expect(within(await table()).getByRole('row', { name: /^2회/ })).toHaveTextContent('보강 필요')
  })

  it('메모를 비우고 저장하면 빈 글자로 지운다(null 아님)', async () => {
    const user = userEvent.setup()
    renderAt('/teacher/classes/12/sessions')
    await user.click(within(await table()).getByRole('button', { name: '2회 메모' }))
    await user.type(screen.getByLabelText('메모'), '보강 필요')
    await user.click(screen.getByRole('button', { name: '저장' }))
    await screen.findByRole('status')

    await user.click(within(await table()).getByRole('button', { name: '2회 메모' }))
    const input = screen.getByLabelText('메모')
    expect(input).toHaveValue('보강 필요')
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: '저장' }))
    await vi.waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[1]?.body).toEqual({ note: '' })
    await vi.waitFor(() =>
      expect(screen.getByRole('row', { name: /^2회/ })).not.toHaveTextContent('보강 필요'),
    )
  })

  it('날짜 바꾸기에서 메모를 고치면 note도 같이, 휴강은 메모가 비면 note를 빼고 보낸다', async () => {
    const user = userEvent.setup()
    renderAt('/teacher/classes/12/sessions')
    await user.click(within(await table()).getByRole('button', { name: '6회 날짜 바꾸기' }))
    const panel = screen.getByRole('region', { name: '6회 날짜 바꾸기' })
    fireEvent.change(within(panel).getByLabelText('새 날짜'), { target: { value: '2026-12-23' } })
    await user.type(within(panel).getByLabelText(/메모/), '시험 주간')
    await user.click(within(panel).getByRole('button', { name: '저장' }))
    await screen.findByRole('status')
    expect(sent[0]?.body).toEqual({
      scheduledDate: '2026-12-23',
      shiftFollowing: true,
      note: '시험 주간',
    })

    await user.click(within(await table()).getByRole('button', { name: '7회 휴강' }))
    await user.click(screen.getByRole('button', { name: '휴강하기' }))
    await vi.waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[1]?.body).toEqual({ shiftFollowing: true })
  })
})
