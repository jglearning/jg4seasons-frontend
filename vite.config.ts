import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// 색은 tokens.css가 유일한 출처 — 매니페스트 색도 거기서 읽는다
const tokens = readFileSync(new URL('./src/shared/tokens.css', import.meta.url), 'utf8')
function token(name: string): string {
  const value = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`).exec(tokens)?.[1]
  if (value === undefined) throw new Error(`tokens.css에 --${name} 없음`)
  return value
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 홈 화면 추가(#38). 서비스 워커는 앱 껍데기(빌드한 js·css·html)만 미리 받아 둔다.
    // API·음원은 건드리지 않는다(캐시하지 않고 그대로 네트워크) — 오프라인 학습은 2차.
    // 새 배포는 다음에 열 때 자동으로 바뀐다(autoUpdate). 개발 서버(dev·dev:mock)에서는 꺼져 있다
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        // 가이드 §8: 이름 "4 Seasons"(홈 화면 아이콘 아래 글자), 배경 white, theme ink
        name: '제이G 4 Seasons',
        short_name: '4 Seasons',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: token('ink'),
        background_color: token('white'),
        // 아이콘은 회사 심볼(가이드 §8) — 원본 docs-internal/design/logo, 흰 바탕 PNG로 뽑아 public/icons에.
        // maskable은 Android가 원·둥근 사각으로 잘라도 심볼이 남게 가운데 작게
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html}'],
        // MSW 목 워커(public)가 빌드에 복사돼도 미리 받지 않는다
        globIgnores: ['**/mockServiceWorker.js'],
        navigateFallbackDenylist: [/^\/api\//, /^\/audio\//],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    // 운영과 같은 출처 구조: CloudFront가 /api/*를 백엔드로 넘기는 것을 개발에서 흉내 낸다(쿠키 인증)
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    restoreMocks: true,
    unstubGlobals: true,
    // 가짜 타이머는 setImmediate를 건드리지 않는다. MSW 3은 소켓을 가로챈 뒤 setImmediate 한 번 안에 요청 바이트가
    // 오지 않으면 그 연결을 실제 네트워크로 넘긴다. 가짜 setImmediate가 undici의 쓰기보다 먼저 돌면 목이 있는
    // 요청이 localhost로 나간다(src/test/fakeTimers.test.ts가 지킨다).
    // CI의 EntryPage 흔들림은 이것이 아니라 @mswjs/interceptors 0.45.11 문제였다(src/test/mswRealNetwork.test.ts)
    // Vitest 기본 목록(nextTick·queueMicrotask 제외)에서 setImmediate·clearImmediate만 뺐다. toNotFake로 쓰면
    // 테스트가 vi.useFakeTimers({ toFake })를 넘길 때 "같이 쓸 수 없음"으로 깨진다 — 테스트의 toFake가 이 목록을 대신한다
    fakeTimers: {
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'Date',
        'hrtime',
        'performance',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'Intl',
      ],
    },
  },
})
