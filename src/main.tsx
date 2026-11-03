import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './shared/tokens.css'
import './shared/base.css'
import { App } from './app/App'

// npm run dev:mock(vite --mode mock)에서만 MSW 워커를 켠다. 운영 빌드에는 들어가지 않는다
async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.MODE !== 'mock') return
  const { worker } = await import('./mocks/browser')
  await worker.start()
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
