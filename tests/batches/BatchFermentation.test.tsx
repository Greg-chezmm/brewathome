import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BatchFermentation } from '@/pages/batches/BatchFermentation'

vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
const page = vi.hoisted(() => ({ status: 'completed', plateau: false }))

vi.mock('@/lib/db/queries/batches', () => ({
  BATCH_STATUS_LABELS: { completed: 'Terminé', fermentation: 'Fermentation' },
  getBatchWithDetails: async () => ({
    id: 'b1',
    name: 'Barley wine',
    status: page.status,
    brewDate: '2025-10-18',
    brewfatherId: 'bf1',
    ogMeasured: 1.105,
    fgMeasured: null,
    measurements: { og: 1.105, fg: null },
    recipeSnapshot: {
      fermentables: [],
      hops: [],
      yeasts: [],
      mashSteps: [],
      mashTempC: 67,
      targetVolumeL: 10.8,
      boilTimeMin: 60,
      mashEfficiencyPercent: 72,
      ibuFormula: 'tinseth',
      estOg: 1.105,
      estFg: 1.017,
    },
  }),
}))
vi.mock('@/lib/db/queries/brewfather', () => ({ getBrewfatherAccount: async () => ({ userId: 'u', apiKey: 'k' }) }))
vi.mock('@/lib/db/queries/devices', () => ({
  listDevices: async () => [
    { id: 'd1', name: 'iSpindel Vert', activeBatchId: 'b1', lastSeenAt: new Date().toISOString(), settings: {} },
    { id: 'd2', name: 'iSpindel Rouge', activeBatchId: null, lastSeenAt: null, settings: {} },
  ],
}))
vi.mock('@/lib/db/queries/fermentation', () => ({
  listFermentationReadings: async () =>
    Array.from({ length: 120 }, (_, i) => ({
      id: `r${i}`,
      // Plateau : un relevé par heure, densité qui cesse de baisser après 20 h (à 1.020).
      recordedAt: new Date(Date.UTC(2025, 9, 19) + i * (page.plateau ? 3_600_000 : 900_000)).toISOString(),
      gravity: page.plateau ? Math.max(1.02, 1.1 - i * 0.004) : 1.1 - i * 0.0005,
      temperatureC: 18,
      source: 'ispindel',
      comment: null,
      rawAngle: 70,
      battery: 4.1,
    })),
  addFermentationReading: vi.fn(),
  deleteFermentationReading: vi.fn(),
  insertFermentationReadings: vi.fn(),
}))

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/batches/b1/fermentation']}>
        <Routes>
          <Route path="/batches/:batchId/fermentation" element={<BatchFermentation />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Suivi de fermentation', () => {
  it('rappelle le brassin et montre l’iSpindel qui lui est rattaché', async () => {
    renderPage()
    expect(await screen.findByRole('link', { name: /Barley wine/ })).toHaveAttribute('href', '/batches/b1')
    expect(await screen.findByText('📡 iSpindel Vert')).toBeInTheDocument()
    expect(screen.getByText(/Connecté · dernier signal/)).toBeInTheDocument()
    expect(screen.queryByText(/iSpindel Rouge/)).toBeNull()
    expect(screen.queryByText(/Associer un iSpindel/)).toBeNull()
  })

  it('n’affiche que les 20 relevés les plus récents, puis tout à la demande', async () => {
    renderPage()
    expect(await screen.findByText(/^120 relevés/)).toBeInTheDocument()
    expect(screen.getAllByText('Supprimer')).toHaveLength(20)
    fireEvent.click(screen.getByText('Tout afficher (120 relevés)'))
    await waitFor(() => expect(screen.getAllByText('Supprimer')).toHaveLength(120))
  })

  it('signale une densité stable pendant la fermentation', async () => {
    page.status = 'fermentation'
    page.plateau = true
    try {
      renderPage()
      expect(await screen.findByText(/Densité stable à 1.020 depuis 4 jours/)).toBeInTheDocument()
      expect(screen.getByText(/Atténuation apparente 81 %/)).toBeInTheDocument()
      expect(screen.getByLabelText('Densité finale (DF)')).toHaveAttribute('placeholder', '1.017')
    } finally {
      page.status = 'completed'
      page.plateau = false
    }
  })

  it('montre l’alcool déjà produit, calculé depuis la DI', async () => {
    renderPage()
    // Derniers relevés autour de 1.041 : (1.105 − 1.041) × 131,25 ≈ 8,4 %.
    expect(await screen.findByText('≈ 8,4 %')).toBeInTheDocument()
    expect(screen.getByText('1.041')).toBeInTheDocument()
    expect(screen.getByText('Vers la DF prévue (1.017)')).toBeInTheDocument()
    expect(screen.getByText(/Calculé depuis la DI mesurée : 1.105/)).toBeInTheDocument()
  })

  it('pas d’alerte de stabilité sur un brassin terminé', async () => {
    renderPage()
    await screen.findByText(/^120 relevés/)
    expect(screen.queryByText(/Densité stable/)).toBeNull()
  })

  it('propose d’importer les relevés du brassin Brewfather d’origine', async () => {
    renderPage()
    expect(await screen.findByText('Importer les relevés')).toBeInTheDocument()
  })
})
