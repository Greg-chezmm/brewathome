import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CostLine } from '@/lib/batches/costs'

const api = vi.hoisted(() => ({
  costs: [] as CostLine[],
  measurements: {} as Record<string, number | null>,
  updateBatchCosts: vi.fn(async () => undefined),
}))

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))
vi.mock('@/lib/db/queries/batches', () => ({
  getBatchWithDetails: async () => ({
    id: 'b1',
    name: 'Blonde #1',
    costs: api.costs,
    measurements: api.measurements,
    volumeMeasuredL: null,
    recipeSnapshot: {
      targetVolumeL: 10,
      fermentables: [{ name: 'Pilsner', amountKg: 2 }],
      hops: [{ name: 'Saaz', amountG: 20 }],
      yeasts: [{ name: 'US-05' }],
      otherIngredients: [],
    },
  }),
  updateBatchCosts: api.updateBatchCosts,
}))

const { BatchCost } = await import('@/pages/batches/BatchCost')

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/batches/b1/cost']}>
        <Routes>
          <Route path="/batches/:batchId/cost" element={<BatchCost />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BatchCost', () => {
  beforeEach(() => {
    api.costs = []
    api.measurements = {}
    api.updateBatchCosts.mockClear()
  })

  it('liste les ingrédients du brassin avec un champ de prix chacun', async () => {
    renderPage()
    expect(await screen.findByLabelText('Prix de Pilsner')).toHaveValue('')
    expect(screen.getByLabelText('Prix de Saaz')).toBeInTheDocument()
    expect(screen.getByLabelText('Prix de US-05')).toBeInTheDocument()
    expect(screen.getByText('2 kg')).toBeInTheDocument()
  })

  it('calcule total, coût au litre et à la bouteille de 33 cl sur le volume de la recette à défaut de mesure', async () => {
    renderPage()
    fireEvent.change(await screen.findByLabelText('Prix de Pilsner'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Prix de Saaz'), { target: { value: '3' } })
    expect(screen.getByText('Total : 8,00 €')).toBeInTheDocument()
    expect(screen.getByText('0,80 € le litre')).toBeInTheDocument()
    expect(screen.getByText('0,26 € la bouteille de 33 cl')).toBeInTheDocument()
  })

  it('préfère le volume conditionné mesuré', async () => {
    api.measurements = { packagingVolumeL: 8 }
    api.costs = [{ label: 'Pilsner', amount: 8 }]
    renderPage()
    expect(await screen.findByText('1,00 € le litre')).toBeInTheDocument()
  })

  it('ajoute un frais libre et enregistre seulement les lignes chiffrées', async () => {
    renderPage()
    fireEvent.change(await screen.findByLabelText('Prix de Pilsner'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un frais' }))
    fireEvent.change(screen.getByLabelText('Libellé du frais 1'), { target: { value: 'Capsules' } })
    fireEvent.change(screen.getByLabelText('Montant du frais 1'), { target: { value: '2,5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les coûts' }))
    await waitFor(() =>
      expect(api.updateBatchCosts).toHaveBeenCalledWith('b1', [
        { label: 'Pilsner', amount: 5 },
        { label: 'Capsules', amount: 2.5 },
      ]),
    )
  })

  it('supprime un frais libre', async () => {
    api.costs = [{ label: 'Gaz', amount: 1 }]
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer le frais 1' }))
    expect(screen.queryByLabelText('Libellé du frais 1')).toBeNull()
  })

  it('affiche l’erreur d’enregistrement', async () => {
    api.updateBatchCosts.mockRejectedValueOnce(new Error('hors ligne'))
    renderPage()
    fireEvent.change(await screen.findByLabelText('Prix de Pilsner'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les coûts' }))
    expect(await screen.findByText('hors ligne')).toBeInTheDocument()
  })
})
