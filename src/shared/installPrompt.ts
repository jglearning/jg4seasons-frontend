import { useSyncExternalStore } from 'react'

// 홈 화면 설치 이벤트(#164). 크롬·삼성 인터넷은 설치할 수 있는 사이트에 `beforeinstallprompt`를 보낸다.
// 기본 동작(브라우저가 띄우는 작은 안내)은 막고 보관했다가, 학생이 "홈 화면에 추가하기"를 누를 때 `prompt()`.
// 이벤트는 화면이 그려지기 전에 올 수 있어 앱 시작 때(main.tsx) 한 번 등록한다.
// 사파리·인앱 브라우저·이미 설치한 경우에는 이벤트가 오지 않는다 → 화면은 브라우저별 단계 안내

/** 표준 타입에 없는 크롬 이벤트(사용하는 부분만) */
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let saved: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

function set(next: InstallPromptEvent | null) {
  saved = next
  listeners.forEach((listener) => listener())
}

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault()
  set(event as InstallPromptEvent)
}

function onInstalled() {
  set(null)
}

let listening = false

/** 앱 시작 때 한 번. 여러 번 불러도 한 번만 등록한다 */
export function listenForInstallPrompt() {
  if (listening) return
  listening = true
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', onInstalled)
}

/** 설치 창을 띄운다. 이벤트는 한 번만 쓸 수 있어 결과와 관계없이 비운다 */
export async function promptInstall(): Promise<'accepted' | 'dismissed'> {
  const event = saved
  if (!event) return 'dismissed'
  set(null)
  try {
    await event.prompt()
    const { outcome } = await event.userChoice
    return outcome
  } catch {
    return 'dismissed'
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 지금 버튼 한 번으로 설치할 수 있는지 */
export function useCanInstall(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => saved !== null,
    () => false,
  )
}

/** 테스트용: 보관한 이벤트와 등록을 처음 상태로 */
export function resetInstallPromptForTest() {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.removeEventListener('appinstalled', onInstalled)
  listening = false
  saved = null
  listeners.forEach((listener) => listener())
}
