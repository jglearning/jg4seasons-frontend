import { act, cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../app/routes'
import { resetAuthMock, setMockSession } from '../../mocks/handlers'
import { server } from '../../mocks/node'
import { buildWords, resetWordMock, WORD_MOCK } from '../../mocks/wordData'
import { renderRoutes } from '../../test/render'

let play: ReturnType<typeof vi.spyOn>
let saved: Array<Record<string, unknown>>

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
  resetWordMock()
  setMockSession('student')
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  saved = []
  server.events.on('request:start', async ({ request }) => {
    if (new URL(request.url).pathname.endsWith('/word-study')) {
      saved.push(JSON.parse(await request.clone().text()))
    }
  })
})

afterEach(async () => {
  // 화면이 닫힐 때도 저장(keepalive PUT)이 간다 — 그 요청이 다음 테스트 기록에 섞이지 않게 먼저 닫고 기다린다
  cleanup()
  await new Promise((resolve) => setTimeout(resolve, 20))
  server.events.removeAllListeners()
})

function renderWords(code = 'L2-B1-05') {
  return renderRoutes(routes, { initialEntries: [`/lessons/${code}/words`] })
}

/** 재생한 소리 주소들(오디오 요소의 src) */
const playedUrls = () =>
  play.mock.contexts.map((element: unknown) => (element as HTMLAudioElement).getAttribute('src'))
const card = () => screen.getByRole('button', { name: /^(어휘책|추가 단어)/ })
const counter = (text: string) => screen.findByText(text)

/** 첫 단어를 음원·예문 해석이 없는 대명사(어휘책에만 있는 단어)로 바꾼 응답 — 출처로 음원을 짐작하지 않는지도 본다 */
function bareFirstWord() {
  server.use(
    http.get('*/api/v1/student/lessons/:code/words', () => {
      const words = buildWords()
      const [first, ...rest] = words.items
      return HttpResponse.json({
        ...words,
        items: [
          { ...first, pos: 'pron', exampleKo: null, audio: null, exampleAudio: null },
          ...rest,
        ],
      })
    }),
  )
}

describe('S-06 단어 카드', () => {
  it('음원·해석 없는 단어(BE #38): 자동 재생 표시·재생 없이, 뒷면은 영어 예문만, 새 품사 표기', async () => {
    bareFirstWord()
    const user = userEvent.setup()
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)

    expect(card()).toHaveTextContent('대명사')
    expect(card()).not.toHaveTextContent('발음 자동 재생')
    expect(play).not.toHaveBeenCalled()

    await user.click(card())
    expect(card()).toHaveTextContent('We ____빈칸 after lunch every day.')
    expect(card()).not.toHaveTextContent('우리는 매일 점심 뒤에 수다를 떤다.')
  })

  it('첫 카드: 출처·품사·단어, 발음 1회 자동 재생, 진행 1 / 57', async () => {
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)

    expect(card()).toHaveTextContent('어휘책')
    expect(card()).toHaveTextContent('동사')
    expect(card()).toHaveTextContent(WORD_MOCK.english(1))
    expect(card()).toHaveTextContent('발음 자동 재생')
    expect(card()).not.toHaveTextContent(WORD_MOCK.korean(1))
    expect(playedUrls()).toEqual(['/mock-audio/word-900.wav'])
    expect(screen.getByRole('progressbar', { name: '단어 카드' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    )
  })

  it('3단계: 탭하면 영단어를 가리고 뜻·예문(그 단어는 ____)·해석, 한 번 더 탭하면 다음 단어', async () => {
    const user = userEvent.setup()
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)

    await user.click(card())
    expect(card()).toHaveTextContent(WORD_MOCK.korean(1))
    expect(card()).toHaveTextContent('우리는 매일 점심 뒤에 수다를 떤다.')
    // 영단어는 어디에도 보이지 않는다 — 예문 속 단어는 단어 길이만큼(최소 3) 밑줄, 읽을 때는 "빈칸"
    expect(card()).not.toHaveTextContent(WORD_MOCK.english(1))
    expect(card()).toHaveTextContent('We ____빈칸 after lunch every day.')
    expect(screen.queryByRole('button', { name: '예문 듣기' })).not.toBeInTheDocument()

    await user.click(card())
    expect(screen.getByText(`2 / ${WORD_MOCK.total}`)).toBeInTheDocument()
    expect(card()).toHaveTextContent(WORD_MOCK.english(2))
    expect(card()).not.toHaveTextContent(WORD_MOCK.korean(2)) // 다음 카드는 앞면부터
    expect(playedUrls()).toHaveLength(2) // 다음 카드도 자동 재생

    await user.click(screen.getByRole('button', { name: '이전' }))
    expect(card()).toHaveTextContent(WORD_MOCK.english(1))
  })

  it('"정답 확인"은 영단어를 보여 주고 발음 — 다음 카드에서는 다시 가린다', async () => {
    const user = userEvent.setup()
    renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)
    await user.click(card())

    await user.click(screen.getByRole('button', { name: '정답 확인 (영단어 보기·듣기)' }))

    expect(
      screen.getByRole('button', { name: `정답: ${WORD_MOCK.english(1)} · 다시 듣기` }),
    ).toBeInTheDocument()
    expect(playedUrls()).toEqual(['/mock-audio/word-900.wav', '/mock-audio/word-900.wav'])
    await user.click(screen.getByRole('button', { name: /^정답: / }))
    expect(playedUrls()).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(card())
    expect(screen.getByRole('button', { name: '정답 확인 (영단어 보기·듣기)' })).toBeInTheDocument()
  })

  it('자동 재생이 막히면 "눌러서 듣기"로 들을 수 있다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    play.mockRejectedValueOnce(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }))
    const user = userEvent.setup()
    renderWords()
    const listen = await screen.findByRole('button', { name: '눌러서 듣기' })
    expect(card()).not.toHaveTextContent('발음 자동 재생')

    await user.click(listen)

    expect(play).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: '눌러서 듣기' })).not.toBeInTheDocument()
  })

  it('화면을 떠나면 가장 멀리 본 카드 수를 저장한다(2.5)', async () => {
    const user = userEvent.setup()
    const { router } = renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '이전' }))

    await act(() => router.navigate('/lessons'))
    await vi.waitFor(() => expect(saved).toHaveLength(1))

    expect(saved[0]).toEqual({ cardsViewed: 3 })
    expect(WORD_MOCK.study.cardsViewed).toBe(3)
  })

  it('마지막 카드의 "완료"는 저장하고 홈으로 — 같은 값은 다시 보내지 않는다', async () => {
    const user = userEvent.setup()
    const { router } = renderWords()
    await counter(`1 / ${WORD_MOCK.total}`)
    for (let i = 1; i < WORD_MOCK.total; i++)
      await user.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.getByText(`${WORD_MOCK.total} / ${WORD_MOCK.total}`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '완료' }))
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'))
    await vi.waitFor(() => expect(WORD_MOCK.study.cardsViewed).toBe(WORD_MOCK.total))

    expect(saved).toEqual([{ cardsViewed: WORD_MOCK.total }])
  })

  it('교재 사용 기간이 아니면(403 LICENSE_INACTIVE) 서버 문구와 회차 목록으로', async () => {
    server.use(
      http.get('*/api/v1/student/lessons/:code/words', () =>
        HttpResponse.json(
          { code: 'LICENSE_INACTIVE', title: '사용 기간이 아니에요', status: 403 },
          { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderWords()

    expect(await screen.findByRole('alert')).toHaveTextContent('사용 기간이 아니에요')
    expect(screen.getByRole('link', { name: '회차 목록으로' })).toHaveAttribute('href', '/lessons')
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument()
  })

  it('잠긴 회차(423)는 서버 문구와 회차 목록으로', async () => {
    renderWords('L2-B1-08')

    expect(await screen.findByRole('alert')).toHaveTextContent('아직 열리지 않은 회차예요')
    expect(screen.getByRole('link', { name: '회차 목록으로' })).toHaveAttribute('href', '/lessons')
  })
})
