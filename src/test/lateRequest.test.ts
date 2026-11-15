import { describe, expect, it } from 'vitest'

// 파일의 마지막 테스트가 요청을 남겨도 실제 네트워크에 닿지 않아야 한다(#116).
// 이 테스트는 일부러 요청을 남긴다 — 끝날 때 응답을 기다리는 요청 하나, 끝난 뒤에 시작되는 요청 셋
// (변경 뒤 다시 받는 쿼리처럼). setup.ts가 afterAll에서 목을 닫으면 이 요청들이 실제 localhost:3000으로 나가고,
// realNetworkGuard.ts(globalSetup)가 그 연결을 보고 실행 전체를 실패시킨다.
// 확인은 이 파일 안이 아니라 실행이 끝날 때 한다(파일이 끝난 뒤의 일이라 여기서는 볼 수 없다).
// 이 파일에는 이 테스트 하나만 둔다 — 앞 테스트가 열어 둔 연결이 있으면 남은 요청이 그 연결을 다시 써서
// 목을 닫아도 실제 네트워크로 나가지 않는다(깨뜨리기가 통하지 않는다).
// 요청 주소는 기본 목이 있는 /api/v1/me — 늦게 도착해도 "목 없는 요청"으로 잡히지 않게
const ME = 'http://localhost:3000/api/v1/me'

describe('파일 끝에 남은 요청', () => {
  it('마지막 테스트가 요청을 남긴 채 끝난다(실제 네트워크에 닿는지는 realNetworkGuard가 본다)', () => {
    const settled: unknown[] = []
    const send = () =>
      void fetch(ME)
        .then((response) => settled.push(response.status))
        .catch((error: unknown) => settled.push(error))

    send()
    for (const ms of [0, 1, 5]) setTimeout(send, ms)

    // 아직 아무 응답도 오지 않았다 — 넷 다 테스트가 끝난 뒤에 처리된다
    expect(settled).toEqual([])
  })
})
