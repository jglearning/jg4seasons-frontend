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

let academies: Academy[] = []
let adminLoginIds: string[] = []
let nextId = 3

export function resetSystemMock() {
  academies = INITIAL.map((a) => ({ ...a }))
  adminLoginIds = [SYSTEM_MOCK.takenLoginId, 'teacher01', 'super01']
  nextId = 3
}
resetSystemMock()

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
      adminLoginIds.push(loginId)
      return HttpResponse.json<Schemas['AcademyCreatedResponse']>(
        { ...academy, admin: { id: 1000 + academy.id, loginId, name: adminName } },
        { status: 201 },
      )
    }),
  ]
}
