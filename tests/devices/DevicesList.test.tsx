import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { DevicesList } from '@/pages/devices/DevicesList'

const updateDeviceSettings = vi.fn(async () => undefined)
const updateDeviceGravityUnit = vi.fn(async () => 12)

vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@/lib/db/queries/batches', () => ({
  listBatches: async () => [{ id: 'b9', name: 'Barley wine', status: 'completed', brewDate: null, createdAt: '2025-10-18' }],
}))
vi.mock('@/lib/db/queries/devices', () => ({
  listDevices: async () => [
    {
      id: 'd1',
      type: 'ispindel',
      name: 'iSpindel Vert',
      apiToken: 'abc123',
      activeBatchId: 'b9',
      settings: { polynomial: '0.0052*tilt^2 - 2.35' },
      gravityUnit: 'auto',
      lastSeenAt: new Date(Date.now() - 3 * 60_000).toISOString(),
      createdAt: '2026-01-01',
    },
    { id: 'd2', type: 'ispindel', name: 'iSpindel Rouge', apiToken: 'zz', activeBatchId: null, settings: {}, gravityUnit: 'sg', lastSeenAt: null, createdAt: '2026-01-01' },
  ],
  createDevice: vi.fn(),
  deleteDevice: vi.fn(),
  setDeviceActiveBatch: vi.fn(),
  updateDeviceSettings: (...args: unknown[]) => updateDeviceSettings(...(args as [])),
  updateDeviceGravityUnit: (...args: unknown[]) => updateDeviceGravityUnit(...(args as [])),
}))

describe('Appareils', () => {
  it('affiche les champs de l’iSpindel et enregistre ses réglages', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <DevicesList />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText('/functions/v1/ispindel?token=abc123')).toBeInTheDocument()
    expect(screen.getAllByText('HTTPS Post')).toHaveLength(2)
    expect(screen.getByText('Connecté · dernier signal il y a 3 min')).toBeInTheDocument()
    // Brassin terminé encore rattaché : visible (donc détachable) ; aucun autre brassin proposé.
    expect((screen.getByRole('option', { name: 'Barley wine (terminé)', selected: true }) as HTMLOptionElement).value).toBe('b9')
    expect(screen.getAllByRole('option', { name: 'Barley wine (terminé)' })).toHaveLength(1)
    expect(screen.getAllByText(/Aucun brassin en cours/)).toHaveLength(2)
    expect(screen.getByText('Jamais connecté')).toBeInTheDocument()
    expect(screen.getByDisplayValue('0.0052*tilt^2 - 2.35')).toBeInTheDocument()

    fireEvent.change(screen.getAllByLabelText(/Facteur batterie/)[0], { target: { value: '191,80' } })
    fireEvent.click(screen.getAllByText('Enregistrer les réglages')[0])
    await waitFor(() =>
      expect(updateDeviceSettings).toHaveBeenCalledWith(
        'd1',
        expect.objectContaining({ polynomial: '0.0052*tilt^2 - 2.35', batteryFactor: 191.8 }),
      ),
    )
    expect(await screen.findByText('Réglages enregistrés ✓')).toBeInTheDocument()
  })

  it('règle l’unité du polynôme et annonce les relevés recalculés', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <DevicesList />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    const selects = await screen.findAllByLabelText('Unité du polynôme')
    expect((selects[0] as HTMLSelectElement).value).toBe('auto')
    expect((selects[1] as HTMLSelectElement).value).toBe('sg')

    fireEvent.change(selects[0], { target: { value: 'plato' } })
    await waitFor(() => expect(updateDeviceGravityUnit).toHaveBeenCalledWith('d1', 'plato'))
    expect(await screen.findByText('Unité enregistrée ✓ 12 relevé(s) recalculé(s).')).toBeInTheDocument()
  })

  it('affiche l’erreur si l’unité ne peut pas être enregistrée', async () => {
    updateDeviceGravityUnit.mockRejectedValueOnce(new Error('réseau indisponible'))
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <DevicesList />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    const selects = await screen.findAllByLabelText('Unité du polynôme')
    fireEvent.change(selects[1], { target: { value: 'auto' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('réseau indisponible')
  })
})
