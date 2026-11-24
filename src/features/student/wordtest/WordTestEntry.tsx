import { useQuery } from '@tanstack/react-query'
import { Camera } from 'lucide-react'
import { ActionRow } from '../../../shared/ui/ActionRow'
import { latestQuery, SECTION_SPELLING, type WordTestSubmission } from './wordTestApi'
import styles from './WordTest.module.css'
import { COPY } from './wordTestCopy'

// S-03 홈 "오늘 단어" 아래 단어시험 진입 줄(#173). 회차는 서버가 준 오늘 단어 회차.
// 회차의 최근 제출 조회(GET /word-tests/lessons/{lessonCode}/latest)가 200·204일 때만 보인다 —
// 불러오는 중·기능 꺼짐(404 FEATURE_DISABLED)·시험지 없음(404)·
// 사용 기간 아님(403)·잠김(423)·5xx·끊김은 모두 숨긴다. 배포 전 운영은 code 없는 404를 주므로 코드로 가르지 않는다.
// 숨길 때 홈의 다른 부분은 그대로(오류 안내를 띄우지 않는다)
export function WordTestEntry({ lessonCode }: { lessonCode: string }) {
  const latest = useQuery(latestQuery(lessonCode, SECTION_SPELLING))
  if (!latest.isSuccess) return null
  return (
    <ActionRow
      to={`/lessons/${lessonCode}/word-test`}
      icon={<Camera size={24} strokeWidth={2} className={styles.entryIcon} />}
      title={COPY.title}
      detail={entryDetail(latest.data)}
    />
  )
}

/** 보조 글 — 최근 제출의 서버 상태·점수를 보여 주기만 한다. 제출 화면(StatusView)과 같은 갈래 */
function entryDetail(latest: WordTestSubmission | null): string {
  if (latest === null) return COPY.entryNew
  switch (latest.status) {
    case 'graded':
      // 점수 없는 graded(계약 밖)는 제출 화면이 확인 안내로 받으므로 같은 글
      return latest.score === null
        ? COPY.held
        : `${COPY.scoreLabel} ${latest.score} / ${latest.total}`
    case 'pending':
    case 'grading':
      return COPY.grading
    case 'failed':
      return COPY.failed
    default:
      return COPY.held
  }
}
