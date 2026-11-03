import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // 운영과 같은 출처 구조: CloudFront가 /api/*를 백엔드로 넘기는 것을 개발에서 흉내 낸다(쿠키 인증)
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
