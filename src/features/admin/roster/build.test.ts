import { describe, expect, it } from 'vitest'
import {
  buildRequest,
  defaultClassName,
  groupStudents,
  initialChoice,
  limitProblems,
  missingFields,
  placeOf,
  toStudents,
  type ClassChoice,
  type Group,
  type Student,
} from './build'

const row = (line: number, ...cells: string[]) => ({ line, cells })

describe('toStudents — 열 뜻대로 학생 줄로', () => {
  it('이름·반·학교·학년만 꺼내고 "쓰지 않음" 열(연락처)은 버린다', () => {
    const students = toStudents(
      [row(2, '겨울 그린 A', '김하늘', 'A중', '중1', '010-1234-5678')],
      ['class', 'name', 'school', 'grade', 'skip'],
      false,
    )
    expect(students).toEqual([
      { line: 2, className: '겨울 그린 A', name: '김하늘', school: 'A중', grade: '중1' },
    ])
    expect(JSON.stringify(students)).not.toContain('010')
  })

  it('이름 칸이 빈 줄은 남긴다(서버 검사에서 오류로) — 쓰는 열이 모두 빈 줄만 뺀다', () => {
    const students = toStudents(
      [row(2, 'A반', '', 'C중'), row(3, '', '', '', '010')],
      ['class', 'name', 'school', 'skip'],
      false,
    )
    expect(students.map((s) => s.line)).toEqual([2])
  })

  it('모두 한 반으로: 반 열이 있어도 반 이름은 비운다', () => {
    const students = toStudents([row(1, 'A반', '김하늘')], ['class', 'name'], true)
    expect(students[0]?.className).toBe('')
  })
})

const student = (line: number, className: string, name = `학생${line}`): Student => ({
  line,
  className,
  name,
  school: '',
  grade: '',
})

describe('groupStudents — 반 이름별로', () => {
  it('처음 나온 차례, 앞뒤·겹친 공백과 대소문자는 같은 반으로, 표시는 처음 나온 글자', () => {
    const groups = groupStudents([
      student(2, '겨울 그린 A'),
      student(3, '블루  b'),
      student(4, ' 겨울 그린 A '),
      student(5, '블루 B'),
    ])
    expect(groups.map((g) => [g.label, g.students.map((s) => s.line)])).toEqual([
      ['겨울 그린 A', [2, 4]],
      ['블루  b', [3, 5]],
    ])
  })
})

const group = (label: string, count = 1): Group => ({
  key: label.toLowerCase(),
  label,
  students: Array.from({ length: count }, (_, i) => student(i + 2, label)),
})

describe('반 정하기 기본값', () => {
  const active = [
    { id: 7, name: '겨울 그린 A반' },
    { id: 8, name: '블루 화목반' },
  ]

  it('이름이 같은 진행 중 반(띄어쓰기·대소문자·끝의 "반" 무시)이 있으면 기존 반', () => {
    expect(initialChoice(group('겨울그린 a'), active)).toMatchObject({
      mode: 'existing',
      existingId: 7,
    })
  })

  it('없으면 새 반, 이름 기본값 = 붙여넣은 이름 + "반"("반"으로 끝나면 그대로)', () => {
    expect(initialChoice(group('겨울 민트 C'), active)).toMatchObject({
      mode: 'new',
      existingId: null,
      draft: { name: '겨울 민트 C반', bookCode: '', startDate: '', weekdays: [], teacherIds: [] },
    })
    expect(defaultClassName('토요반')).toBe('토요반')
    expect(defaultClassName('')).toBe('')
  })
})

const newChoice = (draft: Partial<ClassChoice['draft']> = {}): ClassChoice => ({
  mode: 'new',
  existingId: null,
  draft: {
    name: '겨울 블루 B반',
    bookCode: 'L3-B1',
    startDate: '2026-12-08',
    weekdays: [5, 1],
    teacherIds: [],
    ...draft,
  },
})

describe('missingFields — 화면에서 먼저 막는 빈 칸', () => {
  it('새 반: 반 이름·권·개강일·요일(교사는 선택)', () => {
    expect(missingFields(newChoice())).toEqual([])
    expect(missingFields(newChoice({ name: ' ', startDate: '', weekdays: [] }))).toEqual([
      '반 이름',
      '개강일',
      '요일',
    ])
  })

  it('기존 반: 반을 골라야 함', () => {
    expect(missingFields({ ...newChoice(), mode: 'existing', existingId: null })).toEqual(['반'])
    expect(missingFields({ ...newChoice(), mode: 'existing', existingId: 3 })).toEqual([])
  })
})

describe('limitProblems — 개수 한도(반 30 · 반마다 50 · 전체 500)', () => {
  it('한도 안이면 없음', () => {
    expect(limitProblems([group('A', 50)])).toEqual([])
  })

  it('반마다 50명을 넘은 반 이름을 짚는다', () => {
    expect(limitProblems([group('A', 51), group('B', 2)])).toEqual([
      'A: 학생이 51명입니다. 한 반에 50명까지 넣을 수 있습니다',
    ])
  })

  it('반 31개, 전체 501명', () => {
    const many = Array.from({ length: 31 }, (_, i) => group(`반${i}`, i < 11 ? 47 : 1))
    expect(limitProblems(many)).toEqual([
      '반이 31개입니다. 한 번에 30개까지 가져올 수 있으니 나눠서 가져와 주세요',
      '학생이 537명입니다. 한 번에 500명까지 가져올 수 있으니 나눠서 가져와 주세요',
    ])
  })
})

describe('buildRequest — 요청 본문', () => {
  it('반 차례대로, 기존 반은 id, 새 반은 5.1 칸(이름 다듬기, 요일·교사 정렬), 빈 학교·학년은 보내지 않음', () => {
    const a = group('겨울 그린 A')
    const b: Group = {
      key: 'b',
      label: '겨울 블루 B',
      students: [
        { line: 5, className: '겨울 블루 B', name: '최지호', school: 'A중', grade: '중2' },
        { line: 7, className: '겨울 블루 B', name: '', school: 'C중', grade: '' },
      ],
    }
    const choices = new Map<string, ClassChoice>([
      [a.key, { ...newChoice(), mode: 'existing', existingId: 7 }],
      [b.key, newChoice({ name: ' 겨울 블루 B반 ', teacherIds: [4, 2] })],
    ])
    expect(buildRequest([a, b], choices)).toEqual({
      classes: [
        { existingClassId: 7, students: [{ name: '학생2' }] },
        {
          newClass: {
            name: '겨울 블루 B반',
            bookCode: 'L3-B1',
            startDate: '2026-12-08',
            weekdays: [1, 5],
            teacherIds: [2, 4],
          },
          students: [
            { name: '최지호', school: 'A중', grade: '중2' },
            { name: '', school: 'C중' },
          ],
        },
      ],
    })
  })
})

describe('placeOf — 서버 field를 화면 위치로', () => {
  it('학생 줄 · 반 설정 · 전체', () => {
    expect(placeOf('classes[1].students[3].name')).toEqual({
      kind: 'student',
      group: 1,
      student: 3,
    })
    expect(placeOf('classes[2].newClass.bookCode')).toEqual({ kind: 'class', group: 2 })
    expect(placeOf('classes[0].existingClassId')).toEqual({ kind: 'class', group: 0 })
    expect(placeOf('classes[4]')).toEqual({ kind: 'class', group: 4 })
    expect(placeOf('classes')).toEqual({ kind: 'all' })
    expect(placeOf('somethingElse')).toEqual({ kind: 'all' })
  })
})
