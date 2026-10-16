import { describe, expect, it } from 'vitest'
import { calculateFG, calculateOG } from '@/lib/brew-calc/gravity'
import type { Fermentable } from '@/lib/brew-calc/types'

describe('calculateOG', () => {
  it('matches a hand-computed reference recipe (Weyermann Pale Ale malt, 2.2kg, 82.2% yield, BIAB 13L, 72% efficiency)', () => {
    const fermentables: Fermentable[] = [
      { name: 'Malt Pale Ale', type: 'grain', amountKg: 2.2, colorLovibond: 3, yieldPercent: 82.2 },
      { name: 'Malt Froment Blanc', type: 'grain', amountKg: 1.4, colorLovibond: 2, yieldPercent: 83.0 },
    ]
    const og = calculateOG(fermentables, 13.0, 72.0)
    // Recette réelle "Whipa" (BeerXML Little Bock) annonce EST_OG 1.061 pour ces mêmes quantités.
    expect(og).toBeCloseTo(1.061, 2)
  })

  it('increases with more fermentables and decreases with more volume', () => {
    const base: Fermentable[] = [
      { name: 'Pale malt', type: 'grain', amountKg: 5, colorLovibond: 3, yieldPercent: 80 },
    ]
    const ogSmallVolume = calculateOG(base, 20, 75)
    const ogLargeVolume = calculateOG(base, 40, 75)
    expect(ogSmallVolume).toBeGreaterThan(ogLargeVolume)
  })

  it('applies 100% of yield for extracts/sugars regardless of mash efficiency', () => {
    const sugarOnly: Fermentable[] = [
      { name: 'Sucre de table', type: 'sugar', amountKg: 1, colorLovibond: 0, yieldPercent: 100 },
    ]
    const ogAt50 = calculateOG(sugarOnly, 20, 50)
    const ogAt90 = calculateOG(sugarOnly, 20, 90)
    expect(ogAt50).toBeCloseTo(ogAt90, 10)
  })
})

describe('calculateFG', () => {
  it('computes FG from OG and apparent attenuation', () => {
    expect(calculateFG(1.05, 75)).toBeCloseTo(1.0125, 4)
  })

  it('returns OG unchanged at 0% attenuation', () => {
    expect(calculateFG(1.05, 0)).toBeCloseTo(1.05, 10)
  })

  it('returns 1.000 at 100% attenuation', () => {
    expect(calculateFG(1.05, 100)).toBeCloseTo(1.0, 10)
  })
})
