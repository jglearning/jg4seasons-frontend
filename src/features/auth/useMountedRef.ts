import { useEffect, useRef } from 'react'

// 비동기 응답이 온 뒤 화면이 아직 있는지(로그인 성공 뒤 이동할지) 본다.
// StrictMode는 effect를 정리 → 다시 실행하므로, 실행 때 true로 되돌린다
export function useMountedRef() {
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  return mounted
}
