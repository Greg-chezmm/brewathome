import { describe, expect, it } from 'vitest'
import {
  calculateCellsNeededBillions,
  calculateDryYeastGrams,
  calculateLiquidPacksNeeded,
  calculateLiquidYeastViabilityPercent,
  checkYeastPitch,
  dryYeastSachetGrams,
  sgToPlato,
} from '@/lib/brew-calc/yeast'
import type { Yeast } from '@/lib/brew-calc/types'

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

describe('dryYeastSachetGrams', () => {
  it('reconnaît la marque au nom ou au laboratoire', () => {
    expect(dryYeastSachetGrams('SafAle US-05')).toBe(11.5)
    expect(dryYeastSachetGrams('LalBrew Abbaye')).toBe(11)
    expect(dryYeastSachetGrams('Mangrove Jack’s M31 Belgian Tripel')).toBe(10)
    expect(dryYeastSachetGrams("Mangrove Jack's")).toBe(10)
    expect(dryYeastSachetGrams('Belgian Tripel')).toBe(11.5)
  })
})

describe('checkYeastPitch', () => {
  const dry: Yeast = { name: 'Mangrove Jack’s M31', type: 'dry', style: 'ale', attenuationPercent: 82 }

  it('signale une quantité absente', () => {
    expect(checkYeastPitch(dry, 12, 1.082).status).toBe('missing')
  })

  it('convertit les sachets avec le poids de la marque et juge la quantité', () => {
    // 12 L à 1.082 (≈ 19,8 °P) : ≈ 178 milliards de cellules, soit ≈ 18 g de levure sèche.
    const one = checkYeastPitch({ ...dry, amount: 1, amountUnit: 'pkg' }, 12, 1.082)
    expect(one.needed).toBeCloseTo(17.8, 0)
    expect(one.planned).toBe(10)
    expect(one.sachetG).toBe(10)
    expect(one.packs).toBe(2)
    expect(one.status).toBe('low')
    expect(checkYeastPitch({ ...dry, amount: 2, amountUnit: 'pkg' }, 12, 1.082).status).toBe('ok')
  })

  it('privilégie le poids de sachet saisi', () => {
    const check = checkYeastPitch({ ...dry, amount: 1, amountUnit: 'pkg', sachetG: 20 }, 12, 1.082)
    expect(check.planned).toBe(20)
    expect(check.status).toBe('ok')
  })

  it('compare les grammes directement et tolère 10 % de moins', () => {
    expect(checkYeastPitch({ ...dry, amount: 16.5, amountUnit: 'g' }, 12, 1.082).status).toBe('ok')
    expect(checkYeastPitch({ ...dry, amount: 12, amountUnit: 'g' }, 12, 1.082).status).toBe('low')
  })

  it('compte 100 milliards de cellules par sachet liquide, sans juger les ml', () => {
    const liquid: Yeast = { name: 'WLP530 Abbey Ale', type: 'liquid', style: 'ale', attenuationPercent: 77 }
    const check = checkYeastPitch({ ...liquid, amount: 1, amountUnit: 'pkg' }, 12, 1.082)
    expect(check.unit).toBe('cells')
    expect(check.packs).toBe(2)
    expect(check.status).toBe('low')
    expect(checkYeastPitch({ ...liquid, amount: 500, amountUnit: 'ml' }, 12, 1.082).status).toBe('unknown')
  })
})
