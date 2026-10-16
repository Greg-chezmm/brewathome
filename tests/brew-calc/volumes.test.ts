import { describe, expect, it } from 'vitest'
import { calculateVolumes, estimateFinalVolumeFromPreBoil } from '@/lib/brew-calc/volumes'
import type { EquipmentProfile } from '@/lib/brew-calc/types'

const profile: EquipmentProfile = {
  name: 'Test rig',
  boilKettleVolumeL: 30,
  targetBatchVolumeL: 20,
  boilTimeMin: 60,
  evaporationRatePercentPerHour: 12,
  grainAbsorptionLPerKg: 1.0,
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
})
