import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BatchBottling } from '@/pages/batches/BatchBottling'

const api = vi.hoisted(() => ({
  updateBatchPackaging: vi.fn(async () => undefined),
  updateBatchMeasurements: vi.fn(async () => undefined),
}))

vi.mock('@/lib/db/queries/batches', () => ({
  getBatchWithDetails: async () => ({
    id: 'b1',
    name: 'Pale ale',
    status: 'conditioning',
    measurements: { fermenterVolumeL: 20, packagingVolumeL: null },
    packaging: { bottle33: 0, bottle50: 0, bottle75: 0, keg5: 0 },
    recipeSnapshot: { targetVolumeL: 19, equipmentProfileId: 'e1' },
  }),
  updateBatchPackaging: api.updateBatchPackaging,
  updateBatchMeasurements: api.updateBatchMeasurements,
}))
vi.mock('@/lib/db/queries/equipmentProfiles', () => ({ getEquipmentProfile: async () => ({ fermenterLossL: 1 }) }))

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/batches/b1/bottling']}>
        <Routes>
          <Route path="/batches/:batchId/bottling" element={<BatchBottling />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('Embouteillage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('additionne les litres et les compare au volume à conditionner', async () => {
    renderPage()
    // 20 L au fermenteur − 1 L de pertes = 19 L à conditionner.
    expect(await screen.findByText(/19,0 L à conditionner/)).toBeInTheDocument()
    type('Bouteilles 33 cl', '24')
    type('Bouteilles 75 cl', '10')
    type('Fûts 5 L', '1')
    // 24 × 0,33 + 10 × 0,75 + 5 = 7,92 + 7,5 + 5 = 20,42 L : 1,4 L de plus.
    expect(screen.getByText('20,42 L conditionnés')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/de plus/)
  })

  it('signale les litres manquants', async () => {
    renderPage()
    await screen.findByText(/à conditionner/)
    type('Bouteilles 50 cl', '30')
    expect(screen.getByRole('status')).toHaveTextContent(/Il manque 4,0 L/)
  })

  it('enregistre les contenants, et reprend le total comme volume conditionné', async () => {
    renderPage()
    await screen.findByText(/à conditionner/)
    type('Bouteilles 50 cl', '38')
    fireEvent.click(screen.getByText('Enregistrer'))
    await waitFor(() =>
      expect(api.updateBatchPackaging).toHaveBeenCalledWith('b1', { bottle33: 0, bottle50: 38, bottle75: 0, keg5: 0 }),
    )
    fireEvent.click(screen.getByText('Reprendre comme volume conditionné'))
    await waitFor(() => expect(api.updateBatchMeasurements).toHaveBeenCalledWith('b1', { packagingVolumeL: 19 }))
  })
})
