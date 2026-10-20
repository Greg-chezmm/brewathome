import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BrewDay } from '@/pages/batches/BrewDay'
import { buildBatchSteps } from '@/lib/brew-day/steps'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

const recipe = vi.hoisted(
  (): RecipeDetails => ({
    id: 'r1',
    name: 'Blonde',
    status: 'validated',
    styleId: null,
    type: 'all-grain',
    targetVolumeL: 20,
    boilTimeMin: 60,
    mashEfficiencyPercent: 72,
    mashTempC: 66,
    mashSteps: [{ name: 'Saccharification', tempC: 66, timeMin: 60 }],
    ibuFormula: 'tinseth',
    equipmentProfileId: null,
    notes: null,
    estOg: 1.05,
    estFg: 1.01,
    estIbu: null,
    estSrm: null,
    estAbv: null,
    createdAt: '2026-01-01',
    fermentables: [{ name: 'Pale', type: 'grain', amountKg: 5, colorLovibond: 3, yieldPercent: 80 }],
    hops: [{ name: 'Magnum', amountG: 20, alphaAcidPercent: 12, timeMin: 60, use: 'boil' }],
    yeasts: [{ name: 'US-05', type: 'dry', style: 'ale', attenuationPercent: 78 }],
    otherIngredients: [],
  }),
)
const api = vi.hoisted(() => ({
  batchFails: false,
  stepsFail: false,
  updateStatus: vi.fn(async (..._args: unknown[]) => {}),
}))

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))
vi.mock('@/lib/db/queries/equipmentProfiles', () => ({ getEquipmentProfile: async () => null }))
vi.mock('@/lib/db/queries/batches', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/queries/batches')>()),
  getBatchWithDetails: async () => {
    if (api.batchFails) throw new Error('réseau coupé')
    return {
      id: 'b1',
      name: 'Blonde',
      status: 'brew_day',
      brewSessions: 1,
      sessionMeasurements: [],
      measurements: Object.fromEntries(
        ['mashPh', 'preBoilVolumeL', 'preBoilGravity', 'postBoilVolumeL', 'postBoilGravity', 'fermenterTopUpL', 'fermenterVolumeL', 'og', 'fg', 'packagingVolumeL', 'maxFermentationTempC'].map((k) => [k, null]),
      ),
      recipeSnapshot: recipe,
    }
  },
  getBatchSteps: async () => {
    if (api.stepsFail) throw new Error('réseau coupé')
    return buildBatchSteps(recipe, null).map((s, i) => ({ ...s, id: `s${i}`, status: 'todo', checkedItems: [] }))
  },
  updateBatchStepStatus: api.updateStatus,
}))

function renderBrewDay() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/batches/b1/brew-day']}>
        <Routes>
          <Route path="/batches/:batchId/brew-day" element={<BrewDay />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const previousStep = () => screen.getByRole('button', { name: 'Étape précédente' })

describe('Brew Day : erreurs', () => {
  beforeEach(() => {
    api.batchFails = false
    api.stepsFail = false
    api.updateStatus.mockReset().mockResolvedValue(undefined)
  })

  it('chargement du brassin en échec : message d’erreur et bouton Réessayer, pas un « Chargement… » sans fin', async () => {
    api.batchFails = true
    renderBrewDay()
    expect(await screen.findByRole('alert')).toHaveTextContent(/réseau coupé/)
    expect(screen.queryByText('Chargement…')).not.toBeInTheDocument()

    api.batchFails = false
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('complementary')).toBeInTheDocument()
  })

  it('chargement des étapes en échec : même message', async () => {
    api.stepsFail = true
    renderBrewDay()
    expect(await screen.findByRole('alert')).toHaveTextContent(/réseau coupé/)
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })

  it('Terminer enregistré : passe à l’étape suivante', async () => {
    renderBrewDay()
    await screen.findByRole('button', { name: 'Étape précédente' })
    expect(previousStep()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }))
    await waitFor(() => expect(previousStep()).toBeEnabled())
  })

  it('Terminer non enregistré : reste sur l’étape et affiche l’erreur', async () => {
    api.updateStatus.mockRejectedValue(new Error('écriture refusée'))
    renderBrewDay()
    await screen.findByRole('button', { name: 'Étape précédente' })
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }))
    expect(await screen.findByText('écriture refusée')).toBeInTheDocument()
    expect(previousStep()).toBeDisabled()
  })

  it('Passer non enregistré : reste sur l’étape et affiche l’erreur', async () => {
    api.updateStatus.mockRejectedValue(new Error('écriture refusée'))
    renderBrewDay()
    await screen.findByRole('button', { name: 'Étape précédente' })
    fireEvent.click(screen.getByRole('button', { name: 'Passer cette étape' }))
    expect(await screen.findByText('écriture refusée')).toBeInTheDocument()
    expect(previousStep()).toBeDisabled()
  })
})
