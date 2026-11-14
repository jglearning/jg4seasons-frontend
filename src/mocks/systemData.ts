import { delay, http, HttpResponse, type AnyHandler } from 'msw'
import type { components } from '../api/generated/schema'

// 운영자 학원·교재 사용권 관리 목(SYS-07, BE #48 7.1·7.2). 운영자(superadmin)만 — 그 밖은 403.
// 검증 규칙은 백엔드 7.2 설명과 같게(주소 모양·demo 금지·IANA 타임존·비밀번호 8자~72바이트, 겹침은 409)

type Schemas = components['schemas']
type Academy = Schemas['AcademyResponse']

type Helpers = {
  problem: (
    request: Request,
    status: number,
    code: string,
    title: string,
    extra?: Record<string, unknown>,
  ) => Response
  readJson: (request: Request) => Promise<Record<string, unknown>>
  currentUser: () => { id: number; role: string } | null
}

export const SYSTEM_MOCK = {
  /** 이미 있는 학원 주소(409 ACADEMY_SLUG_TAKEN) */
  takenSlug: 'jey',
  /** 이미 있는 아이디(409 LOGIN_ID_TAKEN) — 목 관리자 */
  takenLoginId: 'admin01',
}

const INITIAL: Academy[] = [
  // 목 관리자(admin01)의 학원 — A-05 기본 목이 연계라 같게
  {
    id: 1,
    name: 'JEY 어학원',
    slug: 'jey',
    timezone: 'Asia/Seoul',
    licenseEnforced: true,
    status: 'active',
  },
  {
    id: 2,
    name: '한빛 영어학원',
    slug: 'hanbit-english',
    timezone: 'Asia/Seoul',
    licenseEnforced: false,
    status: 'active',
  },
]

type License = Schemas['LicenseItem']

/** 목의 "오늘"(학원 날짜) — A-05 목과 같은 날 */
export const MOCK_TODAY = '2026-12-19'

// 권 기준 데이터(백엔드 V2와 같은 17권) — 순서가 곧 레벨·권 순
const LEVEL_CODES = ['L1', 'L2', 'L3', 'L4', 'K']
const SEASONS = ['겨울', '봄', '여름', '가을']
const BOOKS = LEVEL_CODES.flatMap((level) =>
  (level === 'K' ? SEASONS.slice(0, 1) : SEASONS).map((season, i) => ({
    code: `${level}-B${i + 1}`,
    label: `Book ${i + 1}`,
    season,
  })),
)

const INITIAL_LICENSES: Record<number, License[]> = {
  1: [
    {
      book: BOOKS[4]!, // L2-B1
      startDate: '2026-12-01',
      endDate: '2027-02-28',
      status: 'active',
      daysLeft: 72,
      seats: 20,
      usedSeats: 18,
    },
    {
      book: BOOKS[8]!, // L3-B1
      startDate: '2026-12-01',
      endDate: '2027-02-28',
      status: 'active',
      daysLeft: 72,
      seats: 20,
      usedSeats: 22,
    },
  ],
}

let academies: Academy[] = []
let licenses: Record<number, License[]> = {}
let adminLoginIds: string[] = []
let nextId = 3

export function resetSystemMock() {
  academies = INITIAL.map((a) => ({ ...a }))
  licenses = Object.fromEntries(
    Object.entries(INITIAL_LICENSES).map(([id, rows]) => [id, rows.map((r) => ({ ...r }))]),
  )
  adminLoginIds = [SYSTEM_MOCK.takenLoginId, 'teacher01', 'super01']
  nextId = 3
}
resetSystemMock()

const DAY = 24 * 60 * 60 * 1000
const toDay = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY

/** 백엔드 7.3·7.4 규칙: 시작 전·사용 중·끝남, 남은 일수는 마지막 날이 1. 직영은 늘 active·null */
function licenseState(academy: Academy, startDate: string, endDate: string) {
  if (!academy.licenseEnforced) return { status: 'active' as const, daysLeft: null }
  const today = toDay(MOCK_TODAY)
  if (today < toDay(startDate)) return { status: 'before_start' as const, daysLeft: null }
  if (today > toDay(endDate)) return { status: 'expired' as const, daysLeft: null }
  return { status: 'active' as const, daysLeft: toDay(endDate) - today + 1 }
}

const bookOrder = (code: string) => BOOKS.findIndex((b) => b.code === code)

/** 테스트에서 목록을 비울 때 */
export function clearMockAcademies() {
  academies = []
}

const SLUG = /^[a-z0-9][a-z0-9-]{1,29}$/

function validTimezone(value: string): boolean {
  // 오프셋(+09:00)은 IANA 이름이 아니다 — 최근 런타임의 Intl은 받아 주므로 따로 막는다
  if (/^[+-]/.test(value)) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

const str = (value: unknown) => (typeof value === 'string' ? value : '')

export function systemHandlers({ problem, readJson, currentUser }: Helpers): AnyHandler[] {
  const systemOnly = (request: Request) => {
    const user = currentUser()
    if (!user) return problem(request, 401, 'UNAUTHORIZED', '다시 로그인해 주세요')
    if (user.role !== 'superadmin') return problem(request, 403, 'FORBIDDEN', '권한이 없습니다')
    return undefined
  }

  return [
    // 7.1 학원 목록(id 순)
    http.get('*/api/v1/system/academies', async ({ request }) => {
      await delay()
      return (
        systemOnly(request) ??
        HttpResponse.json<Schemas['AcademyListResponse']>({
          items: [...academies].sort((a, b) => a.id - b.id),
        })
      )
    }),

    // 7.2 학원 만들기(201) — 409면 아무것도 만들지 않는다
    http.post('*/api/v1/system/academies', async ({ request }) => {
      await delay()
      const denied = systemOnly(request)
      if (denied) return denied
      const body = await readJson(request)
      const admin =
        typeof body.admin === 'object' && body.admin !== null
          ? (body.admin as Record<string, unknown>)
          : {}
      const name = str(body.name).trim()
      const slug = str(body.slug).trim()
      const timezone = body.timezone == null ? 'Asia/Seoul' : str(body.timezone)
      const loginId = str(admin.loginId).trim().toLowerCase()
      const adminName = str(admin.name).trim()
      const password = str(admin.password)

      const errors: Array<{ field: string; message: string }> = []
      if (name === '' || name.length > 50)
        errors.push({ field: 'name', message: '1~50자로 입력해 주세요' })
      if (!SLUG.test(slug) || slug === 'demo')
        errors.push({ field: 'slug', message: '소문자·숫자·- 2~30자, 영숫자로 시작해 주세요' })
      if (!validTimezone(timezone))
        errors.push({ field: 'timezone', message: 'IANA 타임존 이름이 아닙니다' })
      if (typeof body.licenseEnforced !== 'boolean')
        errors.push({ field: 'licenseEnforced', message: '사용권 적용을 골라 주세요' })
      if (!/^[a-z0-9._-]{3,30}$/.test(loginId))
        errors.push({ field: 'admin.loginId', message: '영문·숫자·. _ - 3~30자로 입력해 주세요' })
      if (adminName === '' || adminName.length > 30)
        errors.push({ field: 'admin.name', message: '1~30자로 입력해 주세요' })
      if (password.length < 8 || new TextEncoder().encode(password).length > 72)
        errors.push({ field: 'admin.password', message: '8자 이상, 72바이트 이하로 입력해 주세요' })
      if (errors.length > 0) {
        return problem(request, 400, 'VALIDATION', '입력값을 확인해 주세요', { errors })
      }
      if (academies.some((a) => a.slug === slug)) {
        return problem(request, 409, 'ACADEMY_SLUG_TAKEN', '이미 쓰는 학원 주소예요')
      }
      if (adminLoginIds.includes(loginId)) {
        return problem(request, 409, 'LOGIN_ID_TAKEN', '이미 사용 중인 아이디입니다')
      }

      const academy: Academy = {
        id: nextId++,
        name,
        slug,
        timezone,
        licenseEnforced: body.licenseEnforced as boolean,
        status: 'active',
      }
      academies.push(academy)
      licenses[academy.id] = []
      adminLoginIds.push(loginId)
      return HttpResponse.json<Schemas['AcademyCreatedResponse']>(
        { ...academy, admin: { id: 1000 + academy.id, loginId, name: adminName } },
        { status: 201 },
      )
    }),

    // 7.3 학원 상세·사용권 현황(사용권 줄은 레벨·권 순)
    http.get('*/api/v1/system/academies/:id', async ({ request, params }) => {
      await delay()
      const denied = systemOnly(request)
      if (denied) return denied
      const academy = academies.find((a) => a.id === Number(params.id))
      if (!academy) return problem(request, 404, 'NOT_FOUND', '학원을 찾을 수 없습니다')
      return HttpResponse.json<Schemas['AcademyDetailResponse']>({
        academy,
        today: MOCK_TODAY,
        licenses: [...(licenses[academy.id] ?? [])].sort(
          (a, b) => bookOrder(a.book.code) - bookOrder(b.book.code),
        ),
      })
    }),

    // 7.4 사용권 지정·변경 — 없으면 만들고 있으면 고친다, 응답은 바뀐 줄 하나
    http.put('*/api/v1/system/academies/:id/licenses/:bookCode', async ({ request, params }) => {
      await delay()
      const denied = systemOnly(request)
      if (denied) return denied
      const academy = academies.find((a) => a.id === Number(params.id))
      const book = BOOKS.find((b) => b.code === params.bookCode)
      if (!academy || !book) {
        return problem(request, 404, 'NOT_FOUND', '학원 또는 교재를 찾을 수 없습니다')
      }
      const body = await readJson(request)
      const startDate = str(body.startDate)
      const endDate = str(body.endDate)
      const seats = body.seats
      const DATE = /^\d{4}-\d{2}-\d{2}$/
      const errors: Array<{ field: string; message: string }> = []
      if (!DATE.test(startDate))
        errors.push({ field: 'startDate', message: '날짜를 입력해 주세요' })
      if (!DATE.test(endDate)) errors.push({ field: 'endDate', message: '날짜를 입력해 주세요' })
      else if (DATE.test(startDate) && endDate < startDate)
        errors.push({ field: 'endDate', message: '종료일은 시작일과 같거나 뒤여야 합니다' })
      if (typeof seats !== 'number' || !Number.isInteger(seats) || seats < 0 || seats > 10000)
        errors.push({ field: 'seats', message: '0~10000 사이로 입력해 주세요' })
      if (errors.length > 0) {
        return problem(request, 400, 'VALIDATION', '입력값을 확인해 주세요', { errors })
      }
      const rows = (licenses[academy.id] ??= [])
      const existing = rows.find((r) => r.book.code === book.code)
      const row: License = {
        book,
        startDate,
        endDate,
        seats: seats as number,
        usedSeats: existing?.usedSeats ?? 0,
        ...licenseState(academy, startDate, endDate),
      }
      if (existing) rows.splice(rows.indexOf(existing), 1, row)
      else rows.push(row)
      return HttpResponse.json<Schemas['LicenseItem']>(row)
    }),
  ]
}
