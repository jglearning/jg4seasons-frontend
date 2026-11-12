// 기기에 남기는 것은 가입 코드 하나뿐이다(03 §1.2 — 학습 기록이 아니라 localStorage 예외).
// 로그인에 성공한 뒤에만 저장한다. 개인 코드는 어디에도 저장하지 않는다
const STORAGE_KEY = 'jg4s.joinCode'
export const JOIN_CODE_LENGTH = 8
const JOIN_CODE = /^[A-Z0-9]{8}$/

// 저장소를 쓸 수 없는 브라우저(사생활 보호 모드 등)에서도 로그인은 되게, 읽기·쓰기 실패는 "저장 안 됨"으로 본다
export function readJoinCode(): string | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value !== null && JOIN_CODE.test(value) ? value : undefined
  } catch {
    return undefined
  }
}

export function saveJoinCode(code: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // 저장하지 못하면 다음에 S-01부터 입력한다
  }
}

export function clearJoinCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 지울 수 없으면 읽을 수도 없다
  }
}
