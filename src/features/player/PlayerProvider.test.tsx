import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlayer, type Source } from './player'
import { PlayerProvider } from './PlayerProvider'

// 재생 중 pause() → src → load() 순서면 실제 브라우저는 pause 이벤트를 보내지 않는다.
// 여기서도 pause()는 이벤트 없이 멈추기만 한다 — load()가 멈춤 상태를 직접 맞추는지 본다
const first: Source = {
  passageNo: 1,
  variant: 'us_w',
  trackId: 1,
  audioUrl: '/a1.wav',
  durationMs: 1000,
}
const second: Source = {
  passageNo: 2,
  variant: 'us_w',
  trackId: 2,
  audioUrl: '/a2.wav',
  durationMs: 1000,
}

function Probe() {
  const { playing, load } = usePlayer()
  return (
    <>
      <span>{playing ? '재생 중' : '멈춤'}</span>
      <button onClick={() => load(first, { play: true })}>첫 음원 재생</button>
      <button onClick={() => load(second)}>둘째 음원 올리기</button>
      <button onClick={() => load(second, { play: true })}>둘째 음원 이어 재생</button>
    </>
  )
}

const press = (name: string) => act(() => screen.getByRole('button', { name }).click())

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  Object.defineProperty(Navigator.prototype, 'sendBeacon', {
    value: () => true,
    configurable: true,
    writable: true,
  })
})

afterEach(() => {
  delete (Navigator.prototype as { sendBeacon?: unknown }).sendBeacon
})

describe('PlayerProvider load', () => {
  function renderPlaying() {
    render(
      <PlayerProvider lessonTitle="Reading Day 5" onTrackResult={() => {}}>
        <Probe />
      </PlayerProvider>,
    )
    press('첫 음원 재생')
    act(() => {
      document.querySelector('audio')?.dispatchEvent(new Event('playing'))
    })
    expect(screen.getByText('재생 중')).toBeInTheDocument()
  }

  it('재생 중에 이어 재생 없이 새 음원을 올리면 pause 이벤트가 없어도 멈춤', () => {
    renderPlaying()

    press('둘째 음원 올리기')

    expect(screen.getByText('멈춤')).toBeInTheDocument()
  })

  it('이어 재생으로 올리면 재생 상태 유지', () => {
    renderPlaying()

    press('둘째 음원 이어 재생')

    expect(screen.getByText('재생 중')).toBeInTheDocument()
  })
})
