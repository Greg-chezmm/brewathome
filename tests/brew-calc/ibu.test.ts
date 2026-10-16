import { describe, expect, it } from 'vitest'
import { calculateIBU_Garetz, calculateIBU_Rager, calculateIBU_Tinseth } from '@/lib/brew-calc/ibu'
import type { Hop } from '@/lib/brew-calc/types'

describe('calculateIBU_Tinseth', () => {
  it('matches the hand-computed classic example (28g @ 10% AA, 60 min, OG 1.050, 20L)', () => {
    const hops: Hop[] = [{ name: 'Test Hop', amountG: 28, alphaAcidPercent: 10, timeMin: 60, use: 'boil' }]
    const ibu = calculateIBU_Tinseth(hops, 1.05, 20)
    expect(ibu).toBeCloseTo(32.3, 1)
  })

  it('ignores whirlpool and dry-hop additions', () => {
    const hops: Hop[] = [
      { name: 'Dry Hop', amountG: 50, alphaAcidPercent: 5.5, timeMin: 7200, use: 'dry-hop' },
      { name: 'Whirlpool', amountG: 20, alphaAcidPercent: 8, timeMin: 20, use: 'whirlpool' },
    ]
    expect(calculateIBU_Tinseth(hops, 1.05, 20)).toBe(0)
  })

  it('utilization increases with boil time and decreases with higher gravity', () => {
    const shortBoil: Hop = { name: 'h', amountG: 10, alphaAcidPercent: 10, timeMin: 10, use: 'boil' }
    const longBoil: Hop = { ...shortBoil, timeMin: 60 }
    expect(calculateIBU_Tinseth([longBoil], 1.05, 20)).toBeGreaterThan(
      calculateIBU_Tinseth([shortBoil], 1.05, 20),
    )

    const lowGravity = calculateIBU_Tinseth([longBoil], 1.04, 20)
    const highGravity = calculateIBU_Tinseth([longBoil], 1.09, 20)
    expect(lowGravity).toBeGreaterThan(highGravity)
  })

  it('sums contributions from multiple hop additions', () => {
    const hop1: Hop = { name: 'h1', amountG: 15, alphaAcidPercent: 12, timeMin: 60, use: 'boil' }
    const hop2: Hop = { name: 'h2', amountG: 15, alphaAcidPercent: 5, timeMin: 15, use: 'boil' }
    const total = calculateIBU_Tinseth([hop1, hop2], 1.05, 20)
    const sumOfIndividual =
      calculateIBU_Tinseth([hop1], 1.05, 20) + calculateIBU_Tinseth([hop2], 1.05, 20)
    expect(total).toBeCloseTo(sumOfIndividual, 10)
  })
})

describe('calculateIBU_Rager', () => {
  it('produces a positive IBU value for a standard boil addition', () => {
    const hops: Hop[] = [{ name: 'Test Hop', amountG: 28, alphaAcidPercent: 10, timeMin: 60, use: 'boil' }]
    const ibu = calculateIBU_Rager(hops, 1.05, 20)
    expect(ibu).toBeGreaterThan(0)
  })

  it('applies the gravity adjustment only above boil gravity 1.050', () => {
    const hops: Hop[] = [{ name: 'Test Hop', amountG: 28, alphaAcidPercent: 10, timeMin: 60, use: 'boil' }]
    const atThreshold = calculateIBU_Rager(hops, 1.05, 20)
    const aboveThreshold = calculateIBU_Rager(hops, 1.09, 20)
    expect(aboveThreshold).toBeLessThan(atThreshold)
  })
})

describe('calculateIBU_Garetz', () => {
  it('produces a positive IBU value with HF neutralized (no desiredIBU)', () => {
    const hops: Hop[] = [{ name: 'Test Hop', amountG: 28, alphaAcidPercent: 10, timeMin: 60, use: 'boil' }]
    const ibu = calculateIBU_Garetz(hops, {
      boilGravity: 1.05,
      preBoilVolumeL: 23,
      finalVolumeL: 20,
      batchVolumeL: 20,
    })
    expect(ibu).toBeGreaterThan(0)
  })
})
