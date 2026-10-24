import { describe, expect, it } from 'vitest'
import { calculateABV_simple } from '@/lib/brew-calc/abv'

describe('calculateABV_simple', () => {
  it('computes ABV from OG/FG', () => {
    expect(calculateABV_simple(1.05, 1.01)).toBeCloseTo(5.25, 5)
  })
})
