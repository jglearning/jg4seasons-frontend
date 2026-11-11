import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { ApiError } from '../../api/errors'
import { saveWordStudy, type WordStudy } from './wordsApi'

// 단어 카드 결과 저장(03 §2.5): 본 카드 수(가장 멀리 간 번호)를 모아 두었다가 화면을 떠날 때
// (숨김·pagehide·떠남) keepalive fetch PUT으로 보낸다. 암기·리콜·스펠 칸은 카드 학습 삭제(#64)로 보내지 않는다.
// 서버는 작은 값을 무시하므로(단조 증가) 보낸 것보다 커진 칸만 보낸다. 학습 기록은 localStorage에 두지 않는다(1차)
type Field = keyof WordStudy
const FIELDS: Field[] = ['cardsViewed']

export function useStudySaver(code: string) {
  const queryClient = useQueryClient()
  const best = useRef<WordStudy>({})
  const sent = useRef<WordStudy>({})

  /** 이 화면의 결과를 기록(큰 값만 남긴다) — 보내지는 않는다 */
  const record = useCallback((partial: WordStudy) => {
    for (const field of FIELDS) {
      const value = partial[field]
      if (value !== undefined && value > (best.current[field] ?? 0)) best.current[field] = value
    }
  }, [])

  /** 보낸 것보다 커진 칸이 있으면 보낸다 */
  const save = useCallback(
    ({ keepalive = false } = {}) => {
      const body: WordStudy = {}
      for (const field of FIELDS) {
        const value = best.current[field]
        if (value !== undefined && value > (sent.current[field] ?? 0)) body[field] = value
      }
      if (Object.keys(body).length === 0) return
      const before = { ...sent.current }
      Object.assign(sent.current, body)
      saveWordStudy(code, body, { keepalive })
        .then(() => queryClient.invalidateQueries({ queryKey: ['student', 'home'] }))
        .catch((error: unknown) => {
          // 실패하면 다음 저장 때 다시 보내게 되돌린다(그사이 더 큰 값을 보냈으면 그대로)
          for (const field of Object.keys(body) as Field[]) {
            if (sent.current[field] === body[field]) sent.current[field] = before[field]
          }
          console.error('[word-study] 저장 실패', {
            status: error instanceof ApiError ? error.status : undefined,
            code: error instanceof ApiError ? error.code : undefined,
          })
        })
    },
    [code, queryClient],
  )

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') save({ keepalive: true })
    }
    const onPageHide = () => save({ keepalive: true })
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', onPageHide)
      save({ keepalive: true })
    }
  }, [save])

  return { record, save }
}
