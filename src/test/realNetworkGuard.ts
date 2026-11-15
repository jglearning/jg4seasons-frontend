import { createServer } from 'node:net'

// 테스트가 실제 네트워크에 닿으면 실행 전체를 실패시킨다(#116). Vitest globalSetup — 테스트 프로세스 밖에서 한 번 돈다.
// 테스트의 요청은 jsdom 기본 출처 http://localhost:3000으로 나간다. 목이 놓치면 그 포트로 실제 연결이 가는데,
// 듣는 프로그램이 없으면 거절되고 테스트는 통과해 아무도 모른다(#109도 드러나기 전까지 실행마다 일어나고 있었다).
// 그래서 실행 동안 그 포트에서 직접 듣고, 끝날 때 연결이 한 건이라도 왔으면 던진다.
const PORT = 3000
// 마지막 테스트 파일이 끝난 직후에 나간 연결이 도착할 시간(수 ms 안에 온다)
const SETTLE_MS = 200

export default async function setup() {
  // 도착한 연결마다 한 줄 — 요청이 실려 왔으면 그 첫 줄("GET /api/v1/…"), 아니면 연결만
  const arrived: string[] = []
  const server = createServer((socket) => {
    const index = arrived.push('연결만(요청 없음)') - 1
    socket.on('error', () => {})
    socket.on('data', (chunk) => {
      arrived[index] = chunk.toString('latin1').split('\r\n')[0] ?? '요청'
      socket.destroy()
    })
    setTimeout(() => socket.destroy(), SETTLE_MS)
  })

  const listening = await new Promise<boolean>((resolve) => {
    server.once('error', () => resolve(false))
    // '::'는 IPv4·IPv6 둘 다 — localhost가 어느 쪽으로 풀려도 받는다
    server.listen(PORT, '::', () => resolve(true))
  })
  if (!listening) {
    const message = `${PORT}번 포트를 다른 프로그램이 쓰고 있어 실제 네트워크 감시를 켜지 못했습니다`
    // CI는 포트가 비어 있어야 한다. 로컬은 다른 프로젝트를 띄워 둔 채 돌릴 수 있어 알리기만 한다
    if (process.env.CI) throw new Error(message)
    console.warn(`[realNetworkGuard] ${message} — 이번 실행은 감시 없이 진행합니다`)
    return
  }

  return async () => {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))
    await new Promise<void>((resolve) => server.close(() => resolve()))
    if (arrived.length > 0) {
      throw new Error(
        `테스트가 실제 네트워크(localhost:${PORT})에 닿았습니다 — ${arrived.length}건: ${arrived.join(', ')}`,
      )
    }
  }
}
