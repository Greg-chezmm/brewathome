import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tasting } from '@/lib/batches/tastings'

const api = vi.hoisted(() => ({
  tastings: [] as Tasting[],
  updateBatchTastings: vi.fn(async () => undefined),
}))

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))
vi.mock('@/lib/db/queries/batches', () => ({
  getBatchWithDetails: async () => ({ id: 'b1', name: 'Brune #1', tastings: api.tastings }),
  updateBatchTastings: api.updateBatchTastings,
}))

const { BatchTastings } = await import('@/pages/batches/BatchTastings')

const existing = (over: Partial<Tasting>): Tasting => ({
  id: 't1',
  date: '2026-11-02',
  rating: 4,
  appearance: 'acajou',
  aroma: 'café',
  taste: 'chocolat',
  changeNext: 'moins de sucre',
  ...over,
})

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/batches/b1/tasting']}>
        <Routes>
          <Route path="/batches/:batchId/tasting" element={<BatchTastings />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BatchTastings', () => {
  beforeEach(() => {
    api.tastings = []
    api.updateBatchTastings.mockClear()
  })

  it('invite à déguster quand il n’y a encore rien', async () => {
    renderPage()
    expect(await screen.findByText(/Aucune dégustation/)).toBeInTheDocument()
  })

  it('ajoute une dégustation du jour, note et commentaires, puis l’enregistre', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter une dégustation' }))
    fireEvent.click(screen.getByRole('radio', { name: '4 sur 5' }))
    fireEvent.change(screen.getByLabelText('Aspect'), { target: { value: 'ambrée, mousse tenue' } })
    fireEvent.change(screen.getByLabelText('Arôme'), { target: { value: 'agrumes' } })
    fireEvent.change(screen.getByLabelText('Goût'), { target: { value: 'amer net' } })
    fireEvent.change(screen.getByLabelText('À changer la prochaine fois'), { target: { value: 'moins de Citra' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(api.updateBatchTastings).toHaveBeenCalledTimes(1))
    const [batchId, saved] = api.updateBatchTastings.mock.calls[0] as unknown as [string, Tasting[]]
    expect(batchId).toBe('b1')
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({
      rating: 4,
      appearance: 'ambrée, mousse tenue',
      aroma: 'agrumes',
      taste: 'amer net',
      changeNext: 'moins de Citra',
    })
    expect(saved[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(saved[0].id).not.toBe('')
  })

  it('affiche les dégustations enregistrées et la note moyenne', async () => {
    api.tastings = [existing({ id: 'a', rating: 4 }), existing({ id: 'b', date: '2026-12-20', rating: 5, aroma: 'caramel' })]
    renderPage()
    expect(await screen.findByDisplayValue('caramel')).toBeInTheDocument()
    expect(screen.getByDisplayValue('café')).toBeInTheDocument()
    expect(screen.getByText(/Moyenne : 4,5 \/ 5/)).toBeInTheDocument()
  })

  it('supprime une dégustation après enregistrement', async () => {
    api.tastings = [existing({ id: 'a' }), existing({ id: 'b', date: '2026-12-20' })]
    renderPage()
    const buttons = await screen.findAllByRole('button', { name: 'Supprimer cette dégustation' })
    fireEvent.click(buttons[0])
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(api.updateBatchTastings).toHaveBeenCalled())
    const saved = (api.updateBatchTastings.mock.calls[0] as unknown as [string, Tasting[]])[1]
    // Le mock renvoie la liste telle quelle (a puis b) : le premier bouton supprime « a ».
    expect(saved.map((t) => t.id)).toEqual(['b'])
  })

  it('affiche l’erreur d’enregistrement', async () => {
    api.updateBatchTastings.mockRejectedValueOnce(new Error('hors ligne'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter une dégustation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('hors ligne')).toBeInTheDocument()
  })
})
