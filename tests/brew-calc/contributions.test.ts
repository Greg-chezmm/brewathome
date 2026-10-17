import { describe, expect, it } from 'vitest'
import { buGuRatio, fermentableContributions } from '@/lib/brew-calc/contributions'
import { computeRecipe } from '@/lib/brew-calc/recipe-stats'
import type { Fermentable } from '@/lib/brew-calc/types'

const fermentables: Fermentable[] = [
  { name: 'Pale Ale', type: 'grain', amountKg: 4.8, colorLovibond: 3, yieldPercent: 80 },
  { name: 'Crystal 60', type: 'grain', amountKg: 0.4, colorLovibond: 60, yieldPercent: 74 },
  { name: 'Sucre', type: 'sugar', amountKg: 0.3, colorLovibond: 0, yieldPercent: 100 },
]

describe('fermentableContributions', () => {
  const contributions = fermentableContributions(fermentables, 75, 25)

  it('répartit le poids', () => {
    expect(contributions.map((c) => c.percentOfGrist.toFixed(1))).toEqual(['87.3', '7.3', '5.5'])
  })

  it('la somme des points retrouve la DI du moteur', () => {
    const { og } = computeRecipe({
      fermentables,
      hops: [],
      yeasts: [],
      targetVolumeL: 25,
      mashEfficiencyPercent: 75,
      ibuFormula: 'tinseth',
    })
    const points = contributions.reduce((sum, c) => sum + c.gravityPoints, 0)
    expect(1 + points / 1000).toBeCloseTo(og, 6)
  })

  it('le sucre ajouté en ébullition échappe à l’efficacité d’empâtage', () => {
    // 0,3 kg × 46 PPG × 8,345 / 25 L ≈ 4,6 points.
    expect(contributions[2].gravityPoints).toBeCloseTo((0.3 * 46 * 8.345) / 25, 6)
  })

  it('la couleur vient surtout du crystal', () => {
    expect(contributions[1].colorPercent).toBeGreaterThan(60)
    expect(contributions.reduce((sum, c) => sum + c.colorPercent, 0)).toBeCloseTo(100, 6)
  })

  it('un champ vidé en cours de saisie ne casse pas le calcul', () => {
    const [first] = fermentableContributions([{ ...fermentables[0], amountKg: Number.NaN }, fermentables[1]], 75, 25)
    expect(first).toEqual({ percentOfGrist: 0, gravityPoints: 0, colorPercent: 0 })
  })
})

describe('buGuRatio', () => {
  it('IBU / unités de densité', () => {
    expect(buGuRatio(40, 1.05)).toBeCloseTo(0.8, 6)
    expect(buGuRatio(40, 1)).toBeNull()
  })
})
