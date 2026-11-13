import { useEffect, useState } from 'react'
import type { create as createQr } from 'qrcode'

// qrcode 라이브러리는 쓰는 화면에서만 불러온다(동적 import) — 학생 화면 묶음에 들어가지 않게(#38, #71).
// 그리기는 QrCode.tsx의 QrSvg

export type QrLibrary =
  { status: 'loading' } | { status: 'ready'; create: typeof createQr } | { status: 'failed' }

/** qrcode를 불러온다. 실패하면 'failed' — 부르는 쪽이 QR 없이 글자로 보여 준다 */
export function useQrLibrary(): QrLibrary {
  const [state, setState] = useState<QrLibrary>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    import('qrcode').then(
      (mod) => alive && setState({ status: 'ready', create: mod.create }),
      () => alive && setState({ status: 'failed' }),
    )
    return () => {
      alive = false
    }
  }, [])
  return state
}
