import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { mockActiveStudents, resetAdminMock } from '../../mocks/adminData'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { resetTeacherMock, TEACHER_MOCK } from '../../mocks/teacherData'
import { buildItems, TEACHER_WORD_TEST_MOCK } from '../../mocks/wordTestData'
import { renderRoutes } from '../../test/render'

// T-05 아래 단어시험 결과 표와 제출 상세(#175). 목: 반 학생(id 순) i % 5 — 완료 · 완료(사진 지워짐) · 채점 중 · 실패 · 미제출

const CLASS = TEACHER_MOCK.classId
const LESSON = 'L2-B1-05'
const LESSON_PATH = `/teacher/classes/${CLASS}/lessons/${LESSON}`
const LIST = '*/api/v1/teacher/classes/:classId/word-tests'
let listCalls: string[]

beforeEach(() => {
  resetAuthMock()
  resetAdminMock()
  resetTeacherMock()
  setMockSession('teacher')
  listCalls = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname.endsWith('/word-tests')) listCalls.push(url.pathname + url.search)
  })
})

afterEach(() => {
  server.events.removeAllListeners()
})

const students = () => mockActiveStudents(CLASS)
const submissionId = (i: number) => TEACHER_WORD_TEST_MOCK.idBase + students()[i].id
const section = () => screen.getByRole('region', { name: '단어시험 · 철자 쓰기' })
const wordTable = () =>
  within(section()).getByRole('table', { name: '학생별 단어시험(철자 쓰기) 결과' })
const rowOf = (name: string) =>
  within(wordTable())
    .getAllByRole('row')
    .find((r) => within(r).queryByText(name) !== null) as HTMLElement
const correctCount = buildItems(48).filter((item) => item.result === 'correct').length

function renderAt(path: string) {
  return renderRoutes(routes, { initialEntries: [path] })
}

describe('T-05 단어시험 결과 표', () => {
  it('학생마다 점수·상태·회차·제출 시각, 이 회차의 B 영역으로 조회', async () => {
    renderAt(LESSON_PATH)
    await screen.findByRole('heading', { level: 2, name: '단어시험 · 철자 쓰기' })
    await within(section()).findByRole('table')
    const [graded, noImage, grading, failed, none] = students()

    const gradedRow = rowOf(graded.name)
    expect(within(gradedRow).getByRole('link', { name: graded.name })).toHaveAttribute(
      'href',
      `/teacher/classes/${CLASS}/word-tests/${submissionId(0)}`,
    )
    // 칸마다 글자를 그대로 비교(부분 문자열로 보면 상태 글자가 틀려도 통과한다)
    const cells = (name: string) =>
      within(rowOf(name))
        .getAllByRole('cell')
        .map((c) => c.textContent)
    expect(cells(graded.name)).toEqual([
      graded.name,
      `${correctCount} / 48`,
      '완료',
      '1회째',
      '12/19 19:10',
    ])
    expect(cells(noImage.name).slice(1, 4)).toEqual([`${correctCount} / 48`, '완료', '2회째'])
    expect(cells(grading.name).slice(1, 3)).toEqual(['—', '채점 중'])
    expect(cells(failed.name).slice(1, 3)).toEqual(['—', '실패'])
    expect(cells(none.name)).toEqual([none.name, '—', '미제출', '—', '—'])
    expect(within(rowOf(none.name)).queryByRole('link')).not.toBeInTheDocument()

    expect(listCalls).toEqual([
      `/api/v1/teacher/classes/${CLASS}/word-tests?lessonCode=${LESSON}&section=B`,
    ])
  })

  it('기능이 꺼진 학원(404 FEATURE_DISABLED)이면 묶음을 통째로 숨기고 기존 표는 그대로', async () => {
    server.use(
      http.get(LIST, () =>
        HttpResponse.json(
          { title: '꺼짐', status: 404, code: 'FEATURE_DISABLED', requestId: 'r' },
          { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderAt(LESSON_PATH)
    expect(await screen.findByRole('table', { name: /학생별 지문 완료/ })).toBeInTheDocument()
    await vi.waitFor(() => expect(listCalls).toHaveLength(1))
    await vi.waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: '단어시험 · 철자 쓰기' }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.queryByText('불러오는 중')).not.toBeInTheDocument()
  })

  // #177: 단어시험 API가 아직 운영에 없을 때(code 없는 404)·시험지 없는 회차(NOT_FOUND)도 숨긴다 — 기록은 남긴다
  it.each([
    [
      'NOT_FOUND',
      () =>
        HttpResponse.json(
          { title: '없음', status: 404, code: 'NOT_FOUND', requestId: 'r404' },
          { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      { code: 'NOT_FOUND', requestId: 'r404' },
    ],
    [
      'code 없는 404(백엔드 배포 전)',
      () =>
        new HttpResponse('<html>Not Found</html>', {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        }),
      { code: undefined, requestId: undefined },
    ],
  ])('404 %s도 묶음을 숨기고 경고를 남긴다(기존 표는 그대로)', async (_, respond, logged) => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {})
    server.use(http.get(LIST, respond))
    renderAt(LESSON_PATH)
    expect(await screen.findByRole('table', { name: /학생별 지문 완료/ })).toBeInTheDocument()
    await vi.waitFor(() =>
      expect(warned).toHaveBeenCalledWith('[wordtest] teacher list 404 — hidden', logged),
    )
    expect(screen.queryByRole('heading', { name: '단어시험 · 철자 쓰기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('기능 꺼짐(FEATURE_DISABLED)은 경고를 남기지 않는다', async () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {})
    renderAt(`/teacher/classes/${CLASS}/lessons/${TEACHER_WORD_TEST_MOCK.disabledLessonCode}`)
    expect(await screen.findByRole('table', { name: /학생별 지문 완료/ })).toBeInTheDocument()
    await vi.waitFor(() => expect(listCalls).toHaveLength(1))
    await vi.waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: '단어시험 · 철자 쓰기' }),
      ).not.toBeInTheDocument(),
    )
    expect(warned).not.toHaveBeenCalled()
  })

  it('그 밖의 오류는 묶음 안에 안내와 다시 시도(기존 표는 그대로)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server.use(
      http.get(LIST, () =>
        HttpResponse.json(
          { title: '오류', status: 500, code: 'INTERNAL', requestId: 'r' },
          { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderAt(LESSON_PATH)
    expect(await screen.findByRole('table', { name: /학생별 지문 완료/ })).toBeInTheDocument()
    expect(
      await within(section()).findByRole('button', { name: '다시 시도' }, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(within(section()).getByRole('alert')).toBeInTheDocument()
  })
})

describe('단어시험 제출 상세', () => {
  it('표에서 이름을 누르면 상세: 머리·점수·사진(새 탭)·문항 표', async () => {
    const user = userEvent.setup()
    renderAt(LESSON_PATH)
    const [graded] = students()
    // 위 지문 표에도 같은 이름 링크(학생 상세)가 있어 단어시험 묶음 안에서 고른다
    await screen.findByRole('heading', { level: 2, name: '단어시험 · 철자 쓰기' })
    await user.click(await within(section()).findByRole('link', { name: graded.name }))

    expect(
      await screen.findByRole('heading', { level: 1, name: `${graded.name} 단어시험` }),
    ).toBeInTheDocument()
    expect(screen.getByText(/L2-B1-05 · 철자 쓰기 · 1회째 · 12\/19 19:10 제출/)).toBeInTheDocument()
    expect(screen.getByText(`${correctCount} / 48`)).toBeInTheDocument()

    const photo = screen.getByRole('img', {
      name: `${graded.name} 답안지 사진, 새 탭에서 크게 보기`,
    })
    expect(photo).toHaveAttribute('src', TEACHER_WORD_TEST_MOCK.image)
    const photoLink = photo.closest('a')
    expect(photoLink).toHaveAttribute('href', TEACHER_WORD_TEST_MOCK.image)
    expect(photoLink).toHaveAttribute('target', '_blank')
    expect(photoLink).toHaveAttribute('rel', 'noopener noreferrer')

    const items = screen.getByRole('table', { name: '문항별 정답과 읽은 글자' })
    expect(within(items).getAllByRole('row')).toHaveLength(48 + 1)
    expect(screen.getByRole('link', { name: `← ${LESSON} 회차 상세` })).toHaveAttribute(
      'href',
      LESSON_PATH,
    )
  })

  it('문항 줄: 틀림은 정답과 읽은 글자, 빈칸은 (빈칸), 판단 못 함은 "확인 필요"와 안내', async () => {
    renderAt(`/teacher/classes/${CLASS}/word-tests/${submissionId(0)}`)
    const items = await screen.findByRole('table', { name: '문항별 정답과 읽은 글자' })
    const rows = within(items).getAllByRole('row')
    const expected = buildItems(48)
    const cells = (no: number) =>
      within(rows[no])
        .getAllByRole('cell')
        .map((c) => c.textContent)

    const wrong = expected[6] // 7번
    expect(cells(7)).toEqual(['7', wrong.prompt, wrong.answer, wrong.written, '틀림'])
    expect(cells(11)).toEqual(['11', expected[10].prompt, expected[10].answer, '(빈칸)', '안 씀'])
    expect(cells(13)[4]).toBe('확인 필요')
    expect(cells(13)[2]).toBe(expected[12].answer) // 교사는 unclear에도 정답(`BE #75`)
    expect(cells(1)[4]).toBe('맞음')
    const unclear = expected.filter((item) => item.result === 'unclear').length
    expect(
      screen.getByText(
        `확인 필요 ${unclear}문항은 글자가 흐려 채점하지 못했습니다. 사진을 보고 판단해 주세요.`,
      ),
    ).toBeInTheDocument()
  })

  it('사진이 지워졌으면 안내 글, 사진·링크 없음', async () => {
    renderAt(`/teacher/classes/${CLASS}/word-tests/${submissionId(1)}`)
    expect(await screen.findByText('답안지 사진이 지워졌습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('table', { name: '문항별 정답과 읽은 글자' })).toBeInTheDocument()
  })

  it.each([
    [2, '채점 중', '아직 채점하고 있습니다. 잠시 뒤에 다시 확인해 주세요.'],
    [3, '실패', '사진을 채점하지 못했습니다. 학생이 다시 찍어 올려야 합니다.'],
  ])('채점이 끝나지 않은 제출(%i번 학생)은 상태와 안내, 문항 표 없음', async (i, status, text) => {
    renderAt(`/teacher/classes/${CLASS}/word-tests/${submissionId(i)}`)
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.getByText(status)).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: '문항별 정답과 읽은 글자' })).not.toBeInTheDocument()
  })

  it('없는 제출(404)은 서버 문구', async () => {
    renderAt(`/teacher/classes/${CLASS}/word-tests/1`)
    expect(await screen.findByText('제출을 찾을 수 없습니다')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })
})
