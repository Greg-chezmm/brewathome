import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FermentationReminders } from '@/components/batches/FermentationReminders'
import type { Fermentable, Hop } from '@/lib/brew-calc/types'

const hops: Hop[] = [{ name: 'Citra', amountG: 50, alphaAcidPercent: 12, timeMin: 0, use: 'dry-hop', dryHopDay: 7, dryHopDays: 4 }]
const fermentables: Fermentable[] = [
  { name: 'Sucre candi', type: 'sugar', amountKg: 0.3, colorLovibond: 1, yieldPercent: 100, use: 'fermentation' },
]
const start = new Date(2026, 9, 18, 18, 0).getTime()
const day = 24 * 60 * 60 * 1000

function renderReminders(now: number, startTime: number | null = start) {
  render(
    <FermentationReminders
      batch={{ id: 'b1', name: 'Brune forte' }}
      steps={[{ type: 'primary', tempC: 19, days: 14 }]}
      hops={hops}
      fermentables={fermentables}
      start={startTime}
      now={now}
    />,
  )
}

describe('FermentationReminders', () => {
  it('liste les rappels à venir, chacun avec son lien Google Agenda', () => {
    renderReminders(start + 5 * day)
    // L'ajout de sucre (jour 3) est passé : il n'est plus proposé.
    expect(screen.queryByText(/Sucre candi \(300 g\)/)).not.toBeInTheDocument()
    expect(screen.getByText('Dry hop : Citra (50 g)')).toBeInTheDocument()
    expect(screen.getByText('Fin de la fermentation : vérifier la densité, conditionner')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Google Agenda/ })).toHaveLength(3)
  })

  it('jour d’ajout en fermentation réglable', () => {
    renderReminders(start + 5 * day)
    fireEvent.change(screen.getByLabelText("Jour d'ajout de Sucre candi"), { target: { value: '6' } })
    expect(screen.getByText('Ajout en fermentation : Sucre candi (300 g)')).toBeInTheDocument()
  })

  it('télécharge le fichier d’agenda', () => {
    const createObjectURL = vi.fn(() => 'blob:rappels')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderReminders(start)
    fireEvent.click(screen.getByRole('button', { name: /Tout ajouter à mon agenda/ }))
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalled()
    click.mockRestore()
    vi.unstubAllGlobals()
  })

  it('sans date de début : explique quoi renseigner', () => {
    renderReminders(start, null)
    expect(screen.getByText(/Renseignez la date de brassage/)).toBeInTheDocument()
  })
})
