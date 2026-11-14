import { createServer, type Server } from 'node:net'
import type { AddressInfo } from 'node:net'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { server } from '../mocks/node'

// 목이 있는 요청은 실제 네트워크에 닿지 않아야 한다(#109).
// Node 24.22(undici 7.30)부터, 응답을 기다리던 요청이 취소되면(화면이 내려갈 때) undici가 요청 없는 연결을
// 새로 연다. @mswjs/interceptors 0.45.11까지는 그 조용한 소켓을 HTTP가 아니라고 보고 실제 서버로 넘겼고,
// 다음 테스트의 요청이 그 소켓에 실려 나가 ECONNREFUSED로 실패했다(CI에서만 흔들린 EntryPage). 0.45.12가 고쳤다.
// 여기서는 실제로 듣는 서버를 띄워, 그 순서를 밟아도 연결이 하나도 오지 않는지 본다
let real: Server
let connections: number
let release: Array<() => void>

beforeEach(async () => {
  connections = 0
  release = []
  real = createServer((socket) => {
    connections++
    socket.on('error', () => {})
    socket.destroy()
  })
  await new Promise<void>((resolve) => real.listen(0, '::', resolve))
})
afterEach(async () => {
  release.splice(0).forEach((fn) => fn())
  await new Promise<void>((resolve) => real.close(() => resolve()))
})

describe('목 요청과 실제 네트워크', () => {
  it('응답을 기다리던 요청을 취소하고 바로 다시 요청해도 실제 서버에 연결하지 않는다', async () => {
    const { port } = real.address() as AddressInfo
    const url = `http://localhost:${port}/api/v1/abort-probe`
    let hold = true
    server.use(
      http.get(url, () =>
        hold
          ? new Promise<Response>((resolve) => {
              release.push(() => resolve(HttpResponse.json({}, { status: 503 })))
            })
          : HttpResponse.json({ ok: true }),
      ),
    )
    const controller = new AbortController()
    const first = fetch(url, { signal: controller.signal }).catch((error: unknown) => error)
    // 요청이 목에 잡힐 때까지
    await new Promise((resolve) => setTimeout(resolve, 20))

    hold = false
    controller.abort()
    const second = await fetch(url)
    await first
    // 넘어간 소켓의 실제 연결은 수 ms 안에 온다
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(second.status).toBe(200)
    expect(connections).toBe(0)
  })
})
