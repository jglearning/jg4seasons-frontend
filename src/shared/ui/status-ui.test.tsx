import { render, screen } from '@testing-library/react'
import { House, LayoutGrid } from 'lucide-react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { BottomBar, type BottomTab } from './BottomBar'
import { OverdueAlert } from './OverdueAlert'
import { ProgressBar } from './ProgressBar'
import { levelProps } from '../level'
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
  it('#RRGGBB 레벨 색만 --level로 넣는다', () => {
    const { container, rerender } = render(<StudentLayout levelColorHex="#1F7A4F">x</StudentLayout>)
    const main = container.querySelector('main') as HTMLElement
    expect(main.style.getPropertyValue('--level')).toBe('#1F7A4F')
    expect(main).toHaveAttribute('data-level')

    rerender(<StudentLayout levelColorHex="red; background: url(x)">x</StudentLayout>)
    expect(main.style.getPropertyValue('--level')).toBe('')
    expect(main).not.toHaveAttribute('data-level')
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
