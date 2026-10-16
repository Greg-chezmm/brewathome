import { describe, expect, it } from 'vitest'
import { calculateSRM } from '@/lib/brew-calc/color'
import { ebcToSrm, srmToEbc } from '@/lib/brew-calc/units'
import type { Fermentable } from '@/lib/brew-calc/types'

describe('calculateSRM', () => {
  it('computes a light SRM for a pale malt recipe', () => {
    const fermentables: Fermentable[] = [
      { name: 'Pale malt', type: 'grain', amountKg: 5, colorLovibond: 2, yieldPercent: 80 },
    ]
    const srm = calculateSRM(fermentables, 20)
    expect(srm).toBeGreaterThan(1)
    expect(srm).toBeLessThan(5)
  })

  it('increases with darker/more malt', () => {
    const light: Fermentable[] = [
      { name: 'Pale malt', type: 'grain', amountKg: 5, colorLovibond: 2, yieldPercent: 80 },
    ]
    const dark: Fermentable[] = [
      { name: 'Roasted malt', type: 'grain', amountKg: 5, colorLovibond: 300, yieldPercent: 55 },
    ]
    expect(calculateSRM(dark, 20)).toBeGreaterThan(calculateSRM(light, 20))
  })
})

describe('SRM <-> EBC conversion', () => {
  it('round-trips approximately (1.97 and 0.508 are independently rounded industry constants, not exact reciprocals)', () => {
    expect(srmToEbc(10)).toBeCloseTo(19.7, 5)
    expect(ebcToSrm(19.7)).toBeCloseTo(10, 1)
  })
})
