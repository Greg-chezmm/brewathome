import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { IspindelCalibration } from '@/pages/devices/IspindelCalibration'

vi.mock('@/lib/db/queries/devices', () => ({
  listDevices: vi.fn().mockResolvedValue([]),
  updateDeviceSettings: vi.fn(),
}))

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <IspindelCalibration />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function addPoint(tilt: string, reading: string) {
  fireEvent.change(screen.getByLabelText(/Lecture de densité/), { target: { value: reading } })
  fireEvent.change(screen.getByLabelText('Angle (tilt)'), { target: { value: tilt } })
  fireEvent.click(screen.getByRole('button', { name: /^Ajouter/ }))
}

beforeEach(() => localStorage.clear())

describe('Calibration de l’iSpindel', () => {
  it('demande des points avant de proposer un polynôme', () => {
    renderPage()
    expect(screen.getByText(/Ajoutez au moins 2 points/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Ajouter/ })).toBeDisabled()
  })

  it('calcule un polynôme à partir des points, en Plato, lecture à 20 °C', () => {
    renderPage()
    ;[
      ['25', '0'],
      ['40', '8'],
      ['55', '15'],
    ].forEach(([tilt, plato]) => addPoint(tilt, plato))
    expect(screen.getByText('Points relevés (3)')).toBeInTheDocument()
    expect(screen.getByTestId('polynomial').textContent).toMatch(/\*tilt/)
    expect(screen.getByRole('button', { name: /Degré 2/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: /Courbes de calibration/ })).toBeInTheDocument()
  })

  it('supprime un point et reprend les points après rechargement', () => {
    renderPage()
    addPoint('30', '5')
    addPoint('50', '12')
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le point 1' }))
    expect(screen.getByText('Points relevés (1)')).toBeInTheDocument()
  })

  it('convertit les points en changeant d’unité', () => {
    renderPage()
    addPoint('40', '12.5')
    fireEvent.change(screen.getByLabelText(/Unité de densité/), { target: { value: 'sg' } })
    expect(screen.getByText('1.0505')).toBeInTheDocument()
  })

  it('retrouve les points enregistrés au rechargement', () => {
    renderPage()
    addPoint('30', '5')
    renderPage()
    expect(screen.getAllByText('Points relevés (1)').length).toBe(2)
  })
})
