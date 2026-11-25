import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../../../app/routes'
import { resetAdminMock } from '../../../mocks/adminData'
import { resetAuthMock, setMockSession } from '../../../mocks/handlers'
import { server } from '../../../mocks/node'
import { resetTeacherMock, TEACHER_MOCK } from '../../../mocks/teacherData'
import { resetWordTestMock } from '../../../mocks/wordTestData'
import { WORD_TEST_ENABLED } from '../../../shared/features'
import { renderRoutes } from '../../../test/render'

// 단어시험 사진 채점 진입점을 비용 문제로 꺼 둔 상태(#191) — 스위치 기본값 그대로.
// 학생 홈 진입 줄 · 하단 "시험" 탭 · 교사 T-05 결과 묶음이 없고, 단어시험 API도 부르지 않는다.
// 진입점이 켜졌을 때의 동작은 WordTestEntry·WordTestsPage·teacher/wordtest 테스트가(스위치를 켠 채) 본다

let wordTestCalls: string[]

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
  resetAdminMock()
  resetTeacherMock()
  resetWordTestMock()
  wordTestCalls = []
  server.events.on('request:start', ({ request }) => {
    const path = new URL(request.url).pathname
    if (path.includes('word-tests')) wordTestCalls.push(path)
  })
})

afterEach(() => {
  server.events.removeAllListeners()
})

describe('단어시험 진입점 꺼짐(#191)', () => {
  it('스위치 기본값은 꺼짐', () => {
    expect(WORD_TEST_ENABLED).toBe(false)
  })

  it('학생 홈: 진입 줄이 없고 하단 탭은 홈·회차·단어 세 칸, 단어시험 조회 없음', async () => {
    setMockSession('student')
    renderRoutes(routes, { initialEntries: ['/'] })
    // 홈 내용(오늘 단어 상자)이 그려질 때까지 — 진입 줄은 이 상자 아래 자리
    await screen.findByText('오늘 단어')

    expect(screen.queryByRole('link', { name: /철자 쓰기 제출/ })).not.toBeInTheDocument()
    const tabs = within(screen.getByRole('navigation')).getAllByRole('link')
    // 회차 탭은 밀린 수 배지 글자가 붙는다("2회차") — 탭 이름으로 본다
    expect(tabs).toHaveLength(3)
    expect(tabs[0]).toHaveTextContent(/^홈$/)
    expect(tabs[1]).toHaveTextContent(/회차$/)
    expect(tabs[2]).toHaveTextContent(/^단어$/)
    expect(screen.queryByRole('link', { name: '시험' })).not.toBeInTheDocument()
    expect(wordTestCalls).toEqual([])
  })

  it('교사 회차 상세(T-05): 단어시험 결과 묶음이 없고 목록 조회 없음, 지문 표는 그대로', async () => {
    setMockSession('teacher')
    renderRoutes(routes, {
      initialEntries: [`/teacher/classes/${TEACHER_MOCK.classId}/lessons/L2-B1-05`],
    })
    expect(await screen.findByRole('table', { name: /학생별 지문 완료/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /단어시험/ })).not.toBeInTheDocument()
    expect(wordTestCalls).toEqual([])
  })
})
