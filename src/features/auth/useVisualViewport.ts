import { useEffect, useState } from 'react'

// 화면에서 키보드를 뺀 나머지(visualViewport) — 들어가기 화면은 이 높이의 세로 가운데에 내용을 둔다(지시문 §6.1).
// 폰 키보드가 올라오면 layout viewport는 그대로이고 visualViewport만 줄어든다(iOS). 지원하지 않으면 창 높이
export type ViewportBox = { height: number; top: number }

function read(): ViewportBox {
  const vv = window.visualViewport
  return vv ? { height: vv.height, top: vv.offsetTop } : { height: window.innerHeight, top: 0 }
}

export function useVisualViewport(): ViewportBox {
  const [box, setBox] = useState(read)

  useEffect(() => {
    const vv = window.visualViewport
    const update = () => setBox(read())
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return box
}
