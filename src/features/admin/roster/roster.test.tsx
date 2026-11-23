import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../../app/routes'
import { resetAdminMock } from '../../../mocks/adminData'
import { resetAuthMock, setMockSession } from '../../../mocks/handlers'
import { server } from '../../../mocks/node'
import { hold } from '../../../test/hold'
import { renderRoutes } from '../../../test/render'

// A-05 명단 가져오기 — 붙여넣기 → 열 고르기 → 반 정하기 → 검사 → 만들기 → 결과(BE #67)

let sent: Array<{ path: string; body: unknown }>

beforeEach(() => {
  resetAuthMock()
  resetAdminMock()
  setMockSession('admin')
  sent = []
  server.events.on('request:start', async ({ request }) => {
    const path = new URL(request.url).pathname
    if (!path.startsWith('/api/v1/admin/roster-imports')) return
    const text = await request.clone().text()
    sent.push({ path, body: text ? JSON.parse(text) : null })
  })
})

afterEach(() => {
  server.events.removeAllListeners()
  vi.restoreAllMocks()
})

const CHECK = '/api/v1/admin/roster-imports/check'
const CREATE = '/api/v1/admin/roster-imports'
const sentTo = (path: string) => sent.filter((s) => s.path === path)

// 엑셀에서 복사한 모양: 탭 구분, 첫 줄 제목, 연락처 열(보내지 않음)
const ROSTER = [
  '반\t이름\t학교\t학년\t연락처',
  '겨울 그린 A\t새학생\tA중\t중1\t010-1111-2222',
  '겨울 그린 A\t김민준\tA중\t중1\t010-3333-4444',
  '겨울 블루 B\t최지호\tA중\t중2\t010-5555-6666',
].join('\n')

async function pasteRoster(user: UserEvent, text: string) {
  renderRoutes(routes, { initialEntries: ['/admin/roster-import'] })
  const area = await screen.findByRole('textbox', { name: '명단' })
  expect(area).toHaveFocus()
  await user.paste(text)
  await user.click(screen.getByRole('button', { name: '다음 · 열 고르기' }))
}

const card = (name: string) => screen.getByRole('region', { name })

async function fillNewClass(user: UserEvent, name: string, book = 'L3-B1') {
  const c = card(name)
  await user.selectOptions(within(c).getByRole('combobox', { name: '권' }), book)
  fireEvent.change(within(c).getByLabelText('개강일'), { target: { value: '2026-12-08' } })
  await user.click(within(c).getByRole('checkbox', { name: '월' }))
  await user.click(within(c).getByRole('checkbox', { name: '수' }))
}

/** 기본 명단으로 ④ 검사까지 — 겨울 그린 A는 기존 반(12), 겨울 블루 B는 새 반 */
async function toCheck(user: UserEvent) {
  await pasteRoster(user, ROSTER)
  await user.click(screen.getByRole('button', { name: '다음 · 반 정하기' }))
  await fillNewClass(user, '겨울 블루 B')
  await user.click(screen.getByRole('button', { name: '검사하기' }))
  await screen.findByRole('heading', { name: /확인할 것 1개/ })
}

describe('A-05 진입', () => {
  it('반 관리 화면의 "명단 가져오기" 버튼 — 사이드바 메뉴는 그대로', async () => {
    const user = userEvent.setup()
    renderRoutes(routes, { initialEntries: ['/admin/classes'] })
    await user.click(await screen.findByRole('link', { name: '명단 가져오기' }))
    expect(await screen.findByRole('heading', { name: '명단 가져오기' })).toBeInTheDocument()
    const steps = screen.getByRole('list', { name: '단계' })
    expect(within(steps).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step')
  })

  it('교사가 주소로 들어오면 안내만', async () => {
    setMockSession('teacher')
    renderRoutes(routes, { initialEntries: ['/admin/roster-import'] })
    expect(await screen.findByRole('alert')).toHaveTextContent('관리자만 볼 수 있는 화면입니다')
  })
})

describe('A-05 ① 붙여넣기 · ② 열 고르기', () => {
  it('빈 칸이면 다음으로 못 감. 제목으로 열 뜻을 미리 고르고, 연락처는 쓰지 않음', async () => {
    const user = userEvent.setup()
    renderRoutes(routes, { initialEntries: ['/admin/roster-import'] })
    expect(await screen.findByRole('button', { name: '다음 · 열 고르기' })).toBeDisabled()
    await user.paste(ROSTER)
    expect(screen.getByRole('checkbox', { name: /첫 줄은 제목/ })).toBeChecked()
    await user.click(screen.getByRole('button', { name: '다음 · 열 고르기' }))

    expect(screen.getByText('학생 3명 · 열 5개')).toBeInTheDocument()
    const selects = screen.getAllByRole('combobox')
    expect(selects.map((s) => (s as HTMLSelectElement).value)).toEqual([
      'class',
      'name',
      'school',
      'grade',
      'skip',
    ])
    expect(screen.getByText('반 2개로 나뉩니다')).toBeInTheDocument()
    // 엑셀 줄 번호(제목이 1번)
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(rows[1]).toHaveTextContent(/^2겨울 그린 A새학생/)
  })

  it('이름은 한 열에만: 다른 열에서 고르면 앞의 것은 쓰지 않음. 이름 열이 없으면 다음 못 감', async () => {
    const user = userEvent.setup()
    await pasteRoster(user, ROSTER)
    const selects = () => screen.getAllByRole('combobox') as HTMLSelectElement[]
    await user.selectOptions(selects()[2]!, 'name')
    expect(selects().map((s) => s.value)).toEqual(['class', 'skip', 'name', 'grade', 'skip'])
    await user.selectOptions(selects()[2]!, 'skip')
    expect(screen.getByText('이름 열을 골라 주세요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다음 · 반 정하기' })).toBeDisabled()
  })

  it('반 칸 없이 모두 한 반으로 → 반 고르기가 사라지고 반 1개', async () => {
    const user = userEvent.setup()
    await pasteRoster(user, ROSTER)
    await user.click(screen.getByRole('checkbox', { name: '반 칸 없이 모두 한 반으로 넣습니다' }))
    expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).value).toBe('skip')
    expect(screen.getByText('반 1개로 나뉩니다')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다음 · 반 정하기' }))
    expect(screen.getByRole('heading', { name: '반 이름 없음' })).toBeInTheDocument()
  })
})

describe('A-05 ③ 반 정하기', () => {
  it('같은 이름의 진행 중 반은 기존 반으로, 없으면 새 반(이름 + 반)', async () => {
    const user = userEvent.setup()
    await pasteRoster(user, ROSTER)
    await user.click(screen.getByRole('button', { name: '다음 · 반 정하기' }))

    const green = card('겨울 그린 A')
    expect(within(green).getByRole('radio', { name: '기존 반에 넣기' })).toBeChecked()
    expect(within(green).getByRole('combobox', { name: '넣을 반' })).toHaveValue('12')
    expect(green).toHaveTextContent('같은 이름의 진행 중인 반을 미리 골라 두었습니다')
    const blue = card('겨울 블루 B')
    expect(within(blue).getByRole('radio', { name: '새 반 만들기' })).toBeChecked()
    expect(within(blue).getByRole('textbox', { name: '반 이름' })).toHaveValue('겨울 블루 B반')
    expect(screen.getByText('기존 반 1 · 새 반 1 · 학생 3명')).toBeInTheDocument()
  })

  it('빈 칸이 있으면 보내지 않고 그 카드에 안내, 첫 빈 칸으로 초점', async () => {
    const user = userEvent.setup()
    await pasteRoster(user, ROSTER)
    await user.click(screen.getByRole('button', { name: '다음 · 반 정하기' }))
    await user.click(screen.getByRole('button', { name: '검사하기' }))

    expect(sent).toEqual([])
    const blue = card('겨울 블루 B')
    expect(blue).toHaveTextContent('권 · 개강일 · 요일을 정해 주세요')
    expect(within(blue).getByRole('combobox', { name: '권' })).toHaveFocus()
    expect(card('겨울 그린 A')).not.toHaveTextContent('정해 주세요')
  })

  it('반마다 50명을 넘으면 한도 안내, 검사를 보내지 않음', async () => {
    const user = userEvent.setup()
    const lines = Array.from({ length: 51 }, (_, i) => `겨울 그린 A\t학생${i + 1}`)
    await pasteRoster(user, ['반\t이름', ...lines].join('\n'))
    await user.click(screen.getByRole('button', { name: '다음 · 반 정하기' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      '겨울 그린 A: 학생이 51명입니다. 한 반에 50명까지 넣을 수 있습니다',
    )
    await user.click(screen.getByRole('button', { name: '검사하기' }))
    expect(sent).toEqual([])
  })
})

describe('A-05 ④ 검사 · 만들기 · ⑥ 결과', () => {
  it('경고 확인 전에는 만들기 잠김 → 만들기 → 반별 코드 표, 인쇄, 연락처는 보내지 않음', async () => {
    const user = userEvent.setup()
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    await toCheck(user)

    const expected = {
      classes: [
        {
          existingClassId: 12,
          students: [
            { name: '새학생', school: 'A중', grade: '중1' },
            { name: '김민준', school: 'A중', grade: '중1' },
          ],
        },
        {
          newClass: {
            name: '겨울 블루 B반',
            bookCode: 'L3-B1',
            startDate: '2026-12-08',
            weekdays: [1, 3],
            teacherIds: [],
          },
          students: [{ name: '최지호', school: 'A중', grade: '중2' }],
        },
      ],
    }
    expect(sentTo(CHECK).map((s) => s.body)).toEqual([expected])
    expect(JSON.stringify(sent)).not.toContain('010')

    // 경고(서버 문구 그대로) — 확인 체크 전에는 만들기 잠김
    const warnings = screen.getByRole('region', { name: /확인할 것 1개/ })
    expect(warnings).toHaveTextContent('겨울 그린 A · 3번 줄')
    expect(warnings).toHaveTextContent("같은 이름의 학생 '김민준'이 이미 있어요(겨울 그린 A반)")
    expect(screen.getByText('오류가 없습니다')).toBeInTheDocument()
    const create = screen.getByRole('button', { name: '반 1개 · 학생 3명 만들기' })
    expect(create).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: '위 1개를 확인했고 그대로 만듭니다' }))
    expect(create).toBeEnabled()
    await user.click(create)

    expect(
      await screen.findByRole('heading', { name: '반 1개 · 학생 3명을 만들었습니다' }),
    ).toBeInTheDocument()
    expect(sentTo(CREATE).map((s) => s.body)).toEqual([expected])
    expect(
      screen.getByText('기존 반 1개에 2명을 넣었습니다. 새 반 1개를 만들어 1명을 넣었습니다.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: '단계' })).not.toBeInTheDocument()

    const greenTable = screen.getByRole('table', { name: '겨울 그린 A반 개인 코드' })
    const greenRows = within(greenTable).getAllByRole('row').slice(1)
    expect(greenRows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/^새학생\d{4}$/),
      expect.stringMatching(/^김민준\d{4}$/),
    ])
    const blueSection = screen.getByRole('region', { name: '겨울 블루 B반' })
    expect(blueSection).toHaveTextContent('새 반')
    expect(screen.getByRole('region', { name: '겨울 그린 A반' })).toHaveTextContent(
      '기존 반 · 2명 추가',
    )
    expect(screen.getByRole('region', { name: '겨울 그린 A반' })).toHaveTextContent('G7KM2XP4')

    // 인쇄 묶음: 반마다 하나(body 바로 아래). 한 반만 인쇄하면 그 묶음만, 인쇄 창이 닫히면 다시 모두
    const sheets = () => [...document.body.querySelectorAll(':scope > [aria-hidden="true"]')]
    expect(sheets()).toHaveLength(2)
    expect(sheets()[0]!.children).toHaveLength(2)
    const printAll = screen.getByRole('button', { name: '모든 반 카드 인쇄' })
    await waitFor(() => expect(printAll).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '겨울 블루 B반 카드 인쇄' }))
    expect(print).toHaveBeenCalledTimes(1)
    expect(sheets()).toHaveLength(1)
    expect(sheets()[0]).toHaveTextContent('겨울 블루 B반')
    expect(sheets()[0]).toHaveTextContent('최지호')
    fireEvent(window, new Event('afterprint'))
    expect(sheets()).toHaveLength(2)
    await user.click(printAll)
    expect(print).toHaveBeenCalledTimes(2)
    expect(sheets()).toHaveLength(2)
  })

  it('결과의 개인 코드는 쿼리 캐시에 없고, 떠나려 하면 한 번 묻고, 떠나면 사라진다', async () => {
    const user = userEvent.setup()
    const { client } = renderRoutes(routes, { initialEntries: ['/admin/roster-import'] })
    const area = await screen.findByRole('textbox', { name: '명단' })
    area.focus()
    await user.paste(['반\t이름', '겨울 그린 A\t새학생'].join('\n'))
    await user.click(screen.getByRole('button', { name: '다음 · 열 고르기' }))
    await user.click(screen.getByRole('button', { name: '다음 · 반 정하기' }))
    await user.click(screen.getByRole('button', { name: '검사하기' }))
    await user.click(await screen.findByRole('button', { name: '학생 1명 만들기' }))
    const table = await screen.findByRole('table', { name: '겨울 그린 A반 개인 코드' })
    const code = within(table).getAllByRole('row')[1]!.textContent!.slice(-4)

    const cached = JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((q) => q.state.data),
    )
    expect(cached).not.toContain(code)
    expect(client.getMutationCache().getAll()).toHaveLength(0)

    // 새로고침·탭 닫기 → 브라우저 기본 확인
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)

    // 앱 안 이동 → 한 번 묻기(머물기에 초점)
    await user.click(screen.getByRole('link', { name: '← 반 관리' }))
    const ask = screen.getByRole('alert')
    expect(ask).toHaveTextContent('이 화면을 떠나면 개인 코드를 다시 볼 수 없습니다')
    expect(within(ask).getByRole('button', { name: '머물기' })).toHaveFocus()
    await user.click(within(ask).getByRole('button', { name: '머물기' }))
    expect(screen.getByRole('table', { name: '겨울 그린 A반 개인 코드' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '← 반 관리' }))
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: '떠나기' }))
    expect(await screen.findByRole('heading', { name: '반 관리' })).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(code)
  })

  it('검사 오류: 그 줄을 짚고 그 자리에서 고침 → 바뀌면 만들기 잠김, 다시 검사', async () => {
    const user = userEvent.setup()
    await pasteRoster(
      user,
      ['반\t이름', '겨울 그린 A\t새학생', '겨울 그린 A\t', '겨울 그린 A\t둘째'].join('\n'),
    )
    await user.click(screen.getByRole('button', { name: '다음 · 반 정하기' }))
    await user.click(screen.getByRole('button', { name: '검사하기' }))

    // 빈 이름은 서버 400 VALIDATION(field) — 검사 목록과 같은 모양
    const errors = await screen.findByRole('region', { name: /고칠 것 1개/ })
    expect(errors).toHaveTextContent('겨울 그린 A · 3번 줄')
    expect(errors).toHaveTextContent('이름이 비어 있음')
    expect(screen.getByRole('button', { name: '학생 3명 만들기' })).toBeDisabled()

    await user.type(within(errors).getByRole('textbox', { name: '3번 줄 이름' }), '셋째')
    expect(
      screen.getByText('검사한 뒤 명단이 바뀌었습니다. 다시 검사해야 만들 수 있습니다'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '학생 3명 만들기' })).toBeDisabled()
    // 고친 것은 목록에서 바로 지우지 않는다
    expect(screen.getByRole('region', { name: /고칠 것 1개/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '다시 검사' }))
    expect(await screen.findByText('오류가 없습니다')).toBeInTheDocument()
    // 다시 검사한 결과 수를 스크린 리더에 알린다
    expect(screen.getByText('검사를 마쳤습니다. 고칠 것 0개, 확인할 것 0개')).toHaveAttribute(
      'role',
      'status',
    )
    expect(sentTo(CHECK)).toHaveLength(2)
    expect(sentTo(CHECK)[1]!.body).toMatchObject({
      classes: [{ students: [{ name: '새학생' }, { name: '셋째' }, { name: '둘째' }] }],
    })
    expect(screen.getByRole('button', { name: '학생 3명 만들기' })).toBeEnabled()
  })

  it('이 줄 빼기 → 그 학생 없이 다시 검사', async () => {
    const user = userEvent.setup()
    await pasteRoster(user, ['반\t이름', '겨울 그린 A\t새학생', '겨울 그린 A\t'].join('\n'))
    await user.click(screen.getByRole('button', { name: '다음 · 반 정하기' }))
    await user.click(screen.getByRole('button', { name: '검사하기' }))
    await user.click(await screen.findByRole('button', { name: '3번 줄 빼기' }))
    expect(screen.getByText('이 줄은 뺐습니다')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다시 검사' }))
    expect(await screen.findByRole('button', { name: '학생 1명 만들기' })).toBeEnabled()
  })

  it('반 설정 오류는 "반 정하기에서 고치기"로 그 카드에', async () => {
    const user = userEvent.setup()
    await pasteRoster(user, ['반\t이름', '겨울 민트 C\t새학생'].join('\n'))
    await user.click(screen.getByRole('button', { name: '다음 · 반 정하기' }))
    await fillNewClass(user, '겨울 민트 C', 'L1-B1')
    await user.click(screen.getByRole('button', { name: '검사하기' }))

    const errors = await screen.findByRole('region', { name: /고칠 것 1개/ })
    expect(errors).toHaveTextContent('겨울 민트 C · 반 설정')
    expect(errors).toHaveTextContent('이 권은 사용 기간이 아니에요')
    await user.click(within(errors).getByRole('button', { name: '반 정하기에서 고치기' }))
    expect(screen.getByRole('heading', { name: '겨울 민트 C' })).toHaveFocus()
  })

  it('400 VALIDATION이 전체(개수)를 짚으면 맨 위 한 줄 + 붙여넣기로', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('*/api/v1/admin/roster-imports/check', () =>
        HttpResponse.json(
          {
            code: 'VALIDATION',
            title: '입력값을 확인해 주세요',
            errors: [{ field: 'classes', message: '학생은 한 번에 500명까지' }],
          },
          { status: 400 },
        ),
      ),
    )
    await pasteRoster(user, ['반\t이름', '겨울 그린 A\t새학생'].join('\n'))
    await user.click(screen.getByRole('button', { name: '다음 · 반 정하기' }))
    await user.click(screen.getByRole('button', { name: '검사하기' }))
    expect(
      await screen.findByText(/한 번에 반 30개, 학생 500명까지 가져올 수 있습니다/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '학생 1명 만들기' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '붙여넣기로 돌아가기' }))
    expect(screen.getByRole('textbox', { name: '명단' })).toBeInTheDocument()
  })

  it('만드는 중: 진행 표시, 모든 버튼·단계 잠김, 두 번 눌러도 한 번만 보냄', async () => {
    const user = userEvent.setup()
    server.use(http.post('*/api/v1/admin/roster-imports', () => hold()))
    await toCheck(user)
    await user.click(screen.getByRole('checkbox', { name: /확인했고 그대로 만듭니다/ }))
    await user.dblClick(screen.getByRole('button', { name: '반 1개 · 학생 3명 만들기' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      '반 1개 · 학생 3명을 만들고 있습니다',
    )
    expect(sentTo(CREATE)).toHaveLength(1)
    expect(screen.getByRole('button', { name: '만드는 중' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '다시 검사' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '← 반 정하기' })).toBeDisabled()
    expect(within(screen.getByRole('list', { name: '단계' })).queryByRole('button')).toBeNull()
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
  })

  it('만들기 4xx: 아무것도 안 생김 → 검사를 다시 불러 목록 표시', async () => {
    const user = userEvent.setup()
    await toCheck(user)
    server.use(
      http.post('*/api/v1/admin/roster-imports', () =>
        HttpResponse.json(
          {
            code: 'LICENSE_SEATS_FULL',
            title: '명단을 다시 검사해 주세요',
            errors: [{ field: 'classes[1]', message: '명단을 다시 검사해 주세요' }],
          },
          { status: 409 },
        ),
      ),
      http.post('*/api/v1/admin/roster-imports/check', () =>
        HttpResponse.json({
          errors: [
            {
              code: 'LICENSE_SEATS_FULL',
              field: 'classes[1]',
              message: '블루 겨울 학생 수 한도를 넘어요',
            },
          ],
          warnings: [],
        }),
      ),
    )
    await user.click(screen.getByRole('checkbox', { name: /확인했고 그대로 만듭니다/ }))
    await user.click(screen.getByRole('button', { name: '반 1개 · 학생 3명 만들기' }))

    const errors = await screen.findByRole('region', { name: /고칠 것 1개/ })
    expect(errors).toHaveTextContent('겨울 블루 B · 반 설정')
    expect(errors).toHaveTextContent('블루 겨울 학생 수 한도를 넘어요')
    expect(
      screen.getByText(/명단을 다시 검사해 주세요\. 아무것도 만들지 않았습니다/),
    ).toBeInTheDocument()
    expect(sentTo(CHECK)).toHaveLength(2)
    expect(screen.getByRole('button', { name: '반 1개 · 학생 3명 만들기' })).toBeDisabled()
  })

  it.each([
    ['응답을 못 받음', () => HttpResponse.error()],
    [
      '5xx',
      () =>
        HttpResponse.json(
          { code: 'INTERNAL', title: '잠시 후 다시 시도해 주세요' },
          { status: 500 },
        ),
    ],
  ])('만들기 %s: 만들어졌는지 모름 — 다시 만들 수 없게 잠금', async (_, reply) => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await toCheck(user)
    server.use(http.post('*/api/v1/admin/roster-imports', reply))
    await user.click(screen.getByRole('checkbox', { name: /확인했고 그대로 만듭니다/ }))
    await user.click(screen.getByRole('button', { name: '반 1개 · 학생 3명 만들기' }))

    const box = await screen.findByText('만들어졌는지 확인하지 못했습니다')
    expect(box.closest('[role="alert"]')).toHaveTextContent(
      '반 관리에서 반과 학생이 생겼는지 확인해 주세요',
    )
    expect(screen.getByRole('link', { name: '반 관리에서 확인하기' })).toHaveAttribute(
      'href',
      '/admin/classes',
    )
    expect(screen.getByRole('button', { name: '반 1개 · 학생 3명 만들기' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '다시 검사' })).toBeDisabled()
    expect(sentTo(CREATE)).toHaveLength(1)
    expect(sentTo(CHECK)).toHaveLength(1)
  })
})
