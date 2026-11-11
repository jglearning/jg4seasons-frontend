// 단어 카드(S-06) 표기. 카드 학습(리콜 선택지·스펠 채점·암기 순서)은 11/11 삭제(#64)

/** 품사 표기(03 §2.4 — 표기는 프론트) */
export const POS_LABEL = {
  n: '명사',
  v: '동사',
  adj: '형용사',
  adv: '부사',
  prep: '전치사',
  conj: '접속사',
  pron: '대명사',
  interj: '감탄사',
  phr: '구',
} as const

/** 단어 출처(BE ADR-29): 어휘책 그 강의 단어·숙어 / 어휘책에 없는 회차 어휘. 음원 유무와는 따로다 */
export const SOURCE_LABEL = {
  book: '어휘책',
  extra: '추가 단어',
} as const
