import { describe, expect, it } from 'vitest'
import {
  calculateDilutionWater,
  calculateFermentableAddition,
  correctGravityForTemperature,
} from '@/lib/brew-calc/gravity-correction'

describe('calculateDilutionWater', () => {
  it('computes the water to add to dilute a too-high gravity to target', () => {
    // 20L at 1.060 diluted to 1.050 target.
    const result = calculateDilutionWater(20, 1.06, 1.05)
    // points1=60, points2=50 -> newVolume = 20*60/50 = 24L -> +4L d'eau
    expect(result.newVolumeL).toBeCloseTo(24, 5)
    expect(result.waterToAddL).toBeCloseTo(4, 5)
  })

  it('throws if target gravity is not lower than current gravity', () => {
    expect(() => calculateDilutionWater(20, 1.05, 1.05)).toThrow()
    expect(() => calculateDilutionWater(20, 1.04, 1.05)).toThrow()
  })
})

describe('calculateFermentableAddition', () => {
  it('computes grams of table sugar needed to raise gravity to target', () => {
    const result = calculateFermentableAddition(20, 1.04, 1.05, 'tableSugar')
    expect(result.gramsToAdd).toBeGreaterThan(0)
  })

  it('requires less dextrose/DME than LME for the same gravity bump (lower PPG for LME)', () => {
    const lme = calculateFermentableAddition(20, 1.04, 1.05, 'lme')
    const dextrose = calculateFermentableAddition(20, 1.04, 1.05, 'dextrose')
    expect(lme.gramsToAdd).toBeGreaterThan(dextrose.gramsToAdd)
  })

  it('throws if target gravity is not higher than current gravity', () => {
    expect(() => calculateFermentableAddition(20, 1.05, 1.05, 'tableSugar')).toThrow()
    expect(() => calculateFermentableAddition(20, 1.06, 1.05, 'tableSugar')).toThrow()
  })
})

describe('correctGravityForTemperature', () => {
  it('leaves a reading taken at the calibration temperature unchanged', () => {
    expect(correctGravityForTemperature(1.05, 20)).toBeCloseTo(1.05, 6)
  })

  it('raises a hot reading (hydrometer reads low when warm)', () => {
    // Valeur de référence usuelle : 1.050 lu à 30 °C ≈ 1.0526 à 20 °C (+2,6 points).
    expect(correctGravityForTemperature(1.05, 30)).toBeCloseTo(1.0526, 4)
  })

  it('lowers a cold reading', () => {
    expect(correctGravityForTemperature(1.05, 10)).toBeLessThan(1.05)
  })
})
