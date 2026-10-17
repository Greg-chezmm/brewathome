import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DevicesList } from '@/pages/devices/DevicesList'

const updateDeviceSettings = vi.fn(async () => undefined)

vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@/lib/db/queries/batches', () => ({ listBatches: async () => [] }))
vi.mock('@/lib/db/queries/devices', () => ({
  listDevices: async () => [
    {
      id: 'd1',
      type: 'ispindel',
      name: 'iSpindel Vert',
      apiToken: 'abc123',
      activeBatchId: null,
      settings: { polynomial: '0.0052*tilt^2 - 2.35' },
      lastSeenAt: new Date(Date.now() - 3 * 60_000).toISOString(),
      createdAt: '2026-01-01',
    },
    { id: 'd2', type: 'ispindel', name: 'iSpindel Rouge', apiToken: 'zz', activeBatchId: null, settings: {}, lastSeenAt: null, createdAt: '2026-01-01' },
  ],
  createDevice: vi.fn(),
  deleteDevice: vi.fn(),
  setDeviceActiveBatch: vi.fn(),
  updateDeviceSettings: (...args: unknown[]) => updateDeviceSettings(...(args as [])),
}))

describe('Appareils', () => {
  it('affiche les champs de l’iSpindel et enregistre ses réglages', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DevicesList />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('/functions/v1/ispindel?token=abc123')).toBeInTheDocument()
    expect(screen.getAllByText('HTTPS Post')).toHaveLength(2)
    // Connecté sans brassin : on le dit, mesures non enregistrées.
    expect(screen.getByText('Connecté · dernier signal il y a 3 min')).toBeInTheDocument()
    expect(screen.getByText(/aucun brassin suivi/)).toBeInTheDocument()
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
})
