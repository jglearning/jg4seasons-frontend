import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderRoutes } from '../test/render'
import { routes } from './routes'

describe('NotFound', () => {
  it('없는 주소는 404 안내와 처음으로 링크를 보여 준다', () => {
    renderRoutes(routes, { initialEntries: ['/no-such-page'] })

    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없어요' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '처음으로' })).toHaveAttribute('href', '/')
  })
})
