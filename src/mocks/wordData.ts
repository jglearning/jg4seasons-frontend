import type { components } from '../api/generated/schema'

// S-06·S-06b 목: 단어(03 §2.4)와 카드·학습 결과 저장(2.5).
// 단어·뜻·예문·해석은 lessonData.ts의 지어낸 지문에 맞춰 지어낸 것(교재 단어장을 공개 저장소에 넣지 않는다).
// 지문별 단어 수(10·9·10·9·9·10)만 개발용 데이터(L2-B1-05)를 따른다. 음원은 브라우저 안에서 만든 짧은 무음 WAV

type Schemas = components['schemas']
type Pos = Schemas['WordItem']['pos']

/** [영어, 뜻, 품사, 예문, 예문 해석] — 지문 1~6 순서 */
const WORDS: Array<[number, string, string, Pos, string, string]> = [
  [
    1,
    'chat',
    '수다를 떨다',
    'v',
    'We chat after lunch every day.',
    '우리는 매일 점심 뒤에 수다를 떤다.',
  ],
  [
    1,
    'quiet',
    '조용한',
    'adj',
    'The library is quiet in the morning.',
    '도서관은 아침에 조용하다.',
  ],
  [1, 'weather', '날씨', 'n', 'The weather was warm all week.', '일주일 내내 날씨가 따뜻했다.'],
  [1, 'suddenly', '갑자기', 'adv', 'The lights suddenly went out.', '불이 갑자기 꺼졌다.'],
  [
    1,
    'attention',
    '주의, 집중',
    'n',
    'Please pay attention to the board.',
    '칠판에 집중해 주세요.',
  ],
  [
    1,
    'conversation',
    '대화',
    'n',
    'We had a long conversation on the bus.',
    '우리는 버스에서 긴 대화를 나눴다.',
  ],
  [1, 'limit', '한계', 'n', 'Every runner has a limit.', '모든 달리기 선수에게는 한계가 있다.'],
  [
    1,
    'compete',
    '경쟁하다',
    'v',
    'Two teams compete for the cup.',
    '두 팀이 우승컵을 두고 경쟁한다.',
  ],
  [1, 'practice', '연습', 'n', 'Practice makes the piano easier.', '연습하면 피아노가 쉬워진다.'],
  [1, 'automatic', '자동의', 'adj', 'The door is automatic.', '그 문은 자동이다.'],
  [2, 'ring', '고리, 테', 'n', 'She wore a silver ring.', '그녀는 은반지를 꼈다.'],
  [2, 'bark', '나무껍질', 'n', 'The bark of the tree was rough.', '그 나무의 껍질은 거칠었다.'],
  [
    2,
    'pale',
    '옅은, 창백한',
    'adj',
    'He looked pale after the race.',
    '그는 경주 뒤에 창백해 보였다.',
  ],
  [2, 'thin', '얇은', 'adj', 'This paper is very thin.', '이 종이는 아주 얇다.'],
  [2, 'compare', '비교하다', 'v', 'Compare the two pictures.', '두 그림을 비교해 보세요.'],
  [2, 'valley', '골짜기', 'n', 'A river runs through the valley.', '강이 골짜기를 따라 흐른다.'],
  [
    2,
    'drought',
    '가뭄',
    'n',
    'The drought lasted two summers.',
    '가뭄이 두 해 여름 동안 이어졌다.',
  ],
  [2, 'climate', '기후', 'n', 'The climate here is mild.', '이곳의 기후는 온화하다.'],
  [2, 'slice', '조각', 'n', 'Can I have a slice of bread?', '빵 한 조각 먹어도 될까요?'],
  [3, 'early', '이른', 'adj', 'We had an early dinner.', '우리는 이른 저녁을 먹었다.'],
  [3, 'crop', '농작물', 'n', 'Rice is the main crop here.', '쌀이 이곳의 주요 농작물이다.'],
  [
    3,
    'save',
    '구하다, 지키다',
    'v',
    'They worked hard to save the trees.',
    '그들은 나무를 지키려고 열심히 일했다.',
  ],
  [3, 'wrap', '감싸다', 'v', 'Wrap the gift in red paper.', '선물을 빨간 종이로 감싸세요.'],
  [3, 'straw', '짚', 'n', 'The roof was made of straw.', '지붕은 짚으로 만들어졌다.'],
  [3, 'barn', '헛간', 'n', 'The cows sleep in the barn.', '소들은 헛간에서 잔다.'],
  [3, 'warmth', '따뜻함', 'n', 'I felt the warmth of the fire.', '나는 불의 따뜻함을 느꼈다.'],
  [3, 'freeze', '얼다', 'v', 'Water will freeze tonight.', '오늘 밤 물이 얼 것이다.'],
  [
    3,
    'stove',
    '난로',
    'n',
    'Grandma cooks on an old stove.',
    '할머니는 오래된 난로에서 요리하신다.',
  ],
  [3, 'ahead', '미리, 앞으로', 'adv', 'Plan ahead for the trip.', '여행을 미리 계획하세요.'],
  [4, 'quick', '빠른', 'adj', 'She gave a quick answer.', '그녀는 빠르게 대답했다.'],
  [
    4,
    'classmate',
    '반 친구',
    'n',
    'My classmate lent me a pen.',
    '반 친구가 내게 펜을 빌려주었다.',
  ],
  [4, 'bright', '밝은', 'adj', 'The room has bright walls.', '그 방은 벽이 밝다.'],
  [
    4,
    'pattern',
    '무늬, 패턴',
    'n',
    'I like the pattern on your shirt.',
    '네 셔츠의 무늬가 마음에 들어.',
  ],
  [
    4,
    'tiny',
    '아주 작은',
    'adj',
    'A tiny bird sat on the fence.',
    '아주 작은 새가 울타리에 앉았다.',
  ],
  [4, 'triangle', '삼각형', 'n', 'Draw a triangle on the page.', '종이에 삼각형을 그리세요.'],
  [4, 'surprised', '놀란', 'adj', 'We were surprised by the snow.', '우리는 눈을 보고 놀랐다.'],
  [4, 'realize', '깨닫다', 'v', 'I did not realize it was late.', '나는 늦은 줄 몰랐다.'],
  [
    4,
    'subject',
    '과목',
    'n',
    'Science is my favorite subject.',
    '과학은 내가 가장 좋아하는 과목이다.',
  ],
  [
    5,
    'owner',
    '주인',
    'n',
    'The owner opened the shop at nine.',
    '주인이 아홉 시에 가게 문을 열었다.',
  ],
  [5, 'decide', '결정하다', 'v', 'We decided to walk home.', '우리는 걸어서 집에 가기로 했다.'],
  [5, 'free', '무료의', 'adj', 'The museum is free on Sundays.', '박물관은 일요일에 무료다.'],
  [
    5,
    'welcome',
    '환영받는',
    'adj',
    'New students are always welcome.',
    '새 학생은 언제나 환영이다.',
  ],
  [5, 'corner', '모퉁이', 'n', 'The bakery is on the corner.', '빵집은 모퉁이에 있다.'],
  [5, 'busy', '바쁜, 붐비는', 'adj', 'The station is busy at night.', '역은 밤에 붐빈다.'],
  [5, 'customer', '손님', 'n', 'The first customer bought a cake.', '첫 손님이 케이크를 샀다.'],
  [5, 'simply', '그저, 단순히', 'adv', 'He simply wanted to rest.', '그는 그저 쉬고 싶었다.'],
  [5, 'favor', '호의', 'n', 'Can you do me a favor?', '부탁 하나 들어줄래?'],
  [6, 'price', '가격', 'n', 'The price of apples went up.', '사과 가격이 올랐다.'],
  [6, 'fuel', '연료', 'n', 'The car needs more fuel.', '그 차는 연료가 더 필요하다.'],
  [6, 'expensive', '비싼', 'adj', 'This jacket is too expensive.', '이 재킷은 너무 비싸다.'],
  [6, 'ticket', '표', 'n', 'I bought a train ticket.', '나는 기차표를 샀다.'],
  [6, 'goods', '상품', 'n', 'The truck carries goods to the city.', '트럭이 상품을 도시로 나른다.'],
  [6, 'bill', '청구서, 요금', 'n', 'The phone bill came today.', '오늘 전화 요금 청구서가 왔다.'],
  [6, 'raise', '올리다', 'v', 'Raise your hand to ask.', '질문하려면 손을 드세요.'],
  [6, 'neighbor', '이웃', 'n', 'Our neighbor has a big dog.', '우리 이웃은 큰 개를 키운다.'],
  [6, 'habit', '습관', 'n', 'Reading is a good habit.', '독서는 좋은 습관이다.'],
  [6, 'closely', '자세히', 'adv', 'Watch the bird closely.', '새를 자세히 보세요.'],
]

const audioUrls = new Map<number, string>()

/** 브라우저(dev:mock)에서는 짧은 무음 WAV blob URL, 테스트에서는 `/mock-audio/word-{ms}.wav` 글자 */
function mockAudioUrl(durationMs: number): string {
  const cached = audioUrls.get(durationMs)
  if (cached) return cached
  let url = `/mock-audio/word-${durationMs}.wav`
  if (import.meta.env.MODE !== 'test' && typeof URL.createObjectURL === 'function') {
    const samples = Math.round((8000 * durationMs) / 1000)
    const buffer = new ArrayBuffer(44 + samples)
    const view = new DataView(buffer)
    const text = (offset: number, value: string) =>
      [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
    text(0, 'RIFF')
    view.setUint32(4, 36 + samples, true)
    text(8, 'WAVE')
    text(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, 8000, true)
    view.setUint32(28, 8000, true)
    view.setUint16(32, 1, true)
    view.setUint16(34, 8, true)
    text(36, 'data')
    view.setUint32(40, samples, true)
    new Uint8Array(buffer, 44).fill(128)
    url = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
  }
  audioUrls.set(durationMs, url)
  return url
}

export const WORD_MOCK = {
  total: WORDS.length,
  english: (order: number) => WORDS[order - 1][1],
  korean: (order: number) => WORDS[order - 1][2],
  /** 서버가 받은 결과(모드별 최고, 단조 증가) */
  study: { cardsViewed: 0, memKnown: 0, recallBest: 0, spellBest: 0 },
}

export function resetWordMock() {
  WORD_MOCK.study = { cardsViewed: 0, memKnown: 0, recallBest: 0, spellBest: 0 }
}

export function buildWords(): Schemas['LessonWordsResponse'] {
  return {
    items: WORDS.map(([passageNo, english, korean, pos, example, exampleKo], i) => ({
      id: 501 + i,
      order: i + 1,
      passageNo,
      english,
      korean,
      pos,
      example,
      exampleKo,
      audio: { trackId: 9201 + i, audioUrl: mockAudioUrl(900), durationMs: 900 },
      exampleAudio: { trackId: 9301 + i, audioUrl: mockAudioUrl(2400), durationMs: 2400 },
    })),
    total: WORDS.length,
  }
}

/** 2.5: 작은 값은 무시(단조 증가) */
export function recordWordStudy(body: Schemas['WordStudyRequest']): Schemas['WordStudyResponse'] {
  const s = WORD_MOCK.study
  s.cardsViewed = Math.min(Math.max(s.cardsViewed, body.cardsViewed ?? 0), WORDS.length)
  s.memKnown = Math.min(Math.max(s.memKnown, body.memKnown ?? 0), WORDS.length)
  s.recallBest = Math.min(Math.max(s.recallBest, body.recallCorrect ?? 0), WORDS.length)
  s.spellBest = Math.min(Math.max(s.spellBest, body.spellCorrect ?? 0), WORDS.length)
  return { ...s, allViewed: s.cardsViewed >= WORDS.length }
}
