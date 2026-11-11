import { CalendarX } from 'lucide-react'
import { useId } from 'react'
import type { StudentHome } from './studentApi'
import styles from './Student.module.css'

// S-03·S-04 교재 사용권 안내(BE ADR 0031). 서버 licenseStatus가 active가 아니면 회차를 열 때 403이 오므로 미리 알린다.
// 사용 시작 전·끝남은 학생에게 같은 안내. 회차 타일·버튼은 서버 state 그대로 둔다(날짜로 판단하지 않음)
type LicenseStatus = StudentHome['class']['licenseStatus']

export function LicenseNotice({ status }: { status: LicenseStatus }) {
  const headingId = useId()
  if (status === 'active') return null
  return (
    <section aria-labelledby={headingId} className={styles.notice}>
      <h2 id={headingId} className={styles.noticeTitle}>
        <CalendarX size={20} strokeWidth={2} aria-hidden />
        사용 기간이 아니에요
      </h2>
      <p className={styles.noticeText}>지금은 회차를 열 수 없어요. 선생님께 물어봐 주세요</p>
    </section>
  )
}
