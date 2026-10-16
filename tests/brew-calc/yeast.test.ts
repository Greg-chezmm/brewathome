import { describe, expect, it } from 'vitest'
import {
  calculateCellsNeededBillions,
  calculateDryYeastGrams,
  calculateLiquidPacksNeeded,
  calculateLiquidYeastViabilityPercent,
  sgToPlato,
} from '@/lib/brew-calc/yeast'

describe('sgToPlato', () => {
  it('converts common SG values to the expected °Plato', () => {
    expect(sgToPlato(1.04)).toBeCloseTo(10, 0)
    expect(sgToPlato(1.05)).toBeCloseTo(12.4, 1)
    expect(sgToPlato(1.0)).toBeCloseTo(0, 1)
  })
})

describe('calculateCellsNeededBillions', () => {
  it('requires more cells for lager than ale at the same OG/volume', () => {
    const ale = calculateCellsNeededBillions(20, 1.05, 'ale')
    const lager = calculateCellsNeededBillions(20, 1.05, 'lager')
    expect(lager).toBeCloseTo(ale * 2, 5)
  })

  it('scales linearly with volume', () => {
    const small = calculateCellsNeededBillions(10, 1.05, 'ale')
    const large = calculateCellsNeededBillions(20, 1.05, 'ale')
    expect(large).toBeCloseTo(small * 2, 5)
  })
})

describe('calculateLiquidYeastViabilityPercent', () => {
  it('starts near 97% for a fresh pack', () => {
    expect(calculateLiquidYeastViabilityPercent(0)).toBeCloseTo(97, 5)
  })

  it('declines with age and never goes below 0', () => {
    expect(calculateLiquidYeastViabilityPercent(30)).toBeCloseTo(76, 5)
    expect(calculateLiquidYeastViabilityPercent(1000)).toBe(0)
  })
})

describe('calculateLiquidPacksNeeded', () => {
  it('needs more packs as the pack ages', () => {
    const freshPacks = calculateLiquidPacksNeeded(180, 0)
    const oldPacks = calculateLiquidPacksNeeded(180, 60)
    expect(oldPacks).toBeGreaterThanOrEqual(freshPacks)
  })

  it('rounds up to a whole number of packs', () => {
    const packs = calculateLiquidPacksNeeded(150, 0, 100)
    expect(Number.isInteger(packs)).toBe(true)
    expect(packs).toBeGreaterThanOrEqual(2)
  })
})

describe('calculateDryYeastGrams', () => {
  it('returns a higher range for lager than ale', () => {
    const ale = calculateDryYeastGrams(20, 'ale')
    const lager = calculateDryYeastGrams(20, 'lager')
    expect(lager.minGrams).toBeGreaterThan(ale.minGrams)
    expect(lager.maxGrams).toBeGreaterThan(ale.maxGrams)
  })

  it('scales linearly with volume', () => {
    const small = calculateDryYeastGrams(10, 'ale')
    const large = calculateDryYeastGrams(20, 'ale')
    expect(large.minGrams).toBeCloseTo(small.minGrams * 2, 5)
  })
})
