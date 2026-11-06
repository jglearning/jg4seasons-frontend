import { useRouteError } from 'react-router'
import { Button } from '../shared/ui/Button'
import styles from './NotFound.module.css'

// 화면을 그리다 예상하지 못한 오류가 나면(예: 계약에 없는 응답 값) React Router 기본 영어 화면 대신 이것.
// 원인을 찾을 수 있게 오류만 콘솔에 남긴다(오류 객체에 개인 코드·이름은 없다)
export function RouteError() {
  const error = useRouteError()
  console.error('[route]', error)
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>문제가 생겼어요</h1>
      <p className={styles.body}>잠시 후 다시 시도해 주세요.</p>
      <Button variant="secondary" onClick={() => window.location.reload()}>
        다시 시도
      </Button>
    </main>
  )
}
