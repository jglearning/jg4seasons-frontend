// 단어시험(제출·결과 화면, 홈 진입 줄)의 문구와 시간(#171·#173). 화면 파일은 컴포넌트만 내보낸다(fast refresh)

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
  // 결과(#173)
  unclearNote: (n: number) => `잘 안 보인 글자 ${n}개는 선생님이 확인해요`,
  allCorrect: '모두 맞았어요',
  mine: '내가 쓴 것',
  answer: '정답',
  blank: '안 썼어요',
  unclearItem: '선생님이 확인해요',
  correctHidden: '눌러서 보기',
  reviewWords: '틀린 단어 다시 보기',
  retry: '다시 풀고 올리기',
  footnote: '시험 삼아 여는 기능이에요. 채점이 틀리면 선생님께 말해요',
  // 홈 진입 줄(#173) — 최근 제출이 없을 때의 보조 글
  entryNew: '책을 찍어 올리면 채점해 줘요',
} as const
