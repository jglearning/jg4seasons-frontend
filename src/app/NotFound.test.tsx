import { render, screen } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { describe, expect, it } from 'vitest'
import { routes } from './routes'

describe('NotFound', () => {
  it('없는 주소는 404 안내와 처음으로 링크를 보여 준다', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/no-such-page'] })
    render(<RouterProvider router={router} />)

    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없어요' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '처음으로' })).toHaveAttribute('href', '/')
  })
})
