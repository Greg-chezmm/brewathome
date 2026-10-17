import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } }, user: null, loading: false, signOut: vi.fn() }),
}))

const { App } = await import('@/App')

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Pages chargées à la demande', () => {
  it('affiche la page une fois son fichier chargé, menu compris', async () => {
    renderAt('/tools')
    expect(await screen.findByRole('heading', { level: 1, name: 'Outils' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Brassins/ }).length).toBeGreaterThan(0)
  })

  it('charge aussi les onglets du guide', async () => {
    renderAt('/ingredients?tab=mash-water')
    expect(await screen.findByRole('heading', { name: 'Les ions de l’eau' })).toBeInTheDocument()
  })
})
