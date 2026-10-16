import { describe, expect, it } from 'vitest'
import {
  calculateIBU_Garetz,
  calculateIBU_Rager,
  calculateIBU_Tinseth,
  hopstandUtilizationFactor,
} from '@/lib/brew-calc/ibu'
import type { Hop } from '@/lib/brew-calc/types'

describe('calculateIBU_Tinseth', () => {
  it('matches the hand-computed classic example (28g @ 10% AA, 60 min, OG 1.050, 20L)', () => {
    const hops: Hop[] = [{ name: 'Test Hop', amountG: 28, alphaAcidPercent: 10, timeMin: 60, use: 'boil' }]
    const ibu = calculateIBU_Tinseth(hops, 1.05, 20)
    expect(ibu).toBeCloseTo(32.3, 1)
  })

  it('ignores dry-hop additions entirely', () => {
    const hops: Hop[] = [{ name: 'Dry Hop', amountG: 50, alphaAcidPercent: 5.5, timeMin: 7200, use: 'dry-hop' }]
    expect(calculateIBU_Tinseth(hops, 1.05, 20)).toBe(0)
  })

  it('applies a reduced, temperature-dependent utilization to whirlpool additions', () => {
    const whirlpoolHop: Hop = { name: 'Whirlpool', amountG: 20, alphaAcidPercent: 8, timeMin: 20, use: 'whirlpool' }
    const boilHop: Hop = { ...whirlpoolHop, use: 'boil' }
    const whirlpoolIbu = calculateIBU_Tinseth([whirlpoolHop], 1.05, 20)
    const boilIbu = calculateIBU_Tinseth([boilHop], 1.05, 20)
    expect(whirlpoolIbu).toBeGreaterThan(0)
    expect(whirlpoolIbu).toBeLessThan(boilIbu)
  })

  it('whirlpool contribution decreases at lower hopstand temperatures', () => {
    const whirlpoolHop: Hop = { name: 'Whirlpool', amountG: 20, alphaAcidPercent: 8, timeMin: 20, use: 'whirlpool' }
    const hot = calculateIBU_Tinseth([whirlpoolHop], 1.05, 20, 90)
    const cool = calculateIBU_Tinseth([whirlpoolHop], 1.05, 20, 65)
    expect(hot).toBeGreaterThan(cool)
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

describe('hopstandUtilizationFactor', () => {
  it('matches the ~0.23 reference value documented for 80°C', () => {
    expect(hopstandUtilizationFactor(80)).toBeCloseTo(0.23, 2)
  })

  it('reaches 1 at the boiling point and decreases below it', () => {
    expect(hopstandUtilizationFactor(100)).toBeCloseTo(1, 6)
    expect(hopstandUtilizationFactor(60)).toBeLessThan(hopstandUtilizationFactor(80))
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
