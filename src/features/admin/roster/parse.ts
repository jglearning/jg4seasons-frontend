// A-05 명단 가져오기 ①·②: 표 프로그램(엑셀·구글 시트·한셀)에서 복사한 글자를 줄·칸으로 나누고 열 뜻을 추정한다.
// 표 프로그램은 칸을 탭으로, 줄을 줄바꿈으로 복사하고 칸 안에 줄바꿈·따옴표가 있으면 칸을 "…"로 감싼다("" = ").
// 메모장의 CSV도 받도록 탭이 하나도 없으면 쉼표로 나눈다(BE ADR 0036 설계 §4)

export type ParsedRow = {
  /** 붙여넣은 표의 줄 번호(1부터, 빈 줄도 셈) — 화면의 "n번 줄" */
  line: number
  cells: string[]
}

export type ColumnRole = 'name' | 'class' | 'school' | 'grade' | 'skip'

/** 붙여넣은 글자 → 줄(빈 줄 제외). 칸은 앞뒤 공백을 지우고, 칸 수는 가장 긴 줄에 맞춘다 */
export function parseTable(text: string): ParsedRow[] {
  const delimiter = text.includes('\t') ? '\t' : ','
  const records = splitRecords(text.replace(/\r\n?/g, '\n'), delimiter)
  const rows = records
    .map((cells, i) => ({ line: i + 1, cells: cells.map((c) => c.trim()) }))
    .filter((row) => row.cells.some((c) => c !== ''))
  const width = Math.max(0, ...rows.map((r) => r.cells.length))
  return rows.map((r) => ({
    line: r.line,
    cells: [...r.cells, ...Array<string>(width - r.cells.length).fill('')],
  }))
}

function splitRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = []
  let cells: string[] = []
  let i = 0
  // 칸 하나를 읽고 다음 위치를 돌려준다. 끝 = 구분자·줄바꿈·글 끝
  while (i <= text.length) {
    let cell: string
    if (text[i] === '"') {
      const closed = readQuoted(text, i, delimiter)
      if (closed) {
        cell = closed.value
        i = closed.end
      } else {
        // 닫히지 않은 따옴표: 따옴표를 글자로 보고 보통 칸처럼 읽는다(뒤 줄을 삼키지 않게)
        const end = plainEnd(text, i, delimiter)
        cell = text.slice(i, end)
        i = end
      }
    } else {
      const end = plainEnd(text, i, delimiter)
      cell = text.slice(i, end)
      i = end
    }
    cells.push(cell)
    if (i >= text.length) {
      records.push(cells)
      break
    }
    if (text[i] === '\n') {
      records.push(cells)
      cells = []
    }
    i += 1
  }
  // 글 끝의 줄바꿈이 만든 빈 줄 하나는 줄로 세지 않는다
  const last = records[records.length - 1]
  if (records.length > 0 && last?.length === 1 && last[0] === '' && text.endsWith('\n')) {
    records.pop()
  }
  return records
}

function plainEnd(text: string, from: number, delimiter: string): number {
  let i = from
  while (i < text.length && text[i] !== delimiter && text[i] !== '\n') i += 1
  return i
}

/** 따옴표 칸: 닫는 따옴표 바로 뒤가 구분자·줄바꿈·글 끝이어야 칸으로 인정 */
function readQuoted(
  text: string,
  from: number,
  delimiter: string,
): { value: string; end: number } | undefined {
  let value = ''
  let i = from + 1
  while (i < text.length) {
    if (text[i] === '"') {
      if (text[i + 1] === '"') {
        value += '"'
        i += 2
        continue
      }
      const after = text[i + 1]
      if (after === undefined || after === delimiter || after === '\n') {
        return { value, end: i + 1 }
      }
      return undefined
    }
    value += text[i]
    i += 1
  }
  return undefined
}

const EXACT: Record<string, ColumnRole> = {
  이름: 'name',
  성명: 'name',
  학생: 'name',
  학생명: 'name',
  학생이름: 'name',
  name: 'name',
  반: 'class',
  반명: 'class',
  반이름: 'class',
  클래스: 'class',
  class: 'class',
  학교: 'school',
  학교명: 'school',
  school: 'school',
  학년: 'grade',
  grade: 'grade',
}

function roleOf(header: string): ColumnRole {
  const key = header.replace(/\s+/g, '').toLowerCase()
  if (key === '') return 'skip'
  const exact = EXACT[key]
  if (exact) return exact
  if (key.includes('학교')) return 'school'
  if (key.includes('학년')) return 'grade'
  if (key.startsWith('반') || key.includes('클래스')) return 'class'
  if (key.includes('이름') || key.includes('성명')) return 'name'
  return 'skip'
}

/** 첫 줄이 제목 줄로 보이는가 — 열 뜻으로 읽히는 칸이 하나라도 있으면 */
export function looksLikeHeader(cells: string[]): boolean {
  return cells.some((c) => roleOf(c) !== 'skip')
}

/**
 * 열 뜻 추정. 같은 뜻은 한 열에만(앞의 열이 가짐). 제목이 없으면 열이 하나일 때만 이름, 아니면 직접 고르게 모두 쓰지 않음
 */
export function guessRoles(header: string[] | undefined, columnCount: number): ColumnRole[] {
  if (header === undefined) {
    return Array.from({ length: columnCount }, () => (columnCount === 1 ? 'name' : 'skip'))
  }
  const used = new Set<ColumnRole>()
  return Array.from({ length: columnCount }, (_, i) => {
    const role = roleOf(header[i] ?? '')
    if (role === 'skip' || used.has(role)) return 'skip'
    used.add(role)
    return role
  })
}
