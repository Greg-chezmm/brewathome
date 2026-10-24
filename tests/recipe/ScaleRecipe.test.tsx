import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

const createRecipe = vi.hoisted(() => vi.fn(async () => 'r9'))

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@/lib/db/queries/recipes', () => ({ createRecipe }))
vi.mock('@/lib/db/queries/equipmentProfiles', () => ({
  listEquipmentProfiles: async () => [
    { id: 'eq-10', name: 'Cuve 15 L', targetBatchVolumeL: 10 },
    { id: 'eq-20', name: 'Cuve 30 L', targetBatchVolumeL: 20 },
  ],
}))

const { ScaleRecipe } = await import('@/components/recipe/ScaleRecipe')

const recipe = {
  id: 'r1',
  name: 'Brune',
  type: 'all-grain',
  targetVolumeL: 10,
  boilTimeMin: 60,
  mashEfficiencyPercent: 72,
  mashTempC: 66,
  mashSteps: [{ name: 'Sacchar.', tempC: 66, timeMin: 60 }],
  ibuFormula: 'tinseth',
  equipmentProfileId: 'eq-10',
  notes: null,
  fermentables: [{ name: 'Pale', type: 'grain', amountKg: 2, colorLovibond: 3, yieldPercent: 80 }],
  hops: [],
  yeasts: [],
  otherIngredients: [],
  fermentationSteps: [],
  carbonationVols: null,
} as unknown as RecipeDetails

function setup() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/recipes/r1']}>
        <Routes>
          <Route path="/recipes/:recipeId" element={<ScaleRecipe recipe={recipe} />} />
          <Route path="/recipes/:recipeId/edit" element={<p>Éditeur</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Redimensionner' }))
}

describe('ScaleRecipe', () => {
  beforeEach(() => createRecipe.mockClear())

  it('crée la copie au nouveau volume, avec un nom proposé, puis ouvre l’éditeur', async () => {
    setup()
    fireEvent.change(screen.getByLabelText('Nouveau volume (L)'), { target: { value: '20' } })
    expect(screen.getByLabelText('Nom')).toHaveValue('Brune (20 L)')
    fireEvent.click(screen.getByRole('button', { name: 'Créer et modifier' }))
    expect(await screen.findByText('Éditeur')).toBeInTheDocument()
    expect(createRecipe).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        name: 'Brune (20 L)',
        targetVolumeL: 20,
        fermentables: [expect.objectContaining({ amountKg: 4 })],
      }),
    )
  })

  it('propose l’équipement choisi pour le nouveau volume', async () => {
    setup()
    fireEvent.change(screen.getByLabelText('Nouveau volume (L)'), { target: { value: '20' } })
    await waitFor(() => expect(screen.getByRole('option', { name: /Cuve 30 L/ })).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Équipement'), { target: { value: 'eq-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer et modifier' }))
    await screen.findByText('Éditeur')
    expect(createRecipe).toHaveBeenCalledWith('u1', expect.objectContaining({ equipmentProfileId: 'eq-20' }))
  })

  it('refuse un volume vide ou nul', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Nouveau volume (L)'), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: 'Créer et modifier' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Nouveau volume (L)'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'Créer et modifier' })).toBeDisabled()
  })

  it('affiche l’échelle appliquée', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Nouveau volume (L)'), { target: { value: '25' } })
    expect(screen.getByText(/×2,5/)).toBeInTheDocument()
  })
})
