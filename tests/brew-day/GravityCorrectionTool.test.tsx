import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GravityCorrectionTool } from '@/components/brew-day/GravityCorrectionTool'

// Champs : volume, densité mesurée, densité cible.
describe('Outil « Corriger la densité »', () => {
  it('arrondit la densité cible à 3 décimales (la DI estimée de la recette n’est pas arrondie)', () => {
    render(<GravityCorrectionTool targetGravity={1.0774372753776043} />)
    expect(screen.getAllByRole('spinbutton')[2]).toHaveValue(1.077)
  })

  it('laisse le champ vide sans densité cible', () => {
    render(<GravityCorrectionTool />)
    expect(screen.getAllByRole('spinbutton')[2]).toHaveValue(null)
  })
})
