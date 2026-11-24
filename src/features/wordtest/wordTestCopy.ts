// 단어시험 제출 화면의 문구와 시간(#171). 화면 파일은 컴포넌트만 내보낸다(fast refresh)

/** 채점 상태 조회 간격 */
export const POLL_MS = 2000
/** 이만큼 지나도 채점 중이면 안내 문구를 바꾼다 */
export const SLOW_MS = 60_000

export const COPY = {
  title: '철자 쓰기 제출',
  guide: ['책의 B 철자 쓰기 쪽을 찍어요', '쪽 전체가 보이게 찍어요', '밝은 곳에서 찍어요'],
  take: '답안지 찍기',
  retake: '다시 찍기',
  send: '채점 받기',
  sendFailed: '올리지 못했어요. 다시 해 봐요',
  badImage: '사진을 쓸 수 없어요. 다시 찍어 봐요',
  dailyLimit: '오늘은 세 번 다 올렸어요',
  grading: '채점하고 있어요',
  gradingDetail: '보통 10초쯤 걸려요',
  gradingSlow: '조금 더 걸리고 있어요. 나갔다가 다시 와도 돼요',
  held: '선생님이 확인하고 있어요',
  heldDetail: '나중에 다시 와서 결과를 봐요',
  failed: '채점하지 못했어요',
  failedDetail: '잠시 뒤에 다시 해 봐요',
  scoreLabel: '철자 쓰기',
  home: '홈으로',
} as const
