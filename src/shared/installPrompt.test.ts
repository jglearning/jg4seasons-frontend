import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listenForInstallPrompt,
  promptInstall,
  resetInstallPromptForTest,
  useCanInstall,
} from './installPrompt'
import { fireInstallPrompt } from '../test/installPrompt'

// 홈 화면 설치 이벤트 보관(#164)

beforeEach(() => {
  resetInstallPromptForTest()
  listenForInstallPrompt()
})

afterEach(() => {
  resetInstallPromptForTest()
})

describe('installPrompt', () => {
  it('이벤트가 오기 전에는 설치할 수 없고, 오면 기본 안내를 막고 설치할 수 있다', () => {
    const { result } = renderHook(() => useCanInstall())
    expect(result.current).toBe(false)

    let event!: ReturnType<typeof fireInstallPrompt>
    act(() => {
      event = fireInstallPrompt('accepted')
    })
    expect(event.defaultPrevented).toBe(true)
    expect(result.current).toBe(true)
  })

  it('prompt() 결과를 돌려주고, 이벤트는 한 번만 쓸 수 있어 결과와 관계없이 비운다', async () => {
    const { result } = renderHook(() => useCanInstall())
    let event!: ReturnType<typeof fireInstallPrompt>
    act(() => {
      event = fireInstallPrompt('dismissed')
    })

    let outcome: string | undefined
    await act(async () => {
      outcome = await promptInstall()
    })
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(outcome).toBe('dismissed')
    expect(result.current).toBe(false)
  })

  it('보관한 이벤트가 없으면 아무것도 띄우지 않는다', async () => {
    expect(await promptInstall()).toBe('dismissed')
  })

  it('prompt()가 실패해도 버튼이 멈추지 않게 dismissed', async () => {
    act(() => {
      const event = fireInstallPrompt('accepted')
      event.prompt.mockRejectedValue(new Error('not allowed'))
    })
    expect(await promptInstall()).toBe('dismissed')
  })

  it('설치되면(appinstalled) 비운다', () => {
    const { result } = renderHook(() => useCanInstall())
    act(() => {
      fireInstallPrompt('accepted')
    })
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(result.current).toBe(false)
  })

  it('여러 번 불러도 한 번만 등록한다', () => {
    resetInstallPromptForTest()
    const added = vi.spyOn(window, 'addEventListener')
    listenForInstallPrompt()
    listenForInstallPrompt()
    expect(added.mock.calls.filter(([type]) => type === 'beforeinstallprompt')).toHaveLength(1)
    added.mockRestore()
  })
})
