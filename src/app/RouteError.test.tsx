import { render, screen } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { describe, expect, it, vi } from 'vitest'
import { RouteError } from './RouteError'
import { routes } from './routes'

function Broken(): never {
  throw new Error('render failed')
}

describe('RouteError', () => {
  it('화면을 그리다 오류가 나면 기본 영어 화면 대신 한국어 안내와 다시 시도', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = createMemoryRouter([
      { path: '/', element: <Broken />, errorElement: <RouteError /> },
    ])
    render(<RouterProvider router={router} />)

    expect(screen.getByRole('heading', { name: '문제가 생겼어요' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
    expect(log).toHaveBeenCalledWith('[route]', expect.any(Error))
  })

  it('앱 라우트의 맨 바깥에 붙어 있다', () => {
    expect(routes[0].errorElement).toEqual(<RouteError />)
  })
})
