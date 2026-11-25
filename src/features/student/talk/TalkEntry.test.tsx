import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { routes } from '../../../app/routes'
import { resetAuthMock, setMockSession } from '../../../mocks/handlers'
import { server } from '../../../mocks/node'
import { resetTalkMock, TALK_MOCK } from '../../../mocks/talkData'
import { renderRoutes } from '../../../test/render'

// S-03 홈의 프리토킹 진입 줄 — 설정 조회 200일 때만, 그 밖은 숨기고 홈은 그대로

let configResponses = 0

beforeEach(() => {
  localStorage.clear()
  resetAuthMock()
  resetTalkMock()
  setMockSession('student')
  configResponses = 0
  server.events.on('response:mocked', ({ request }) => {
    if (new URL(request.url).pathname.endsWith('/talk/config')) configResponses += 1
  })
})

afterEach(() => {
  server.events.removeAllListeners()
})

const entry = () => screen.queryByRole('link', { name: /프리토킹/ })

function renderHome() {
  return renderRoutes(routes, { initialEntries: ['/'] })
}

/**
 * 홈 내용이 그려지고 설정 조회 응답이 n번 온 뒤 — 숨김을 확인할 때 불러오는 중(줄 없음)과 섞이지 않게.
 * 5xx는 쿼리 기본값대로 한 번 더 시도하므로 2번
 */
async function settled(responses: number) {
  await screen.findByText(/오늘 수업|첫 수업|오늘은 수업이 없어요/)
  await waitFor(() => expect(configResponses).toBe(responses))
}

describe('TalkEntry', () => {
  it('켜진 학원: 남은 횟수와 함께 /talk로', async () => {
    renderHome()
    const link = await screen.findByRole('link', { name: /프리토킹/ })
    expect(link).toHaveAttribute('href', '/talk')
    expect(link).toHaveTextContent('오늘 3번 더 할 수 있어요')
  })

  it('구독 없음: 줄은 보이고(들어가면 잠금) 안내 문구', async () => {
    TALK_MOCK.entitled = false
    renderHome()
    expect(await screen.findByRole('link', { name: /프리토킹/ })).toHaveTextContent(
      '구독하면 캐릭터와 말할 수 있어요',
    )
  })

  it('오늘 다 했으면 그 문구', async () => {
    TALK_MOCK.dailyLimit = 0
    renderHome()
    expect(await screen.findByRole('link', { name: /프리토킹/ })).toHaveTextContent(
      '오늘은 세 번 다 했어요',
    )
  })

  it('기능 꺼짐(404 FEATURE_DISABLED)이면 줄 없음, 홈은 그대로', async () => {
    TALK_MOCK.enabled = false
    renderHome()
    await settled(1)
    expect(entry()).not.toBeInTheDocument()
  })

  it('조회 실패(500)여도 줄만 숨긴다', async () => {
    server.use(
      http.get('*/api/v1/talk/config', () =>
        HttpResponse.json(
          { title: '오류', status: 500 },
          { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    renderHome()
    await settled(2)
    expect(entry()).not.toBeInTheDocument()
  })
})
