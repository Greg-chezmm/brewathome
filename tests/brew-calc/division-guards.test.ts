import { describe, expect, it } from 'vitest'
import { calculateDilutionWater } from '@/lib/brew-calc/gravity-correction'
import { computeRecipe, type RecipeStatsInput } from '@/lib/brew-calc/recipe-stats'
import { calculateStrikeWaterTempC, calculateVolumes } from '@/lib/brew-calc/volumes'
import { apparentAttenuation } from '@/lib/brew-day/measurements'
import type { EquipmentProfile } from '@/lib/brew-calc/types'

const profile: EquipmentProfile = {
  name: 'Test rig',
  boilKettleVolumeL: 30,
  mashTunVolumeL: null,
  targetBatchVolumeL: 20,
  boilTimeMin: 60,
  evaporationRateLPerHour: 3,
  grainAbsorptionLPerKg: 1.0,
  waterToGrainRatioLPerKg: 3,
  hopAbsorptionL: 1.5,
  deadspaceL: 1.5,
  mashTunDeadspaceL: 1,
  fermenterLossL: 0,
  hopUtilizationPercent: 100,
  thermalShrinkagePercent: 4,
  mashEfficiencyPercent: 72,
  method: 'all-grain',
}

const base: RecipeStatsInput = {
  fermentables: [{ name: 'Pale Ale', type: 'grain', amountKg: 5, colorLovibond: 3, yieldPercent: 80 }],
  hops: [{ name: 'Magnum', amountG: 30, alphaAcidPercent: 12, timeMin: 60, use: 'boil' }],
  yeasts: [{ name: 'US-05', type: 'dry', style: 'ale', attenuationPercent: 80 }],
  targetVolumeL: 20,
  mashEfficiencyPercent: 72,
  ibuFormula: 'tinseth',
}

const allFinite = (values: Array<number | null>) => values.every((v) => v === null || Number.isFinite(v))

describe('computeRecipe — volume nul ou négatif', () => {
  it.each([0, -5])('ne produit aucune valeur infinie ni NaN pour un volume de %s L (sans équipement)', (targetVolumeL) => {
    const calc = computeRecipe({ ...base, targetVolumeL })
    expect(allFinite([calc.og, calc.fg, calc.ibu, calc.srm, calc.abv, calc.ebc, calc.boilGravity])).toBe(true)
    expect(calc.og).toBe(1)
  })

  it('idem avec un profil d’équipement', () => {
    const calc = computeRecipe({ ...base, targetVolumeL: 0, equipment: { ...profile, hopAbsorptionL: 0, deadspaceL: 0 } })
    expect(allFinite([calc.og, calc.fg, calc.ibu, calc.srm, calc.abv, calc.preBoilGravity])).toBe(true)
  })
})

describe('calculateDilutionWater — entrées invalides', () => {
  it('refuse une densité cible ≤ 1 (division par zéro)', () => {
    expect(() => calculateDilutionWater(20, 1.06, 1)).toThrow()
    expect(() => calculateDilutionWater(20, 1.06, 0.99)).toThrow()
  })

  it('refuse un volume ≤ 0', () => {
    expect(() => calculateDilutionWater(0, 1.06, 1.05)).toThrow()
    expect(() => calculateDilutionWater(-2, 1.06, 1.05)).toThrow()
  })
})

describe('apparentAttenuation — densité initiale ≤ 1', () => {
  it('rend 0 plutôt que Infinity ou NaN', () => {
    expect(apparentAttenuation(1, 1)).toBe(0)
    expect(apparentAttenuation(1, 1.01)).toBe(0)
    expect(apparentAttenuation(0.99, 1)).toBe(0)
  })

  it('ne change pas le cas normal', () => {
    expect(apparentAttenuation(1.05, 1.01)).toBeCloseTo(80, 6)
  })
})

describe('calculateVolumes — contraction thermique aberrante', () => {
  it.each([100, 150])('reste fini pour une contraction de %s %', (thermalShrinkagePercent) => {
    const v = calculateVolumes(20, 5, 60, { ...profile, thermalShrinkagePercent })
    expect(Number.isFinite(v.postBoilVolumeL)).toBe(true)
    expect(Number.isFinite(v.preBoilVolumeL)).toBe(true)
    expect(v.postBoilVolumeL).toBeGreaterThan(0)
  })

  it('ne change pas le cas normal (4 %)', () => {
    expect(calculateVolumes(20, 5, 60, profile).postBoilVolumeL).toBeCloseTo(23 / 0.96, 8)
  })
})

describe('calculateStrikeWaterTempC — ratio eau/grain ≤ 0', () => {
  it.each([0, -1])('rend la température visée, sans Infinity, pour un ratio de %s', (ratio) => {
    expect(calculateStrikeWaterTempC(66, 20, ratio)).toBe(66)
  })

  it('ne change pas le cas normal', () => {
    expect(calculateStrikeWaterTempC(66, 20, 3)).toBeCloseTo(66 + (0.4 * 46) / 3, 8)
  })
})
