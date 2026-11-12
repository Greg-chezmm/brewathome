import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BatchOverview } from '@/pages/batches/BatchOverview'
import { MEASUREMENTS, type MeasurementValues } from '@/lib/brew-day/measurements'
import type { BatchDetails } from '@/lib/db/queries/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

const api = vi.hoisted(() => ({
  deleteBatch: vi.fn(),
  updateBatchStatus: vi.fn(),
  updateBatchBrewSessions: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@/lib/db/queries/recipes', () => ({ getRecipeWithDetails: async () => null, listRecipes: async () => [] }))
vi.mock('@/lib/db/queries/batches', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/queries/batches')>()),
  getBatchWithDetails: async () => batch,
  deleteBatch: api.deleteBatch,
  updateBatchStatus: api.updateBatchStatus,
  updateBatchBrewSessions: api.updateBatchBrewSessions,
}))

const recipe = {
  id: 'r1',
  name: 'Pale ale',
  status: 'validated',
  type: 'all-grain',
  targetVolumeL: 10,
  boilTimeMin: 60,
  mashEfficiencyPercent: 75,
  mashTempC: 67,
  mashSteps: [{ name: 'Saccharification', tempC: 67, timeMin: 60 }],
  ibuFormula: 'tinseth',
  equipmentProfileId: null,
  notes: null,
  estOg: 1.05,
  estFg: 1.01,
  estIbu: 30,
  estSrm: 6,
  estAbv: 5.2,
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
  batchNumber: null,
  status: 'planned',
  brewDate: '2026-02-01',
  createdAt: '2026-01-30T10:00:00Z',
  recipeId: null,
  recipeSnapshot: recipe,
  ogMeasured: null,
  fgMeasured: null,
  volumeMeasuredL: null,
  measurements: noMeasurements,
  notes: null,
  brewfatherId: null,
  brewSessions: 1,
  sessionMeasurements: [],
  conditioningStart: null,
  conditioningDays: null,
} as unknown as BatchDetails

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/batches/b1']}>
        <Routes>
          <Route path="/batches/:batchId" element={<BatchOverview />} />
          <Route path="/batches" element={<p>Liste des brassins</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BatchOverview : échecs d’écriture visibles', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    api.deleteBatch.mockReset().mockResolvedValue(undefined)
    api.updateBatchStatus.mockReset().mockResolvedValue(undefined)
    api.updateBatchBrewSessions.mockReset().mockResolvedValue(undefined)
  })
  afterEach(() => vi.restoreAllMocks())

  it('suppression réussie : retour à la liste des brassins', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByText('Liste des brassins')).toBeInTheDocument()
    expect(api.deleteBatch).toHaveBeenCalledWith('b1')
  })

  it('suppression en échec : message d’erreur et on reste sur le brassin', async () => {
    api.deleteBatch.mockRejectedValue({ message: 'permission denied for table batches' })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('permission denied for table batches')
    expect(screen.queryByText('Liste des brassins')).toBeNull()
  })

  it('passage à l’étape suivante en échec : message d’erreur', async () => {
    api.updateBatchStatus.mockRejectedValue(new Error('réseau coupé'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Passer à l'étape suivante/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('réseau coupé')
    expect(api.updateBatchStatus).toHaveBeenCalledWith('b1', 'brew_day')
  })

  it('changement du nombre de sessions en échec : message d’erreur', async () => {
    api.updateBatchBrewSessions.mockRejectedValue(new Error('étapes non régénérées'))
    renderPage()
    fireEvent.click(await screen.findByRole('checkbox'))
    expect(await screen.findByRole('alert')).toHaveTextContent('étapes non régénérées')
  })

  it('l’erreur disparaît quand l’action suivante réussit', async () => {
    api.updateBatchStatus.mockRejectedValueOnce(new Error('réseau coupé'))
    renderPage()
    const advance = await screen.findByRole('button', { name: /Passer à l'étape suivante/ })
    fireEvent.click(advance)
    await screen.findByRole('alert')
    fireEvent.click(advance)
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})
