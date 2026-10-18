import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NewRecipeVersion } from '@/components/batches/NewRecipeVersion'
import { MEASUREMENTS, type MeasurementValues } from '@/lib/brew-day/measurements'
import type { BatchDetails } from '@/lib/db/queries/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

const createRecipe = vi.hoisted(() => vi.fn(async () => 'r9'))

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@/lib/db/queries/recipes', () => ({
  listRecipes: async () => [{ id: 'r2', name: 'Pale ale v2' }],
  createRecipe,
}))

const snapshot = {
  id: 'r1',
  name: 'Pale ale',
  type: 'all-grain',
  targetVolumeL: 10,
  boilTimeMin: 60,
  mashEfficiencyPercent: 75,
  mashTempC: 67,
  mashSteps: [{ name: 'Saccharification', tempC: 67, timeMin: 60 }],
  ibuFormula: 'tinseth',
  equipmentProfileId: null,
  notes: null,
  fermentables: [{ name: 'Pale ale', type: 'grain', amountKg: 2.2, colorLovibond: 3, yieldPercent: 80 }],
  hops: [],
  yeasts: [{ name: 'US-05', type: 'dry', style: 'ale', attenuationPercent: 78 }],
  otherIngredients: [],
  fermentationSteps: [],
  carbonationVols: null,
} as unknown as RecipeDetails
const noMeasurements = Object.fromEntries(Object.keys(MEASUREMENTS).map((k) => [k, null])) as MeasurementValues
const batch = {
  id: 'b1',
  name: 'Pale ale #1',
  brewDate: '2026-02-01',
  recipeSnapshot: snapshot,
  measurements: { ...noMeasurements, og: 1.05, fg: 1.01 },
  ogMeasured: null,
  fgMeasured: null,
  volumeMeasuredL: null,
} as BatchDetails

describe('NewRecipeVersion', () => {
  it('crée la version suivante libre, avec les résultats mesurés, puis ouvre l’éditeur', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/batches/b1']}>
          <Routes>
            <Route path="/batches/:batchId" element={<NewRecipeVersion batch={batch} equipment={undefined} />} />
            <Route path="/recipes/:recipeId/edit" element={<p>Éditeur</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle version de la recette' }))
    await waitFor(() => expect(screen.getByLabelText('Nom')).toHaveValue('Pale ale v3'))
    expect(screen.getByText(/atténuation de US-05 80 %/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Créer et modifier' }))
    expect(await screen.findByText('Éditeur')).toBeInTheDocument()
    expect(createRecipe).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ name: 'Pale ale v3', yeasts: [expect.objectContaining({ attenuationPercent: 80 })] }),
    )
  })
})
