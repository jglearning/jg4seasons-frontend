import { vi } from 'vitest'

// 크롬의 beforeinstallprompt를 흉내 낸다(#164). jsdom에는 이 이벤트가 없다
export function fireInstallPrompt(outcome: 'accepted' | 'dismissed') {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  })
  window.dispatchEvent(event)
  return event
}
