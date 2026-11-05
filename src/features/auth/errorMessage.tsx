import type { ReactNode } from 'react'
import { ApiError } from '../../api/errors'

// 요청 실패를 화면 문구로. 순서: 화면이 정한 code별 문구 → LOCKED의 해제 시각(until) → Problem Details의
// title(+ detail) → 연결 실패 → 그 밖
export const NETWORK_MESSAGE = '인터넷 연결을 확인하고 다시 시도해 주세요'

type Copy = {
  /** code별로 서버 title 대신 보일 문구 */
  codes?: Partial<Record<string, string>>
  /** LOCKED의 until이 있을 때 detail 대신 보일 줄. 인자는 "오후 3시 42분" 꼴 */
  unlockAt?: (time: string) => string
}

export function errorMessage(error: unknown, copy: Copy = {}): ReactNode {
  if (error instanceof ApiError) {
    const override = error.code === undefined ? undefined : copy.codes?.[error.code]
    if (override !== undefined) return override
    // 백엔드 LOCKED의 detail은 고정 문구이고 해제 시각은 until(UTC)에만 있다
    const time = error.code === 'LOCKED' ? koreanTime(error.until) : undefined
    const second = time !== undefined && copy.unlockAt ? copy.unlockAt(time) : error.detail
    if (second === undefined) return error.title
    return (
      <>
        {error.title}
        <br />
        {second}
      </>
    )
  }
  // 원인을 찾을 수 있게 남긴다. 요청 값(개인 코드·비밀번호)은 오류 객체에 들어 있지 않다
  console.error(error)
  // fetch 연결 실패는 TypeError로 온다(코드 실수의 TypeError도 여기로 오지만 위에서 기록된다)
  if (error instanceof TypeError) return NETWORK_MESSAGE
  return '잠시 후 다시 시도해 주세요'
}

// 학원은 한국에 있다 — 기기 시간대 설정이 틀려도 한국 시간으로 보인다. 잠금은 10분이라 날짜는 붙이지 않는다.
// 숫자만 받고 오전·오후는 직접 붙인다(ko-KR 문구는 실행 환경의 ICU 데이터에 따라 "PM"으로 나오기도 한다)
const SEOUL_HOUR_MINUTE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
})

/** ISO 시각 → "오후 3시 42분"(정각이면 "오후 3시"). 읽을 수 없으면 undefined */
function koreanTime(iso: string | undefined): string | undefined {
  if (iso === undefined) return undefined
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return undefined
  const parts = SEOUL_HOUR_MINUTE.formatToParts(date)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return undefined
  const period = hour < 12 ? '오전' : '오후'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return minute === 0 ? `${period} ${hour12}시` : `${period} ${hour12}시 ${minute}분`
}

export const STUDENT_COPY: Copy = {
  codes: { INVALID_CREDENTIALS: '가입 코드 또는 개인 코드가 맞지 않아요' },
  unlockAt: (time) => `${time}부터 다시 할 수 있어요`,
}

// 교사·관리자(T-01) — 명사형
export const STAFF_COPY: Copy = {
  codes: { INVALID_CREDENTIALS: '아이디 또는 비밀번호가 맞지 않습니다' },
  unlockAt: (time) => `${time} 이후 다시 로그인 가능`,
}
