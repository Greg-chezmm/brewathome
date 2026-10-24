import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BatchDeviceLink } from '@/components/devices/BatchDeviceLink'

const listDevices = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db/queries/devices', () => ({
  listDevices,
  createDevice: vi.fn(),
  setDeviceActiveBatch: vi.fn(),
}))
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

const device = (id: string, name: string, activeBatchId: string | null) => ({
  id,
  type: 'ispindel' as const,
  name,
  apiToken: 't',
  activeBatchId,
  settings: {},
  lastSeenAt: null,
  createdAt: '2026-10-01T00:00:00Z',
})

function renderLink() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <BatchDeviceLink batchId="b1" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BatchDeviceLink', () => {
  beforeEach(() => listDevices.mockReset())

  it('ne propose que les appareils libres', async () => {
    listDevices.mockResolvedValue([device('d1', 'iSpindel libre', null), device('d2', 'iSpindel pris', 'autre')])
    renderLink()
    expect(await screen.findByRole('option', { name: 'iSpindel libre' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /iSpindel pris/ })).not.toBeInTheDocument()
  })

  it('propose d’en créer un quand tous les appareils sont déjà pris', async () => {
    listDevices.mockResolvedValue([device('d2', 'iSpindel pris', 'autre')])
    renderLink()
    expect(await screen.findByRole('button', { name: 'Créer et associer' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Appareil à associer' })).not.toBeInTheDocument()
  })
})
