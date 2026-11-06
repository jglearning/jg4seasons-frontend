import type { components } from '../api/generated/schema'

// S-05 목: 회차 상세(03 §2.3 v0.4)·청취 flush(3.1)의 서버 상태를 메모리에 흉내 낸다.
// 지문 제목·문장은 개발용으로 지어낸 글(교재 원문을 공개 저장소에 넣지 않는다). 지문별 문장 수와 문장 길이(ms)만
// 개발용 데이터(L2-B1-05)의 값을 따른다. 음원은 브라우저 안에서 만든 무음 WAV.
// 지문 음원 = 문장 파일을 500ms 간격으로 이어 붙인 것(ADR-26). 0.8·1.2는 1.0 시각을 길이 비율로 늘이고 줄인 근사.
// 완료·청취율 계산은 원래 서버 일이다 — 여기서는 화면 확인용으로만 흉내 낸다

type Schemas = components['schemas']
type Detail = Schemas['LessonDetailResponse']
type Passage = Schemas['LessonDetailPassage']
type Variant = Schemas['LessonDetailSpeed']['variant']

const VARIANTS: Array<{ variant: Variant; scale: number; required: boolean }> = [
  { variant: '0.8', scale: 1.25, required: false },
  { variant: '1.0', scale: 1, required: true },
  { variant: '1.2', scale: 1 / 1.2, required: false },
]
const GAP_MS = 500
const THRESHOLD = 0.9

/** 지문별 [문장 글, 문장 길이 ms] — 길이는 개발용 데이터 값 */
const PASSAGES: Array<{ title: string; sentences: Array<[string, number]> }> = [
  {
    title: 'Talking While Driving',
    sentences: [
      ['Many people chat with friends while they drive on a quiet road.', 8825],
      ['When the weather turns bad, most drivers suddenly stop talking.', 8495],
      ['Their attention moves from the conversation to the road ahead.', 8110],
      ['This shows that our attention has limits.', 8440],
      ['Some pairs of tasks are easy to do at the same time.', 8055],
      ["Walking and humming a song rarely get in each other's way.", 9210],
      ['Other pairs, like reading and listening to a story, are much harder.', 8495],
      ['The two tasks compete for the same part of the mind.', 8935],
      ['With practice, one task can become almost automatic.', 8880],
      ['Then the mind has more room for the other task.', 7890],
    ],
  },
  {
    title: 'What Tree Rings Tell Us',
    sentences: [
      ['Every year, a tree adds a new ring under its bark.', 8770],
      ['In a wet year, the ring grows wide and pale.', 11025],
      ['In a dry year, the ring stays thin and dark.', 9155],
      ["Scientists count the rings to learn a tree's age.", 6350],
      ['They also compare rings from many trees in the same valley.', 10255],
      ['Long rows of thin rings point to years without much rain.', 8000],
      ['Some old trees remember droughts from hundreds of years ago.', 8825],
      ['These records help us understand how the climate has changed.', 8825],
      ['A single slice of wood can hold a long story.', 8715],
    ],
  },
  {
    title: 'A Hard Winter on the Farm',
    sentences: [
      ['The winter came early to the small farm on the hill.', 8660],
      ['Snow covered the fields before the last crops were in.', 9870],
      ['The farmer and her son worked late to save what they could.', 7890],
      ['They wrapped the young trees in straw to keep them warm.', 7945],
      ['At night, the wind made the old barn creak and shake.', 9815],
      ['The animals stayed close together for warmth.', 7395],
      ['Water in the buckets froze by morning.', 8770],
      ['Still, the family kept the stove burning all day.', 8990],
      ['When spring finally arrived, the trees were alive.', 7725],
      ['The hard winter had taught them to plan ahead.', 7285],
    ],
  },
  {
    title: 'Mina Paints and Counts',
    sentences: [
      ['Mina was known at school for her quick math answers.', 8770],
      ['Few classmates knew that she also loved to paint.', 7670],
      ['On weekends, she filled her notebook with bright pictures.', 8715],
      ['She often used shapes and patterns from her math lessons.', 8605],
      ['One day, her teacher saw a painting made of tiny triangles.', 8990],
      ['He asked Mina to share it with the whole class.', 7945],
      ['The students were surprised by how beautiful the numbers looked.', 8165],
      ['Mina realized that math and art could work together.', 10255],
      ['Today, she teaches both subjects to young children.', 10365],
    ],
  },
  {
    title: 'Tea on Rainy Days',
    sentences: [
      ['A small shop owner decided to give free tea on rainy days.', 8000],
      ['It cost her a little money, but it made people smile.', 8605],
      ['Customers waiting for the rain to stop felt welcome.', 7670],
      ['Many of them came back later to buy something.', 8660],
      ['They told their friends about the kind shop on the corner.', 11025],
      ['Soon the shop was busy even on sunny days.', 8330],
      ['The owner had not planned to win new customers.', 9430],
      ['She simply wanted to help people who were cold and wet.', 8660],
      ['Her small favor turned into a big reason to return.', 9045],
    ],
  },
  {
    title: 'When Fuel Costs Go Up',
    sentences: [
      ['When the price of fuel goes up, many things change.', 8770],
      ['Driving to work becomes more expensive for families.', 8330],
      ['Bus and train tickets may cost more as well.', 8220],
      ['Companies that move goods by truck pay higher bills.', 9705],
      ['Some of them raise the prices of the things they sell.', 6900],
      ['People start to look for ways to save money.', 9815],
      ['Some ride bikes, and others share cars with neighbors.', 7505],
      ['When prices fall again, these habits sometimes stay.', 7615],
      ['A change in one price can touch many parts of daily life.', 8000],
      ['That is why people watch fuel prices so closely.', 10970],
    ],
  },
]

/** 홈 목(S-03)의 오늘 회차 지문 제목도 이것을 쓴다 */
export const PASSAGE_TITLES = PASSAGES.map((p) => p.title)

/** 문장 길이를 간격을 두고 이어 붙인 문장 시각 [startMs, endMs] — 속도별로 비율만큼 늘이고 줄인다 */
function timingsOf(no: number, scale: number): number[][] {
  let at = 0
  return PASSAGES[no - 1].sentences.map(([, ms]) => {
    const start = Math.round(at * scale)
    const end = Math.round((at + ms) * scale)
    at += ms + GAP_MS
    return [start, end]
  })
}

const durationOf = (no: number, scale: number) => timingsOf(no, scale).at(-1)?.[1] ?? 0
const passageTrackId = (no: number, index: number) => 9000 + no * 10 + index

// ── 서버 상태 흉내 ──
type TrackInfo = { durationMs: number; ranges: Array<[number, number]> }
const tracks = new Map<number, TrackInfo>()

export function resetLessonMock() {
  tracks.clear()
  PASSAGES.forEach((_, p) => {
    const no = p + 1
    VARIANTS.forEach(({ scale }, index) => {
      const durationMs = durationOf(no, scale)
      const required = index === 1
      // 지문 1~4는 필수(1.0) 트랙을 이미 다 들었다(홈 목의 "지문 듣기 4 / 6"과 맞춤),
      // 지문 5는 1.0에서 문장 1~3만 들었다(완료 전 안내 카드 확인용)
      let ranges: Array<[number, number]> = []
      if (required && no <= 4) ranges = [[0, durationMs]]
      if (required && no === 5) ranges = [[0, timingsOf(5, 1)[2][1]]]
      tracks.set(passageTrackId(no, index), { durationMs, ranges })
    })
  })
}
resetLessonMock()

function coverage(info: TrackInfo) {
  const listened = info.ranges.reduce((sum, [a, b]) => sum + (b - a), 0)
  return Math.min(listened / info.durationMs, 1)
}

function merge(ranges: Array<[number, number]>) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const out: Array<[number, number]> = []
  for (const [a, b] of sorted) {
    const last = out[out.length - 1]
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

// ── 무음 음원 ──
const audioUrls = new Map<number, string>()

/** 브라우저(dev:mock)에서는 무음 WAV blob URL, 테스트에서는 `/mock-audio/{ms}.wav` 글자 */
function mockAudioUrl(durationMs: number): string {
  const cached = audioUrls.get(durationMs)
  if (cached) return cached
  let url = `/mock-audio/${durationMs}.wav`
  // 테스트(Node)에서는 재생하지 않으니 주소 글자만 — 어떤 파일이 올라갔는지 테스트가 볼 수 있게
  if (import.meta.env.MODE !== 'test' && typeof URL.createObjectURL === 'function') {
    url = URL.createObjectURL(silentWav(durationMs))
  }
  audioUrls.set(durationMs, url)
  return url
}

function silentWav(durationMs: number): Blob {
  const sampleRate = 8000
  const samples = Math.round((sampleRate * durationMs) / 1000)
  const buffer = new ArrayBuffer(44 + samples)
  const view = new DataView(buffer)
  const text = (offset: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true) // 8-bit
  text(36, 'data')
  view.setUint32(40, samples, true)
  new Uint8Array(buffer, 44).fill(128) // 8-bit 무음
  return new Blob([buffer], { type: 'audio/wav' })
}

// ── 응답 만들기 ──
const variantIndex = (variant: Variant) => VARIANTS.findIndex((v) => v.variant === variant)

export const LESSON_MOCK = {
  code: 'L2-B1-05',
  number: 5,
  /** 열 수 있는 회차(목) — 그 밖은 잠김 423 */
  openCodes: ['L2-B1-01', 'L2-B1-02', 'L2-B1-03', 'L2-B1-04', 'L2-B1-05'],
  level: { code: 'L2', nameKo: '그린', colorHex: '#1F7A4F' },
  title: (no: number) => PASSAGES[no - 1].title,
  sentence: (no: number, s: number) => PASSAGES[no - 1].sentences[s - 1][0],
  passageTrackId: (no: number, variant: Variant) => passageTrackId(no, variantIndex(variant)),
  timings: (no: number, variant: Variant) => timingsOf(no, VARIANTS[variantIndex(variant)].scale),
  durationMs: (no: number, variant: Variant) =>
    durationOf(no, VARIANTS[variantIndex(variant)].scale),
} as const

export function buildLessonDetail(code: string): Detail {
  const number = Number(code.slice(-2))
  const passages: Passage[] = PASSAGES.map((passage, p) => {
    const no = p + 1
    return {
      no,
      title: passage.title,
      wordCount: passage.sentences.reduce((sum, [text]) => sum + text.split(/\s+/).length, 0),
      sentences: passage.sentences.map(([text], s) => ({ no: s + 1, text, speaker: null })),
      speeds: VARIANTS.map(({ variant, scale, required }, index) => {
        const info = tracks.get(passageTrackId(no, index)) as TrackInfo
        const value = coverage(info)
        return {
          trackId: passageTrackId(no, index),
          variant,
          audioUrl: mockAudioUrl(info.durationMs),
          durationMs: info.durationMs,
          required,
          coverage: Math.round(value * 100) / 100,
          completed: value >= THRESHOLD,
          timings: timingsOf(no, scale),
          timingsApproximate: scale !== 1,
          heardRanges: info.ranges.map(([a, b]) => [a, b]),
        }
      }),
    }
  })
  const passagesDone = passages.filter((p) =>
    p.speeds.some((s) => s.required && s.completed),
  ).length
  return {
    lesson: { code, number, title: `Reading Day ${number}`, type: 'regular' },
    // 반 레벨 색(BE #18) — 홈 목(studentData)의 그린과 같은 값
    level: LESSON_MOCK.level,
    completion: {
      status:
        passagesDone === passages.length
          ? 'completed'
          : passagesDone > 0
            ? 'in_progress'
            : 'not_started',
      passagesDone,
      passagesTotal: passages.length,
      threshold: THRESHOLD,
    },
    passages,
    words: { total: 57, memKnown: 0 },
  }
}

export function recordFlush(body: Schemas['FlushRequest']): Schemas['FlushResponse'] | undefined {
  const info = tracks.get(body.trackId)
  if (info === undefined) return undefined
  // 서버처럼: 한 요청에 50개까지, 나머지는 버리고 dropped로 알린다(03 §3.1)
  const accepted = body.segments.slice(0, 50)
  const valid = accepted.filter(
    (s) =>
      s.startMs >= 0 &&
      s.endMs > s.startMs &&
      s.endMs <= info.durationMs + 1000 &&
      s.endMs - s.startMs <= 60_000,
  )
  const dropped = body.segments.length - valid.length
  info.ranges = merge([
    ...info.ranges,
    ...valid.map((s): [number, number] => [s.startMs, Math.min(s.endMs, info.durationMs)]),
  ])
  const detail = buildLessonDetail(LESSON_MOCK.code)
  const value = coverage(info)
  return {
    track: {
      trackId: body.trackId,
      coverage: Math.round(value * 100) / 100,
      completed: value >= THRESHOLD,
    },
    lesson: {
      code: LESSON_MOCK.code,
      status: detail.completion.status,
      requiredDone: detail.completion.passagesDone,
      requiredTotal: detail.completion.passagesTotal,
    },
    dropped,
  }
}
