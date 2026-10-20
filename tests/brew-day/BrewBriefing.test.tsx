import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BrewBriefing } from '@/components/brew-day/BrewBriefing'
import { BrewDayEnd } from '@/components/brew-day/BrewDayEnd'
import type { BatchStep } from '@/lib/db/queries/batches'

const step = (status: BatchStep['status']): BatchStep => ({
  id: 's1',
  stepType: 'mash',
  label: 'Empâtage',
  orderIndex: 0,
  plannedDurationMin: 60,
  triggerTimeMin: null,
  status,
  actualStartAt: null,
  actualEndAt: null,
  checkedItems: [],
  session: null,
  notes: null,
})

describe('Avant de commencer', () => {
  it('affiche la durée et la sécurité tant que rien n’est démarré, et se masque', () => {
    render(<BrewBriefing steps={[step('todo')]} />)
    expect(screen.getByText('1 h')).toBeInTheDocument()
    expect(screen.getByText(/Brûlures/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('J’ai compris, masquer'))
    expect(screen.queryByText(/Brûlures/)).not.toBeInTheDocument()
  })

  it('disparaît dès qu’une étape est commencée', () => {
    render(<BrewBriefing steps={[step('in-progress')]} />)
    expect(screen.queryByText('Avant de commencer')).not.toBeInTheDocument()
  })
})

describe('Fin de Brew Day', () => {
  it('annonce la durée de fermentation, la mesure de la DF et le lien vers l’embouteillage', () => {
    render(
      <MemoryRouter>
        <BrewDayEnd batchId="b1" fermentationSteps={[{ type: 'primary', tempC: 19, days: 10 }, { type: 'conditioning', tempC: 4, days: 4 }]} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/environ 14 jours/)).toBeInTheDocument()
    expect(screen.getByText(/2 à 3 jours/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Embouteillage' })).toHaveAttribute('href', '/batches/b1/bottling')
  })
})
