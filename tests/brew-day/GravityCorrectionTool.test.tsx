import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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

  it('reprend la densité et le volume déjà mesurés', () => {
    render(<GravityCorrectionTool targetGravity={1.077} measuredGravity={1.05} measuredVolumeL={23.5} />)
    const values = screen.getAllByRole('spinbutton').map((i) => (i as HTMLInputElement).value)
    expect(values).toEqual(['23.5', '1.050', '1.077'])
    expect(screen.getByText(/Densité trop basse/)).toBeDefined()
  })

  it('garde la saisie manuelle de l’utilisateur', () => {
    render(<GravityCorrectionTool measuredGravity={1.05} />)
    const gravity = screen.getAllByRole('spinbutton')[1] as HTMLInputElement
    fireEvent.change(gravity, { target: { value: '1.060' } })
    expect(gravity.value).toBe('1.060')
  })

  it('reste à 20 L et vide sans mesure', () => {
    render(<GravityCorrectionTool />)
    const values = screen.getAllByRole('spinbutton').map((i) => (i as HTMLInputElement).value)
    expect(values).toEqual(['20', '', ''])
  })
})
