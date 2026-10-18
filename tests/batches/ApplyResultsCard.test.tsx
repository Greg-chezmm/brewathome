import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApplyResultsCard } from '@/components/batches/ApplyResultsCard'
import { MEASUREMENTS, type MeasurementValues } from '@/lib/brew-day/measurements'
import type { BatchDetails } from '@/lib/db/queries/batches'
import type { EquipmentProfileRecord } from '@/lib/db/queries/equipmentProfiles'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

const recipe = vi.hoisted(
  (): RecipeDetails => ({
    id: 'r1',
    name: 'Pale ale',
    status: 'validated',
    styleId: null,
    type: 'all-grain',
    targetVolumeL: 10,
    boilTimeMin: 60,
    mashEfficiencyPercent: 75,
    mashTempC: 67,
    mashSteps: [{ name: 'Saccharification', tempC: 67, timeMin: 60 }],
    ibuFormula: 'tinseth',
    equipmentProfileId: 'e1',
    notes: null,
    estOg: null,
    estFg: null,
    estIbu: null,
    estSrm: null,
    estAbv: null,
    createdAt: '2026-01-01',
    fermentables: [{ name: 'Pale ale', type: 'grain', amountKg: 2.2, colorLovibond: 3, yieldPercent: 80 }],
    hops: [],
    yeasts: [{ name: 'US-05', type: 'dry', style: 'ale', attenuationPercent: 78 }],
    otherIngredients: [],
    fermentationSteps: [],
    carbonationVols: null,
  }),
)
const calls = vi.hoisted(() => ({ recipe: vi.fn(async () => {}), equipment: vi.fn(async () => {}) }))

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))
vi.mock('@/lib/db/queries/recipes', () => ({
  getRecipeWithDetails: async () => recipe,
  applyResultsToRecipe: calls.recipe,
}))
vi.mock('@/lib/db/queries/equipmentProfiles', () => ({ updateEquipmentMashEfficiency: calls.equipment }))

const noMeasurements = Object.fromEntries(Object.keys(MEASUREMENTS).map((k) => [k, null])) as MeasurementValues
const equipment = { id: 'e1', name: 'Klarstein 30 L', mashEfficiencyPercent: 72, thermalShrinkagePercent: 4 } as EquipmentProfileRecord

function renderCard(recipeId: string | null) {
  const batch: BatchDetails = {
    id: 'b1',
    name: 'Pale ale #1',
    status: 'completed',
    brewDate: '2026-02-01',
    createdAt: '2026-01-30T10:00:00Z',
    recipeId,
    recipeSnapshot: recipe,
    ogMeasured: null,
    fgMeasured: null,
    measurements: { ...noMeasurements, og: 1.05, fg: 1.01, preBoilGravity: 1.04, preBoilVolumeL: 13 },
    volumeMeasuredL: null,
    notes: null,
    brewfatherId: null,
    brewSessions: 1,
    sessionMeasurements: [],
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ApplyResultsCard batch={batch} equipment={equipment} />
    </QueryClientProvider>,
  )
}

describe('ApplyResultsCard', () => {
  it('reporte efficacité et atténuation sur la recette d’origine et le profil d’équipement', async () => {
    renderCard('r1')
    expect(await screen.findByText(/Recette d'origine « Pale ale »/)).toBeInTheDocument()
    expect(screen.getByText('Atténuation de US-05')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }))
    await waitFor(() => expect(screen.getByText('Résultats reportés.')).toBeInTheDocument())
    expect(calls.recipe).toHaveBeenCalledWith('r1', expect.objectContaining({ yeastAttenuationPercent: 80, yeastName: 'US-05' }))
    expect(calls.equipment).toHaveBeenCalledWith('e1', expect.any(Number))
  })

  it('brassin sans recette liée : seul le profil d’équipement, avec une explication', () => {
    renderCard(null)
    expect(screen.getByText(/n'est lié à aucune recette/)).toBeInTheDocument()
    expect(screen.getByText(/Profil d'équipement « Klarstein 30 L »/)).toBeInTheDocument()
  })
})
