import { HttpResponse } from 'msw'

// 응답을 붙잡아 두는 목("확인하는 중" 같은 기다리는 화면을 볼 때). 끝나지 않는 Promise를 돌려주면 그 요청이
// 테스트가 끝난 뒤에도 남아, 파일이 끝날 때 setup.ts가 "끝나지 않은 요청"으로 실패시킨다(#116).
// 그래서 붙잡은 응답은 테스트가 끝나면 setup.ts가 풀어 준다(화면을 내린 뒤에 503으로).
const held: Array<() => void> = []

/** 목 핸들러에서 `() => hold()` — 테스트가 끝날 때까지 응답하지 않는다 */
export function hold(): Promise<Response> {
  return new Promise((resolve) => {
    held.push(() => resolve(HttpResponse.json({ title: '테스트가 끝나 풀림' }, { status: 503 })))
  })
}

/** setup.ts의 afterEach가 부른다 */
export function releaseHeld() {
  held.splice(0).forEach((release) => release())
}
