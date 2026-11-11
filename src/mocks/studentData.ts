import type { components } from '../api/generated/schema'
import { PASSAGE_TITLES } from './lessonData'
import { WORD_MOCK } from './wordData'

// 학생 홈·회차 목록 목 데이터(03 §2.1·§2.2 예시 + 회차 상세 목과 같은 지어낸 지문 제목).
// 겨울 L2-B1, 24회차를 화·목·토 수업으로 배치: Day 1·2 완료, 3 멈춤(밀림), 4 미시작(밀림), 5 오늘, 6~ 잠김.
// 날짜는 실제 달력 기준(와이어프레임의 요일은 더미 값이라 다르다).
// progress는 늘 객체(BE #22) — 기록이 없으면 not_started · 0 / 지문 수

type Schemas = components['schemas']
type Home = Schemas['StudentHomeResponse']
type Lessons = Schemas['ClassLessonsResponse']
type LessonItem = Schemas['ClassLessonsLesson']

const NOT_STARTED = { status: 'not_started', passagesDone: 0, passagesTotal: 6 } as const

export const STUDENT_MOCK = {
  classId: 12,
  className: '겨울 그린 A반',
  level: { code: 'L2', nameKo: '그린', colorHex: '#1F7A4F' },
  book: { code: 'L2-B1', season: '겨울', label: 'Book 1' },
  todayNumber: 5,
} as const

const PASSAGES_L2_B1_05 = PASSAGE_TITLES

const FIRST_DAY = Date.UTC(2026, 11, 10) // 2026-12-10(목)
const WEEKDAY_STEPS = [2, 3, 2] // 목→토(2일) →화(3일) →목(2일) …

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** n회차(1~24)의 수업일 */
export function scheduledDate(n: number): string {
  let ms = FIRST_DAY
  for (let i = 1; i < n; i += 1) ms += WEEKDAY_STEPS[(i - 1) % 3] * 86_400_000
  return isoDay(ms)
}

function code(n: number): string {
  return `L2-B1-${String(n).padStart(2, '0')}`
}

function lessonType(n: number): LessonItem['type'] {
  return n % 8 === 0 ? 'module_review' : 'regular'
}

function lessonItem(n: number): LessonItem {
  const base = {
    code: code(n),
    number: n,
    title: `Reading Day ${n}`,
    type: lessonType(n),
    scheduledDate: scheduledDate(n),
  }
  if (n <= 2) {
    return {
      ...base,
      state: 'completed',
      progress: { status: 'completed', passagesDone: 6, passagesTotal: 6 },
    }
  }
  if (n === 3) {
    return {
      ...base,
      state: 'overdue',
      progress: { status: 'in_progress', passagesDone: 2, passagesTotal: 6 },
    }
  }
  if (n === 4) return { ...base, state: 'overdue', progress: { ...NOT_STARTED } }
  if (n === 5) {
    return {
      ...base,
      state: 'today',
      progress: { status: 'in_progress', passagesDone: 4, passagesTotal: 6 },
    }
  }
  return { ...base, state: 'locked', progress: { ...NOT_STARTED } }
}

function classInfo(): Home['class'] {
  return {
    id: STUDENT_MOCK.classId,
    name: STUDENT_MOCK.className,
    level: { ...STUDENT_MOCK.level },
    book: { ...STUDENT_MOCK.book },
    // 직영 학원은 늘 active(BE ADR 0031)
    licenseStatus: 'active',
  }
}

export function buildLessons(): Lessons {
  return {
    class: classInfo(),
    groups: [1, 2, 3].map((module) => {
      const from = (module - 1) * 8 + 1
      const lessons = Array.from({ length: 8 }, (_, i) => lessonItem(from + i))
      return {
        module,
        label: `겨울 ${module}`,
        range: { from: scheduledDate(from), to: scheduledDate(from + 7) },
        lessons,
      }
    }),
  }
}

export function buildHome(): Home {
  const n = STUDENT_MOCK.todayNumber
  return {
    class: classInfo(),
    today: {
      seq: n,
      scheduledDate: scheduledDate(n),
      groupLabel: '겨울 1',
      lesson: {
        code: code(n),
        number: n,
        title: `Reading Day ${n}`,
        type: 'regular',
        passages: PASSAGES_L2_B1_05.map((title, i) => ({ no: i + 1, title })),
      },
      progress: {
        status: 'in_progress',
        passagesDone: 4,
        passagesTotal: 6,
      },
    },
    overdue: [
      {
        seq: 3,
        scheduledDate: scheduledDate(3),
        lesson: { code: code(3), title: 'Reading Day 3' },
        kind: 'stopped',
        progress: { status: 'in_progress', passagesDone: 2, passagesTotal: 6 },
      },
      {
        seq: 4,
        scheduledDate: scheduledDate(4),
        lesson: { code: code(4), title: 'Reading Day 4' },
        kind: 'not_started',
        progress: { ...NOT_STARTED },
      },
    ],
    words: { lessonCode: code(n), total: WORD_MOCK.total, memKnown: WORD_MOCK.study.memKnown },
    next: {
      seq: n + 1,
      scheduledDate: scheduledDate(n + 1),
      lesson: { code: code(n + 1), title: `Reading Day ${n + 1}` },
    },
    stats: { completedLessons: 2, overdueLessons: 2, totalLessons: 24 },
    otherClasses: [],
  }
}
