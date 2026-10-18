import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BrewDay } from '@/pages/batches/BrewDay'
import { buildBatchSteps } from '@/lib/brew-day/steps'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

const recipe = vi.hoisted(
  (): RecipeDetails => ({
    id: 'r1',
    name: 'Brune forte',
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
    estOg: 1.07,
    estFg: 1.016,
    estIbu: null,
    estSrm: null,
    estAbv: null,
    createdAt: '2026-01-01',
    fermentables: [{ name: 'Pale', type: 'grain', amountKg: 6, colorLovibond: 3, yieldPercent: 80 }],
    hops: [{ name: 'Magnum', amountG: 30, alphaAcidPercent: 12, timeMin: 60, use: 'boil' }],
    yeasts: [{ name: 'US-05', type: 'dry', style: 'ale', attenuationPercent: 78 }],
    otherIngredients: [],
  }),
)
const saved = vi.hoisted(() => ({ sessionMeasurements: vi.fn(async () => {}) }))
const page = vi.hoisted(() => ({ session2: { postBoilGravity: null as number | null, fermenterVolumeL: null as number | null } }))

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))
vi.mock('@/lib/db/queries/equipmentProfiles', () => ({ getEquipmentProfile: async () => null }))
vi.mock('@/lib/db/queries/batches', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/queries/batches')>()),
  getBatchWithDetails: async () => ({
    id: 'b1',
    name: 'Brune forte',
    status: 'brew_day',
    brewSessions: 2,
    sessionMeasurements: [
      { preBoilVolumeL: null, preBoilGravity: null, postBoilVolumeL: null, postBoilGravity: 1.072, fermenterVolumeL: 10 },
      { preBoilVolumeL: null, preBoilGravity: null, postBoilVolumeL: null, ...page.session2 },
    ],
    measurements: Object.fromEntries(
      ['mashPh', 'preBoilVolumeL', 'preBoilGravity', 'postBoilVolumeL', 'postBoilGravity', 'fermenterTopUpL', 'fermenterVolumeL', 'og', 'fg', 'packagingVolumeL', 'maxFermentationTempC'].map((k) => [k, null]),
    ),
    recipeSnapshot: recipe,
  }),
  // Préparation faite : la session suivie s'ouvre sur sa première étape.
  getBatchSteps: async () =>
    buildBatchSteps(recipe, null, 2).map((s, i) => ({
      ...s,
      id: `s${i}`,
      status: s.stepType === 'preparation' ? 'done' : 'todo',
      checkedItems: [],
    })),
  updateBatchSessionMeasurements: saved.sessionMeasurements,
}))

function renderAt(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/batches/:batchId/brew-day" element={<BrewDay />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const overview = () => within(screen.getByRole('complementary'))
const loaded = () => screen.findByRole('complementary')

describe('Brew Day en 2 sessions', () => {
  it('un onglet par session : seules ses étapes et les étapes communes', async () => {
    renderAt('/batches/b1/brew-day?session=2')
    expect(await screen.findByRole('button', { name: 'Session 2', pressed: true })).toBeInTheDocument()
    expect(overview().getByText(/Session 2 · Empâtage/)).toBeInTheDocument()
    expect(overview().queryByText(/Session 1 · Empâtage/)).not.toBeInTheDocument()
    expect(overview().getByText(/Ensemencement : US-05/)).toBeInTheDocument()
    // Ouvre sur la première étape à faire de la session 2.
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && /^🌾 Session 2 · Empâtage · 1\/\d/.test(el.textContent ?? '')),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Toutes' }))
    expect(await overview().findByText(/Session 1 · Empâtage/)).toBeInTheDocument()
  })

  it('mesures de la session au refroidissement, enregistrées sur sa session', async () => {
    renderAt('/batches/b1/brew-day?session=2')
    await loaded()
    fireEvent.click(await overview().findByText(/Refroidissement sous 25 °C puis transfert/))
    expect(screen.getByText('Mesures de la session 2')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Volume versé au fermenteur'), { target: { value: '9.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(saved.sessionMeasurements).toHaveBeenCalledWith('b1', 1, { fermenterVolumeL: 9.5 }))
  })

  it('à l’ensemencement, propose la DI du mélange quand les sessions sont mesurées', async () => {
    renderAt('/batches/b1/brew-day')
    await loaded()
    fireEvent.click(await overview().findByText(/Ensemencement : US-05/))
    // Session 2 pas encore mesurée : rien à proposer.
    expect(screen.queryByText(/Mélange des sessions/)).not.toBeInTheDocument()
  })

  it('les deux sessions mesurées : DI du mélange pondérée par les volumes versés, reprise d’un clic', async () => {
    page.session2 = { postBoilGravity: 1.064, fermenterVolumeL: 9 }
    renderAt('/batches/b1/brew-day')
    await loaded()
    fireEvent.click(await overview().findByText(/Ensemencement : US-05/))
    // (72 × 10 L + 64 × 9 L) / 19 L = 68,2 points.
    fireEvent.click(screen.getByRole('button', { name: /Mélange des sessions : 1.068/ }))
    expect(screen.getByLabelText('Densité initiale (DI)')).toHaveValue(1.068)
    expect(screen.getByRole('button', { name: /Versé par les sessions : 19,0 L/ })).toBeInTheDocument()
  })
})
