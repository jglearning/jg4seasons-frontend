import { act, render, screen, within } from '@testing-library/react'
import { House, LayoutGrid } from 'lucide-react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { BottomBar, type BottomTab } from './BottomBar'
import { Button } from './Button'
import { HeardBar } from './HeardBar'
import { NumberCircle } from './NumberCircle'
import { PassageTabs } from './PassageTabs'
import { SentenceDots } from './SentenceDots'
import { OverdueAlert } from './OverdueAlert'
import { ProgressBar } from './ProgressBar'
import { levelName, levelProps } from '../level'
import { StatusPill } from './StatusPill'
import { StudentLayout } from './StudentLayout'
import { Table } from './Table'

function inRouter(ui: ReactElement, path = '/') {
  const router = createMemoryRouter(
    [
      { path: '/', element: ui },
      { path: '/lessons', element: ui },
    ],
    { initialEntries: [path] },
  )
  return render(<RouterProvider router={router} />)
}

describe('Table', () => {
  it('center·current 열은 머리글과 칸 모두에 클래스가 붙는다(매트릭스 지금 회차 열)', () => {
    render(
      <Table
        caption="청취 현황"
        columns={[
          { key: 'name', header: '학생', cell: (r: { n: number }) => `학생 ${r.n}` },
          { key: 'day', header: 'Day 5', cell: () => '완료', center: true, current: true },
        ]}
        rows={[{ n: 1 }]}
        rowKey={(r) => r.n}
      />,
    )
    for (const el of [
      screen.getByRole('columnheader', { name: 'Day 5' }),
      screen.getByRole('cell', { name: '완료' }),
    ]) {
      expect(el.className).toMatch(/center/)
      expect(el.className).toMatch(/current/)
    }
    expect(screen.getByRole('columnheader', { name: '학생' })).not.toHaveAttribute('class')
  })

  it('mutedRow가 참인 행에만 흐린 행 클래스가 붙는다', () => {
    render(
      <Table
        caption="진도표"
        columns={[{ key: 'n', header: '회차', cell: (r: { n: number }) => `${r.n}회` }]}
        rows={[{ n: 1 }, { n: 2 }]}
        rowKey={(r) => r.n}
        mutedRow={(r) => r.n === 2}
      />,
    )
    expect(screen.getByRole('row', { name: '1회' })).not.toHaveAttribute('class')
    expect(screen.getByRole('row', { name: '2회' }).className).toMatch(/muted/)
  })
})

describe('ProgressBar', () => {
  it('서버 값을 그대로 aria로 알리고 폭은 비율만큼', () => {
    render(<ProgressBar value={4} max={6} label="지문 듣기" />)
    const bar = screen.getByRole('progressbar', { name: '지문 듣기' })
    expect(bar).toHaveAttribute('aria-valuenow', '4')
    expect(bar).toHaveAttribute('aria-valuemax', '6')
    expect(bar).toHaveAttribute('aria-valuetext', '4 / 6')
    expect((bar.firstElementChild as HTMLElement).style.width).toBe(`${(4 / 6) * 100}%`)
  })

  it('max가 0이거나 값이 넘쳐도 폭·aria-valuenow는 범위 안, 읽는 글자는 서버 값', () => {
    const { rerender } = render(<ProgressBar value={3} max={0} label="a" />)
    const bar = () => screen.getByRole('progressbar')
    expect((bar().firstElementChild as HTMLElement).style.width).toBe('0%')
    expect(bar()).toHaveAttribute('aria-valuenow', '0')
    rerender(<ProgressBar value={9} max={6} label="a" />)
    expect((bar().firstElementChild as HTMLElement).style.width).toBe('100%')
    expect(bar()).toHaveAttribute('aria-valuenow', '6')
    expect(bar()).toHaveAttribute('aria-valuetext', '9 / 6')
  })
})

describe('StudentLayout', () => {
  const html = document.documentElement

  it('level.code를 <html data-level> 이름으로 붙이고, 모르는 code는 none', () => {
    const { rerender } = render(<StudentLayout levelCode="L2">x</StudentLayout>)
    expect(html).toHaveAttribute('data-level', 'green')
    rerender(<StudentLayout levelCode="K">x</StudentLayout>)
    expect(html).toHaveAttribute('data-level', 'black')
    rerender(<StudentLayout levelCode="L9">x</StudentLayout>)
    expect(html).toHaveAttribute('data-level', 'none')
    rerender(<StudentLayout>x</StudentLayout>)
    expect(html).toHaveAttribute('data-level', 'none')
  })

  it('학생 화면을 떠나 교사 화면으로 가면 <html>에 레벨이 남지 않는다', async () => {
    const router = createMemoryRouter(
      [
        { path: '/', element: <StudentLayout levelCode="L3">학생 홈</StudentLayout> },
        { path: '/teacher', element: <main>교사 반 목록</main> },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)
    expect(html).toHaveAttribute('data-level', 'blue')
    await act(() => router.navigate('/teacher'))
    expect(screen.getByText('교사 반 목록')).toBeInTheDocument()
    expect(html).not.toHaveAttribute('data-level')
  })

  it('tabBar면 떠 있는 탭 바 자리만큼 아래 여백 클래스', () => {
    const { container, rerender } = render(<StudentLayout>x</StudentLayout>)
    const main = container.querySelector('main') as HTMLElement
    expect(main.className).not.toMatch(/withTabBar/)
    rerender(<StudentLayout tabBar>x</StudentLayout>)
    expect(main.className).toMatch(/withTabBar/)
  })
})

describe('levelName', () => {
  it('L1~L4·K를 DESIGN.md 레벨 이름으로, 그 밖은 undefined', () => {
    expect(['L1', 'L2', 'L3', 'L4', 'K'].map(levelName)).toEqual([
      'mint',
      'green',
      'blue',
      'navy',
      'black',
    ])
    expect(levelName(undefined)).toBeUndefined()
    expect(levelName('l2')).toBeUndefined()
  })
})

describe('NumberCircle', () => {
  it('상태를 data-state로, 장식이라 읽지 않는다', () => {
    render(
      <NumberCircle state="overdue" size={56}>
        3
      </NumberCircle>,
    )
    const circle = screen.getByText('3')
    expect(circle).toHaveAttribute('data-state', 'overdue')
    expect(circle).toHaveAttribute('aria-hidden', 'true')
    expect(circle.style.getPropertyValue('--nc-size')).toBe('56px')
    expect(circle.style.getPropertyValue('--nc-font')).toBe(`${Math.round(56 * 0.42)}px`)
  })

  it('pressable은 누를 수 있는 상태에만 — 잠김·레벨 번호는 턱이 없다', () => {
    const { rerender } = render(
      <NumberCircle state="open" size={46} fontSize={19} pressable>
        1
      </NumberCircle>,
    )
    expect(screen.getByText('1').className).toMatch(/pressable/)
    expect(screen.getByText('1').style.getPropertyValue('--nc-font')).toBe('19px')
    rerender(
      <NumberCircle state="locked" size={46} pressable>
        1
      </NumberCircle>,
    )
    expect(screen.getByText('1').className).not.toMatch(/pressable/)
    rerender(
      <NumberCircle state="level" size={44} pressable>
        1
      </NumberCircle>,
    )
    expect(screen.getByText('1').className).not.toMatch(/pressable/)
  })
})

describe('Button', () => {
  it('학생 크기와 교사 크기는 다른 클래스(학생만 턱 버튼)', () => {
    render(
      <>
        <Button>들어가기</Button>
        <Button size="teacher">저장</Button>
      </>,
    )
    expect(screen.getByRole('button', { name: '들어가기' }).className).toMatch(/student/)
    expect(screen.getByRole('button', { name: '저장' }).className).toMatch(/teacher/)
    expect(screen.getByRole('button', { name: '저장' }).className).not.toMatch(/student/)
  })
})

describe('levelProps', () => {
  it('#RRGGBB만 --level·data-level로, 아니면 아무것도 넣지 않는다', () => {
    expect(levelProps('#1f7a4f')).toEqual({
      style: { '--level': '#1f7a4f' },
      'data-level': '',
    })
    expect(levelProps(undefined)).toEqual({})
    expect(levelProps('#1F7A4')).toEqual({})
    expect(levelProps('red')).toEqual({})
  })
})

describe('StatusPill', () => {
  it('srLabel이 있으면 보이는 기호는 숨기고 낭독 글자만 읽는다', () => {
    render(
      <StatusPill status="in_progress" shape="cell" srLabel="김민준 Reading Day 5 진행 중 3 / 6">
        3/6
      </StatusPill>,
    )
    const visible = screen.getByText('3/6')
    expect(visible).toHaveAttribute('aria-hidden', 'true')
    const pill = screen.getByText('김민준 Reading Day 5 진행 중 3 / 6').parentElement
    expect(pill).toHaveAttribute('data-status', 'in_progress')
  })

  it('srLabel이 없으면 글자를 그대로(숨기지 않음)', () => {
    render(<StatusPill status="overdue">밀림</StatusPill>)
    expect(screen.getByText('밀림')).not.toHaveAttribute('aria-hidden')
  })
})

describe('OverdueAlert', () => {
  it('개수·항목·이동 링크를 보인다', () => {
    inRouter(
      <OverdueAlert
        items={[
          {
            key: 'a',
            title: 'Reading Day 3',
            detail: '12/15 (화) 수업 · 지문 듣기 2 / 6에서 멈춤',
            action: { label: '이어서', to: '/lessons/L2-B1-03' },
          },
        ]}
      />,
    )
    const alert = screen.getByRole('alert', { name: '밀린 수업 1개' })
    expect(alert).toHaveTextContent('다음 수업 전에 끝내요')
    expect(alert).toHaveTextContent('12/15 (화) 수업 · 지문 듣기 2 / 6에서 멈춤')
    expect(screen.getByRole('link', { name: 'Reading Day 3 이어서' })).toHaveAttribute(
      'href',
      '/lessons/L2-B1-03',
    )
  })

  it('항목이 없으면 그리지 않는다', () => {
    inRouter(<OverdueAlert items={[]} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('BottomBar', () => {
  const lessonsTab = (count: number): BottomTab => ({
    label: '회차',
    icon: LayoutGrid,
    to: '/lessons',
    end: true,
    badge: { count, label: `밀린 수업 ${count}개` },
  })
  const tabs: BottomTab[] = [
    { label: '홈', icon: House, to: '/', end: true },
    lessonsTab(2),
    { label: '단어', icon: LayoutGrid, unavailable: '준비 중' },
  ]

  it('지금 화면 탭에 aria-current, 배지는 읽는 이름에 붙는다', () => {
    inRouter(<BottomBar tabs={tabs} />, '/lessons')
    const nav = screen.getByRole('navigation', { name: '주 메뉴' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '회차, 밀린 수업 2개' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: '홈' })).not.toHaveAttribute('aria-current')
  })

  it('배지가 0이면 숫자를 보이지 않는다', () => {
    inRouter(<BottomBar tabs={[lessonsTab(0)]} />)
    expect(screen.getByRole('link', { name: '회차' })).toHaveTextContent(/^회차$/)
  })

  it('to가 없는 탭은 주소 없는 비활성 링크로, 이유를 읽어 준다', () => {
    inRouter(<BottomBar tabs={tabs} />)
    const words = screen.getByRole('link', { name: '단어, 준비 중' })
    expect(words).toHaveAttribute('aria-disabled', 'true')
    expect(words).not.toHaveAttribute('href')
  })
})

describe('PassageTabs', () => {
  const tabs = (n: number, doneUpTo = 0) =>
    Array.from({ length: n }, (_, i) => ({ no: i + 1, done: i + 1 <= doneUpTo }))

  it('6개까지는 한 줄, 7개부터(블루 12) 줄을 바꾼다 — 숫자는 서버 개수 그대로', () => {
    const { rerender } = render(<PassageTabs tabs={tabs(6)} selected={1} onSelect={() => {}} />)
    const nav = screen.getByRole('navigation', { name: '지문 고르기' })
    expect(nav.className).not.toMatch(/wrap/)
    rerender(<PassageTabs tabs={tabs(12)} selected={1} onSelect={() => {}} />)
    expect(nav.className).toMatch(/wrap/)
    expect(within(nav).getAllByRole('button')).toHaveLength(12)
    rerender(<PassageTabs tabs={tabs(1)} selected={1} onSelect={() => {}} />)
    expect(within(nav).getAllByRole('button')).toHaveLength(1)
  })

  it('완료로 바뀐 지문만 한 번 커졌다 돌아온다(처음부터 완료였던 지문은 아님)', () => {
    vi.useFakeTimers()
    const { rerender } = render(<PassageTabs tabs={tabs(3, 1)} selected={2} onSelect={() => {}} />)
    const button = (name: string) => screen.getByRole('button', { name })
    expect(button('지문 1 완료').className).not.toMatch(/pop/)

    rerender(<PassageTabs tabs={tabs(3, 2)} selected={2} onSelect={() => {}} />)
    expect(button('지문 2 듣는 중 · 완료').className).toMatch(/pop/)
    expect(button('지문 1 완료').className).not.toMatch(/pop/)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(button('지문 2 듣는 중 · 완료').className).not.toMatch(/pop/)
  })
})

describe('SentenceDots', () => {
  it('문장이 14개를 넘으면 점을 그리지 않는다(숫자만)', () => {
    const { rerender } = render(<SentenceDots count={14} current={0} heard={[]} />)
    expect(screen.getByRole('img', { name: '문장 14개 중 1번째' }).children).toHaveLength(14)
    rerender(<SentenceDots count={15} current={0} heard={[]} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('HeardBar', () => {
  it('건너뛴 곳은 지금 위치보다 앞인데 듣지 않은 곳만, 1초 미만 틈은 빼고, 완료 기준 눈금', () => {
    const { container } = render(
      <HeardBar
        listened={[
          [0, 10_000],
          [10_500, 20_000],
          [40_000, 45_000],
        ]}
        positionMs={60_000}
        durationMs={83_000}
        threshold={0.9}
      />,
    )
    const attr = (name: string) =>
      [...container.querySelectorAll(`[${name}]`)].map((el) => el.getAttribute(name))
    expect(attr('data-skipped')).toEqual(['20000-40000', '45000-60000'])
    expect(attr('data-range')).toEqual(['0-10000', '10500-20000', '40000-45000'])
    expect(screen.queryByRole('slider')).not.toBeInTheDocument() // onSeek이 없으면 표시만
  })
})
