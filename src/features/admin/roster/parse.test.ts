import { describe, expect, it } from 'vitest'
import { guessRoles, looksLikeHeader, parseTable } from './parse'

describe('parseTable — 붙여넣은 글자를 줄·칸으로', () => {
  it('탭으로 나눈 표(엑셀·구글 시트 복사), 줄 번호는 붙여넣은 글의 1부터', () => {
    expect(parseTable('반\t이름\n겨울 그린 A\t김하늘\r\n겨울 그린 A\t이도윤')).toEqual([
      { line: 1, cells: ['반', '이름'] },
      { line: 2, cells: ['겨울 그린 A', '김하늘'] },
      { line: 3, cells: ['겨울 그린 A', '이도윤'] },
    ])
  })

  it('탭이 없으면 쉼표로 나눈다(메모장의 CSV)', () => {
    expect(parseTable('김하늘,A중,중1\n이도윤,B중,중2')).toEqual([
      { line: 1, cells: ['김하늘', 'A중', '중1'] },
      { line: 2, cells: ['이도윤', 'B중', '중2'] },
    ])
  })

  it('탭이 하나라도 있으면 탭 기준 — 칸 안 쉼표는 글자 그대로', () => {
    expect(parseTable('김하늘\t서울, A중\n이도윤\tB중')).toEqual([
      { line: 1, cells: ['김하늘', '서울, A중'] },
      { line: 2, cells: ['이도윤', 'B중'] },
    ])
  })

  it('따옴표로 감싼 칸: 칸 안 줄바꿈·구분자·"" 이스케이프. 줄 번호는 표의 줄(글의 물리 줄이 아님)', () => {
    const text = '"김\n하늘"\t"A중, 본관"\n"이""도윤"\tB중\n박서아\tC중'
    expect(parseTable(text)).toEqual([
      { line: 1, cells: ['김\n하늘', 'A중, 본관'] },
      { line: 2, cells: ['이"도윤', 'B중'] },
      { line: 3, cells: ['박서아', 'C중'] },
    ])
  })

  it('칸 중간의 따옴표는 글자 그대로', () => {
    expect(parseTable('김"하늘\tA중')).toEqual([{ line: 1, cells: ['김"하늘', 'A중'] }])
  })

  it('닫히지 않은 따옴표는 그 줄 끝까지만 글자로 — 뒤 줄을 삼키지 않는다', () => {
    expect(parseTable('"김하늘\tA중\n이도윤\tB중')).toEqual([
      { line: 1, cells: ['"김하늘', 'A중'] },
      { line: 2, cells: ['이도윤', 'B중'] },
    ])
  })

  it('앞뒤 공백을 지우고, 빈 줄(칸이 모두 빔)은 빼되 줄 번호는 센다', () => {
    expect(parseTable('  김하늘 \t A중\n\n \t \n이도윤\tB중\n')).toEqual([
      { line: 1, cells: ['김하늘', 'A중'] },
      { line: 4, cells: ['이도윤', 'B중'] },
    ])
  })

  it('줄마다 칸 수가 달라도 가장 많은 칸 수로 맞춘다', () => {
    expect(parseTable('김하늘\tA중\t중1\n이도윤')).toEqual([
      { line: 1, cells: ['김하늘', 'A중', '중1'] },
      { line: 2, cells: ['이도윤', '', ''] },
    ])
  })

  it('빈 글자는 빈 표', () => {
    expect(parseTable('')).toEqual([])
    expect(parseTable(' \n\t\n')).toEqual([])
  })
})

describe('제목 줄과 열 뜻 추정', () => {
  it('제목 글자에 이름·반 같은 말이 있으면 제목 줄', () => {
    expect(looksLikeHeader(['반', '이름', '연락처'])).toBe(true)
    expect(looksLikeHeader(['겨울 그린 A', '김하늘', '010-1234'])).toBe(false)
  })

  it('제목으로 열 뜻: 이름·반·클래스·학교·학년, 그 밖은 쓰지 않음', () => {
    expect(guessRoles(['반', '학생 이름', '학교명', '학년', '연락처'], 5)).toEqual([
      'class',
      'name',
      'school',
      'grade',
      'skip',
    ])
    expect(guessRoles(['클래스', '성명', 'School', 'Grade'], 4)).toEqual([
      'class',
      'name',
      'school',
      'grade',
    ])
    expect(guessRoles(['반 이름', '이름'], 2)).toEqual(['class', 'name'])
  })

  it('이름·반은 한 열에만 — 뒤에 같은 뜻이 또 나오면 쓰지 않음', () => {
    expect(guessRoles(['이름', '보호자 이름', '반'], 3)).toEqual(['name', 'skip', 'class'])
  })

  it('제목이 없으면: 열이 하나면 이름, 여럿이면 모두 쓰지 않음(직접 고름)', () => {
    expect(guessRoles(undefined, 1)).toEqual(['name'])
    expect(guessRoles(undefined, 3)).toEqual(['skip', 'skip', 'skip'])
  })
})
