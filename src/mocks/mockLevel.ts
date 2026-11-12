import { LESSON_MOCK } from './lessonData'
import { STUDENT_MOCK } from './studentData'

// dev:mock 전용 — 학생 화면을 다섯 레벨로 띄워 보는 스위치(화면 PR 스크린샷용).
// 주소에 ?level=mint|green|blue|navy|black 을 붙이면 그 탭(sessionStorage)에서 계속 그 레벨로 응답한다.
// 앱 코드는 이 값을 모른다 — 목 응답의 level.code만 바뀐다
const LEVELS = {
  mint: { code: 'L1', nameKo: '민트' },
  green: { code: 'L2', nameKo: '그린' },
  blue: { code: 'L3', nameKo: '블루' },
  navy: { code: 'L4', nameKo: '네이비' },
  black: { code: 'K', nameKo: '블랙' },
} as const

const KEY = 'jg4s.mock.level'

function isLevel(value: string | null): value is keyof typeof LEVELS {
  return value !== null && value in LEVELS
}

export function applyMockLevel() {
  let name: string | null = new URLSearchParams(window.location.search).get('level')
  try {
    if (isLevel(name)) sessionStorage.setItem(KEY, name)
    else name = sessionStorage.getItem(KEY)
  } catch {
    // 저장소를 못 쓰면 주소 값만 쓴다
  }
  if (!isLevel(name)) return
  const { code, nameKo } = LEVELS[name]
  Object.assign(STUDENT_MOCK.level, { code, nameKo })
  Object.assign(LESSON_MOCK.level, { code, nameKo })
}
