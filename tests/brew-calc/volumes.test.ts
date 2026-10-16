import { describe, expect, it } from 'vitest'
import { calculateStrikeWaterTempC, calculateVolumes, estimateFinalVolumeFromPreBoil } from '@/lib/brew-calc/volumes'
import type { EquipmentProfile } from '@/lib/brew-calc/types'

const profile: EquipmentProfile = {
  name: 'Test rig',
  boilKettleVolumeL: 30,
  targetBatchVolumeL: 20,
  boilTimeMin: 60,
  evaporationRatePercentPerHour: 12,
  grainAbsorptionLPerKg: 1.0,
  waterToGrainRatioLPerKg: 3,
  hopAbsorptionL: 1.5,
  deadspaceL: 1.5,
  thermalShrinkagePercent: 4,
  mashEfficiencyPercent: 72,
  method: 'all-grain',
}

describe('calculateVolumes', () => {
  it('computes increasing volumes going backwards through the process', () => {
    const result = calculateVolumes(20, 5, profile)
    expect(result.volumeIntoFermenterL).toBe(20)
    expect(result.postBoilVolumeL).toBeGreaterThan(result.volumeIntoFermenterL)
    expect(result.preBoilVolumeL).toBeGreaterThan(result.postBoilVolumeL)
    expect(result.totalWaterNeededL).toBeGreaterThan(result.preBoilVolumeL)
  })

  it('is the mathematical inverse of estimateFinalVolumeFromPreBoil', () => {
    const result = calculateVolumes(20, 5, profile)
    const roundTrip = estimateFinalVolumeFromPreBoil(result.preBoilVolumeL, profile)
    expect(roundTrip).toBeCloseTo(20, 6)
  })

  it('requires more pre-boil volume for a longer boil (more evaporation)', () => {
    const shortBoil = calculateVolumes(20, 5, { ...profile, boilTimeMin: 30 })
    const longBoil = calculateVolumes(20, 5, { ...profile, boilTimeMin: 90 })
    expect(longBoil.preBoilVolumeL).toBeGreaterThan(shortBoil.preBoilVolumeL)
  })

  it('requires more total water for heavier grain bills (more absorption)', () => {
    const lightGrist = calculateVolumes(20, 3, profile)
    const heavyGrist = calculateVolumes(20, 8, profile)
    expect(heavyGrist.totalWaterNeededL).toBeGreaterThan(lightGrist.totalWaterNeededL)
  })

  it('splits total water into mash water (ratio x grain) and sparge water (the remainder)', () => {
    const result = calculateVolumes(20, 5, profile)
    expect(result.mashWaterL).toBeCloseTo(5 * profile.waterToGrainRatioLPerKg, 6)
    expect(result.spargeWaterL).toBeCloseTo(result.totalWaterNeededL - result.mashWaterL, 6)
    expect(result.mashWaterL + result.spargeWaterL).toBeCloseTo(result.totalWaterNeededL, 6)
  })

  it('caps mash water at total water needed when the ratio would exceed it (no negative sparge)', () => {
    const result = calculateVolumes(20, 1, { ...profile, waterToGrainRatioLPerKg: 50 })
    expect(result.mashWaterL).toBeCloseTo(result.totalWaterNeededL, 6)
    expect(result.spargeWaterL).toBe(0)
  })
})

describe('calculateStrikeWaterTempC', () => {
  it('matches the hand-verified reference example (67°C target, 20°C grain, 2.66 L/kg)', () => {
    const strikeTemp = calculateStrikeWaterTempC(67, 20, 15.17 / 5.71)
    expect(strikeTemp).toBeCloseTo(74.1, 1)
  })

  it('requires hotter strike water for colder grain', () => {
    const warmGrain = calculateStrikeWaterTempC(67, 20, 3)
    const coldGrain = calculateStrikeWaterTempC(67, 5, 3)
    expect(coldGrain).toBeGreaterThan(warmGrain)
  })

  it('needs less temperature overshoot with a higher water-to-grain ratio', () => {
    const thinMash = calculateStrikeWaterTempC(67, 20, 4)
    const thickMash = calculateStrikeWaterTempC(67, 20, 2)
    expect(thickMash).toBeGreaterThan(thinMash)
  })
})
