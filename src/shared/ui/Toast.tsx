import styles from './Toast.module.css'

// 떠 있는 탭 바 위 한 줄 안내(지시문 §6.4-6, S-04 잠긴 회차 "12/22 (월)에 열려요").
// 모양만 맡는다 — 언제 띄우고 몇 초 뒤 지울지는 부르는 쪽이 message로 정한다(null이면 숨김).
// role="status" 영역은 늘 DOM에 두고 글만 바꾼다 — 영역이 글과 함께 새로 생기면 낭독기가 놓칠 수 있다
type ToastProps = { message: string | null }

export function Toast({ message }: ToastProps) {
  return (
    <div
      className={message === null ? styles.toast : `${styles.toast} ${styles.shown}`}
      role="status"
    >
      {message}
    </div>
  )
}
