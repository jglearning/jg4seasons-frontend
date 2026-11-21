import { useState } from 'react'
import { ApiError } from '../../api/errors'
import {
  loadStateOf,
  RETRY_STATUS,
  useServerErrorLog,
  WAIT_ICON,
  type LoadQuery,
  type LoadState,
} from '../../shared/loadState'
import { Button, ButtonLink } from '../../shared/ui/Button'
import { StatusPanel } from '../../shared/ui/StatusPanel'
import styles from './Words.module.css'

// 단어를 못 받았을 때 — S-05 받기 전 화면과 같은 상태 안내(#154, 명세 S04_S05_빈상태 §2).
// 상태 안내는 카드 자리 가운데, 버튼은 평소 단어 듣기·이전·다음이 있는 아래 자리.
// 끊김·서버 오류는 주 버튼 "다시 시도", 잠김·사용 기간·그 밖 4xx는 흰 버튼 "회차 목록으로".
// 처음 불러오는 중은 그리지 않는다(S-06 뼈대 디자인 없음), 401은 세션 만료 이동이 맡는다

type Shown = { state: Exclude<LoadState, 'loading' | 'none'>; error: unknown }

export function WordsLoadState({ query }: { query: LoadQuery }) {
  const current = loadStateOf(query)
  // "다시 시도"로 다시 받는 동안 TanStack Query는 데이터가 없던 쿼리의 오류를 지우고 pending으로 돌린다.
  // 그동안 직전 안내를 그대로 두고 버튼만 막는다 — 화면이 비거나 포커스를 잃지 않게.
  // (S-05는 같은 때 뼈대를 보이는 디자인이라 공용 판정은 그대로)
  const [last, setLast] = useState<Shown | null>(null)
  if (current !== 'loading' && current !== 'none') {
    if (last?.state !== current || last.error !== query.error) {
      setLast({ state: current, error: query.error })
    }
  }
  const retrying = current === 'loading' && last !== null
  const shown: Shown | null =
    current !== 'loading' && current !== 'none'
      ? { state: current, error: query.error }
      : retrying
        ? last
        : null
  useServerErrorLog(current, query.error)

  if (shown === null) return null
  const { state, error } = shown

  if (state === 'offline' || state === 'server') {
    return (
      <>
        <div className={styles.load}>
          <StatusPanel tone="bad" role="alert" {...RETRY_STATUS[state]} />
        </div>
        {/* disabled는 포커스를 버튼에서 빼 버린다 — aria-disabled로 막고 클릭을 무시해 포커스를 남긴다 */}
        <Button
          block
          aria-disabled={retrying || undefined}
          onClick={() => {
            if (!retrying) void query.refetch()
          }}
        >
          다시 시도
        </Button>
      </>
    )
  }
  const problem = error instanceof ApiError ? error : undefined
  return (
    <>
      <div className={styles.load}>
        <StatusPanel
          icon={WAIT_ICON[state]}
          tone="muted"
          role="status"
          title={problem?.title ?? ''}
          detail={problem?.detail}
        />
      </div>
      <ButtonLink to="/lessons" variant="secondary" block>
        회차 목록으로
      </ButtonLink>
    </>
  )
}
