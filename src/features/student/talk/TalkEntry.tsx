import { useQuery } from '@tanstack/react-query'
import { MessageCircle } from 'lucide-react'
import { ActionRow } from '../../../shared/ui/ActionRow'
import { talkConfigQuery } from './talkApi'
import styles from './Talk.module.css'

// S-03 홈의 프리토킹 진입 줄 — 단어시험 진입 줄 아래(같은 모양). 설정 조회(GET /talk/config)가 200일 때만 보인다.
// 기능 꺼짐(404 FEATURE_DISABLED)·불러오는 중·조회 실패·끊김은 숨긴다(홈의 다른 부분은 그대로, 오류 안내 없음).
// 구독이 없어도(entitled: false) 보인다 — 들어가면 잠금 화면
export function TalkEntry() {
  const config = useQuery(talkConfigQuery())
  if (!config.isSuccess) return null
  const { entitled, remainingToday } = config.data
  const detail = !entitled
    ? '구독하면 캐릭터와 말할 수 있어요'
    : remainingToday > 0
      ? `오늘 ${remainingToday}번 더 할 수 있어요`
      : '오늘은 세 번 다 했어요'
  return (
    <ActionRow
      to="/talk"
      icon={<MessageCircle size={24} strokeWidth={2} className={styles.entryIcon} />}
      title="프리토킹"
      detail={detail}
    />
  )
}
