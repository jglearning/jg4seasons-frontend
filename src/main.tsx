import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shared/tokens.css'
import './shared/base.css'
import { App } from './app/App'
import { listenForInstallPrompt } from './shared/installPrompt'

// 홈 화면 설치 이벤트는 화면보다 먼저 올 수 있어 렌더 전에 받는다(#164)
listenForInstallPrompt()

// npm run dev:mock(vite --mode mock)에서만 MSW 워커를 켠다. 운영 빌드에는 들어가지 않는다
async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.MODE !== 'mock') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ quiet: true })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
