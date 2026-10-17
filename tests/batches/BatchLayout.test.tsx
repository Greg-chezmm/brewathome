import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BatchLayout } from '@/components/batches/BatchLayout'

vi.mock('@/lib/db/queries/batches', () => ({
  BATCH_STATUS_LABELS: { fermentation: 'Fermentation' },
  getBatchWithDetails: async () => ({ id: 'b1', name: 'Barley wine', status: 'fermentation', brewDate: '2025-10-18' }),
}))

function renderAt(path: string) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/batches/:batchId" element={<BatchLayout />}>
            <Route index element={<p>Page aperçu</p>} />
            <Route path="fermentation" element={<p>Page fermentation</p>} />
            <Route path="edit-recipe" element={<p>Page recette</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Onglets du brassin', () => {
  it('rappelle le brassin et passe d’une section à l’autre sans revenir en arrière', async () => {
    renderAt('/batches/b1/fermentation')
    expect(await screen.findByRole('heading', { name: 'Barley wine' })).toBeInTheDocument()
    expect(screen.getByText('brassé le 18/10/2025')).toBeInTheDocument()
    expect(screen.getByText('Page fermentation')).toBeInTheDocument()

    const tabs = screen.getByRole('navigation', { name: 'Sections du brassin' })
    expect(screen.getByRole('link', { name: 'Fermentation' })).toHaveAttribute('aria-current', 'page')
    expect(tabs).toHaveTextContent('AperçuBrew DayFermentationRecette')
    expect(screen.getByRole('link', { name: 'Brew Day' })).toHaveAttribute('href', '/batches/b1/brew-day')

    fireEvent.click(screen.getByRole('link', { name: 'Aperçu' }))
    expect(screen.getByText('Page aperçu')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Recette' }))
    expect(screen.getByText('Page recette')).toBeInTheDocument()
  })
})
