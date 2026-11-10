import { act, cleanup, screen, within } from '@testing-library/react'
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
  // 화면이 닫힐 때도 저장(keepalive PUT)이 간다 — 다음 테스트 기록에 섞이지 않게 먼저 닫고 기다린다
  cleanup()
  await new Promise((resolve) => setTimeout(resolve, 20))
  server.events.removeAllListeners()
})

/** 단어 앞 n개만 주는 응답(한 바퀴를 빨리 끝내려고) */
function fewWords(n: number) {
  server.use(
    http.get('*/api/v1/student/lessons/:code/words', () => {
      const words = buildWords()
      return HttpResponse.json({ items: words.items.slice(0, n), total: n })
    }),
  )
}

function renderCards() {
  return renderRoutes(routes, { initialEntries: ['/lessons/L2-B1-05/cards'] })
}

const ready = () => screen.findByRole('heading', { name: '카드 학습' })
const card = () => screen.getByRole('button', { name: /^(어휘책|추가 단어)/ })

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
const mode = (name: string) =>
  within(screen.getByRole('group', { name: '학습 모드' })).getByRole('button', {
    name: new RegExp(`^${name}`),
  })
const status = () => screen.getByRole('progressbar', { name: '진행' }).parentElement as HTMLElement

describe('S-06b 암기', () => {
  it('알아요는 빼고 몰라요는 뒤로 보내 다시 — 다 알면 "암기 완료"와 저장', async () => {
    fewWords(3)
    const user = userEvent.setup()
    renderCards()
    await ready()
    expect(card()).toHaveTextContent(WORD_MOCK.english(1))
    expect(play).toHaveBeenCalledTimes(1) // 발음 자동 재생

    await user.click(screen.getByRole('button', { name: '몰라요' }))
    expect(card()).toHaveTextContent(WORD_MOCK.english(2))
    expect(status()).toHaveTextContent('알아요 0 · 몰라요 1')
    expect(status()).toHaveTextContent('남은 카드 3')

    await user.click(screen.getByRole('button', { name: '알아요' }))
    await user.click(screen.getByRole('button', { name: '알아요' }))
    expect(card()).toHaveTextContent(WORD_MOCK.english(1))
    expect(card()).toHaveTextContent('다시 1번째')
    expect(play).toHaveBeenCalledTimes(4) // 다시 나온 카드도 자동 재생

    await user.click(screen.getByRole('button', { name: '알아요' }))
    expect(screen.getByText('암기 완료')).toBeInTheDocument()
    await vi.waitFor(() => expect(saved).toEqual([{ memKnown: 3 }]))
  })

  it('카드를 탭하면 뜻·예문, 단어 듣기', async () => {
    const user = userEvent.setup()
    renderCards()
    await ready()

    await user.click(card())

    expect(card()).toHaveTextContent(WORD_MOCK.korean(1))
    // S-06과 달리 암기 뒷면은 영단어를 가리지 않는다 — 예문 속 단어도 그대로
    expect(card()).toHaveTextContent(`We ${WORD_MOCK.english(1)} after lunch every day.`)
    await user.click(screen.getByRole('button', { name: '단어 듣기' }))
    expect(play).toHaveBeenCalledTimes(2)
  })
})

describe('S-06b 음원·해석 없는 단어(BE #38)', () => {
  it('암기 뒷면은 영어 예문만, 단어·예문 듣기는 꺼짐, 새 품사 표기', async () => {
    bareFirstWord()
    const user = userEvent.setup()
    renderCards()
    await ready()
    expect(card()).toHaveTextContent('대명사')
    expect(play).not.toHaveBeenCalled()

    await user.click(card())
    expect(card()).toHaveTextContent(`We ${WORD_MOCK.english(1)} after lunch every day.`)
    expect(card()).not.toHaveTextContent('우리는 매일 점심 뒤에 수다를 떤다.')
    expect(screen.getByRole('button', { name: '단어 듣기' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '예문 듣기' })).toBeDisabled()
  })
})

describe('S-06b 리콜(화면 채점)', () => {
  it('뜻 4개 중 하나 — 고르면 정답·오답을 글자로 보이고 "다음"이 켜진다', async () => {
    const user = userEvent.setup()
    renderCards()
    await ready()
    expect(mode('암기')).toHaveAttribute('aria-pressed', 'true')

    await user.click(mode('리콜'))
    expect(mode('리콜')).toHaveAttribute('aria-pressed', 'true')
    expect(mode('암기')).toHaveAttribute('aria-pressed', 'false')
    const choices = within(screen.getByRole('group', { name: '뜻 고르기' })).getAllByRole('button')
    expect(choices).toHaveLength(4)
    expect(choices.filter((c) => c.textContent?.trim() === WORD_MOCK.korean(1))).toHaveLength(1)
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
    expect(play).toHaveBeenCalledTimes(2) // 암기 첫 카드 + 리콜 첫 문제

    const wrong = choices.find((c) => c.textContent?.trim() !== WORD_MOCK.korean(1)) as HTMLElement
    await user.click(wrong)

    expect(wrong).toHaveTextContent('오답')
    expect(screen.getByRole('button', { name: `${WORD_MOCK.korean(1)} 정답` })).toBeInTheDocument()
    expect(status()).toHaveTextContent('맞힌 문제 0')
    // 고른 뒤에는 다른 것을 눌러도 바뀌지 않는다
    await user.click(screen.getByRole('button', { name: `${WORD_MOCK.korean(1)} 정답` }))
    expect(status()).toHaveTextContent('맞힌 문제 0')
    expect(screen.getByRole('button', { name: '다음' })).toBeEnabled()
  })

  it('한 바퀴 끝나면 결과와 맞힌 수 저장', async () => {
    fewWords(3)
    const user = userEvent.setup()
    renderCards()
    await ready()
    await user.click(mode('리콜'))

    for (const [order, right] of [
      [1, true],
      [2, false],
      [3, true],
    ] as const) {
      const group = within(screen.getByRole('group', { name: '뜻 고르기' }))
      const target = group
        .getAllByRole('button')
        .find((c) => (c.textContent?.trim() === WORD_MOCK.korean(order)) === right) as HTMLElement
      await user.click(target)
      await user.click(screen.getByRole('button', { name: order === 3 ? '결과 보기' : '다음' }))
    }

    expect(screen.getByText('리콜 결과 2 / 3')).toBeInTheDocument()
    await vi.waitFor(() => expect(saved).toEqual([{ recallCorrect: 2 }]))
  })
})

describe('S-06b 스펠(화면 채점)', () => {
  it('뜻을 보고 철자 — 대소문자·앞뒤 빈칸 무시, 틀리면 정답을 보인다', async () => {
    const user = userEvent.setup()
    renderCards()
    await ready()
    await user.click(mode('스펠'))
    // 숨겨 둔 다른 모드(목록)에도 같은 뜻이 있다 — 보이는 것만
    expect(
      screen.getAllByText(WORD_MOCK.korean(1)).filter((el) => el.closest('[hidden]') === null),
    ).toHaveLength(1)
    expect(play).toHaveBeenCalledTimes(1) // 스펠은 자동 재생하지 않는다(암기 첫 카드뿐)

    const input = screen.getByLabelText(`영어 철자 (${WORD_MOCK.english(1).length}글자)`)
    await user.type(input, 'chet{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent(`✗ 정답: ${WORD_MOCK.english(1)}`)
    expect(status()).toHaveTextContent('맞힌 철자 0')

    // 정답을 본 뒤 고쳐 쓰면 맞았다고 보이지만 점수는 아니다(처음 확인만 센다)
    await user.clear(input)
    await user.type(input, ' CHAT {Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('✓ 정답')
    expect(status()).toHaveTextContent('맞힌 철자 0')

    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.type(
      screen.getByLabelText(`영어 철자 (${WORD_MOCK.english(2).length}글자)`),
      `${WORD_MOCK.english(2)}{Enter}`,
    )
    expect(status()).toHaveTextContent('맞힌 철자 1')
  })

  it('발음 듣기 버튼', async () => {
    const user = userEvent.setup()
    renderCards()
    await ready()
    await user.click(mode('스펠'))

    await user.click(screen.getByRole('button', { name: '발음 듣기' }))

    expect(play).toHaveBeenCalledTimes(2)
  })
})

describe('S-06b 목록·모드 전환·처음부터', () => {
  it('목록은 출처(전체 / 어휘책 / 추가 단어)로 거르고, 순서는 서버 그대로', async () => {
    const user = userEvent.setup()
    renderCards()
    await ready()
    await user.click(mode('목록'))
    const filter = (name: string) =>
      within(screen.getByRole('group', { name: '출처' })).getByRole('button', { name })
    expect(screen.getAllByRole('listitem')).toHaveLength(WORD_MOCK.total)
    expect(filter('전체')).toHaveAttribute('aria-pressed', 'true')

    // 목: 지문 1~4 단어 38개 = 어휘책, 5~6 19개 = 추가 단어
    await user.click(filter('추가 단어'))
    const extra = screen.getAllByRole('listitem')
    expect(extra).toHaveLength(19)
    expect(extra[0]).toHaveTextContent(WORD_MOCK.english(39))
    expect(extra[0]).toHaveTextContent('추가 단어 ·')
    expect(status()).toHaveTextContent('추가 단어')
    expect(status()).toHaveTextContent('19개')

    await user.click(filter('어휘책'))
    expect(screen.getAllByRole('listitem')).toHaveLength(38)
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('어휘책 · 동사')
  })

  it('모드를 바꿔도 진행은 남고, "처음부터"는 모두 새로', async () => {
    const user = userEvent.setup()
    renderCards()
    await ready()
    await user.click(screen.getByRole('button', { name: '알아요' }))
    await user.click(mode('목록'))
    await user.click(mode('암기'))
    expect(status()).toHaveTextContent('알아요 1')

    await user.click(screen.getByRole('button', { name: '처음부터' }))

    expect(status()).toHaveTextContent('알아요 0 · 몰라요 0')
    expect(card()).toHaveTextContent(WORD_MOCK.english(1))
    await vi.waitFor(() => expect(saved).toEqual([{ memKnown: 1 }])) // 지우기 전 결과는 저장
  })

  it('떠나면 이 화면의 모드별 결과를 한 번에 저장', async () => {
    const user = userEvent.setup()
    const { router } = renderCards()
    await ready()
    await user.click(screen.getByRole('button', { name: '알아요' }))
    await user.click(screen.getByRole('button', { name: '알아요' }))
    await user.click(mode('리콜'))
    const group = within(screen.getByRole('group', { name: '뜻 고르기' }))
    await user.click(
      group
        .getAllByRole('button')
        .find((c) => c.textContent?.trim() === WORD_MOCK.korean(1)) as HTMLElement,
    )

    await act(() => router.navigate('/'))
    await vi.waitFor(() => expect(saved).toHaveLength(1))

    expect(saved[0]).toEqual({ memKnown: 2, recallCorrect: 1 })
  })
})
