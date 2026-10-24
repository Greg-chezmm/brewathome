import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary'

function Broken(): never {
  throw new Error('boom')
}

describe('RouteErrorBoundary', () => {
  it('affiche un message au lieu d’une page blanche', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <Broken />
        </RouteErrorBoundary>
      </MemoryRouter>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('boom')
    expect(screen.getByRole('button', { name: 'Recharger la page' })).toBeInTheDocument()
  })
})
