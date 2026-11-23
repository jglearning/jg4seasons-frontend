import { useCallback, useState } from 'react'
import { flushSync } from 'react-dom'
import { useQrLibrary, type QrLibrary } from '../../shared/ui/useQrLibrary'

// 학생 카드 인쇄(CodeCards의 PrintSheets와 같이 쓴다). 반이 여럿이면(A-05) 한 반만 골라 인쇄할 수 있다 —
// 그 묶음만 그린 뒤 print(), 인쇄 창이 닫히면(afterprint) 다시 모두

export type CardPrint = {
  qr: QrLibrary
  /** QR을 불러오는 동안은 false — QR 없는 카드가 인쇄되지 않게 */
  ready: boolean
  /** 이 묶음만 인쇄 중(없으면 모두) */
  only: number | undefined
  /** key를 주면 그 묶음만, 없으면 모든 묶음 */
  print: (key?: number) => void
}

export function useCardPrint(): CardPrint {
  const qr = useQrLibrary()
  const [only, setOnly] = useState<number | undefined>(undefined)
  const print = useCallback((key?: number) => {
    // 인쇄 창이 뜨기 전에 고른 묶음만 그려져 있어야 한다
    flushSync(() => setOnly(key))
    if (key !== undefined) {
      window.addEventListener('afterprint', () => setOnly(undefined), { once: true })
    }
    window.print()
  }, [])
  return { qr, ready: qr.status !== 'loading', only, print }
}
