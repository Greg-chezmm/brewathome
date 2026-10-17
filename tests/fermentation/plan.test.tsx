import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FermentationPlan } from '@/components/batches/FermentationPlan'
import { fermentationStartTime, primingTemperatureC } from '@/lib/fermentation/plan'
import type { FermentationStep } from '@/lib/brew-calc/fermentation-profile'
import type { Hop } from '@/lib/brew-calc/types'

const DAY = 24 * 60 * 60 * 1000
const start = new Date('2026-10-01T18:00:00').getTime()
const profile: FermentationStep[] = [
  { type: 'primary', tempC: 18, days: 12 },
  { type: 'cold-crash', tempC: 2, days: 2 },
]
const citra: Hop = { name: 'Citra', amountG: 50, alphaAcidPercent: 12, timeMin: 0, use: 'dry-hop', dryHopDays: 4, dryHopDay: 8 }

function renderPlan(elapsedDays: number, currentTempC: number | null = null, steps = profile) {
  render(
    <MemoryRouter>
      <FermentationPlan batchId="b1" steps={steps} hops={[citra]} start={start} now={start + elapsedDays * DAY} currentTempC={currentTempC} />
    </MemoryRouter>,
  )
}

describe('début de fermentation et température de resucrage', () => {
  it('part de l’ensemencement, à défaut de la date de brassage puis du premier relevé', () => {
    const pitch = { stepType: 'pitch' as const, actualStartAt: '2026-10-01T17:50:00Z', actualEndAt: '2026-10-01T18:00:00Z' }
    expect(fermentationStartTime([pitch], '2026-09-30', 1)).toBe(new Date('2026-10-01T18:00:00Z').getTime())
    expect(fermentationStartTime([], '2026-09-30', 1)).toBe(new Date('2026-09-30').getTime())
    expect(fermentationStartTime([], null, 42)).toBe(42)
  })

  it('retient la mesure saisie, sinon le relevé le plus chaud, sinon le profil', () => {
    expect(primingTemperatureC(21, [19, 23], [18])).toBe(21)
    expect(primingTemperatureC(null, [19, null, 23], [18])).toBe(23)
    expect(primingTemperatureC(null, [], [18, 20])).toBe(20)
    expect(primingTemperatureC(null, [], [])).toBeNull()
  })
})

describe('FermentationPlan', () => {
  it('montre l’étape en cours, le jour et le prochain dry hop', () => {
    renderPlan(5.2, 18.4)
    expect(screen.getByText('Jour 5 sur 14')).toBeInTheDocument()
    expect(screen.getByText(/en cours · encore 7 jours/)).toBeInTheDocument()
    expect(screen.getByText('dans 3 jours')).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('signale une température loin de la consigne', () => {
    renderPlan(1, 22)
    expect(screen.getByRole('status')).toHaveTextContent('4 °C au-dessus de la consigne (18 °C)')
  })

  it('dry hop du jour', () => {
    renderPlan(8.5)
    expect(screen.getByText('aujourd’hui')).toBeInTheDocument()
  })

  it('profil terminé', () => {
    renderPlan(15)
    expect(screen.getByText(/Profil terminé/)).toBeInTheDocument()
    expect(screen.getByText('fait')).toBeInTheDocument()
  })

  it('sans profil : invite à le compléter', () => {
    renderPlan(3, null, [])
    expect(screen.getByRole('link', { name: 'L’ajouter' })).toHaveAttribute('href', '/batches/b1/edit-recipe')
  })
})
