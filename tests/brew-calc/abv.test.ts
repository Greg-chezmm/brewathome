import { describe, expect, it } from 'vitest'
import { calculateABV, calculateABV_Hall, calculateABV_simple } from '@/lib/brew-calc/abv'

describe('calculateABV_simple', () => {
  it('computes ABV from OG/FG', () => {
    expect(calculateABV_simple(1.05, 1.01)).toBeCloseTo(5.25, 5)
  })
})

describe('calculateABV_Hall', () => {
  it('is close to the simple formula for a moderate-gravity beer', () => {
    const simple = calculateABV_simple(1.05, 1.01)
    const hall = calculateABV_Hall(1.05, 1.01)
    expect(Math.abs(simple - hall)).toBeLessThan(0.3)
  })
})

describe('calculateABV', () => {
  it('uses the simple formula at or below OG 1.070', () => {
    expect(calculateABV(1.05, 1.01)).toBeCloseTo(calculateABV_simple(1.05, 1.01), 10)
  })

  it('uses the Hall formula above OG 1.070', () => {
    expect(calculateABV(1.1, 1.02)).toBeCloseTo(calculateABV_Hall(1.1, 1.02), 10)
  })

  it('diverges meaningfully from the simple formula for a very strong beer', () => {
    const simple = calculateABV_simple(1.12, 1.02)
    const precise = calculateABV(1.12, 1.02)
    expect(Math.abs(simple - precise)).toBeGreaterThan(0.2)
  })
})
