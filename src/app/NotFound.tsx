import { Link } from 'react-router'
import styles from './NotFound.module.css'

export function NotFound() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>페이지를 찾을 수 없어요</h1>
      <p className={styles.body}>주소를 다시 확인해 주세요.</p>
      <Link to="/" className={styles.link}>
        처음으로
      </Link>
    </main>
  )
}
