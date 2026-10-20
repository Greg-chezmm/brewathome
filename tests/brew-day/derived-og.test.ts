import { describe, expect, it } from 'vitest'
import { derivedOg } from '@/lib/brew-day/measurements'

describe('DI proposée à partir de la densité de fin d’ébullition', () => {
  it('sans appoint d’eau, la DI est la densité de fin d’ébullition', () => {
    expect(derivedOg(1.08, 20, 0)).toBe(1.08)
    expect(derivedOg(1.08, null, null)).toBe(1.08)
  })

  it('un appoint d’eau dilue les points proportionnellement', () => {
    // 80 points × (20 − 4) / 20 = 64 points.
    expect(derivedOg(1.08, 20, 4)).toBe(1.064)
  })

  it('arrondit au point (0,001)', () => {
    // 75 points × 19 / 20 = 71,25 → 71.
    expect(derivedOg(1.075, 20, 1)).toBe(1.071)
  })

  it('ne propose rien si l’appoint est connu mais pas le volume (ou incohérent)', () => {
    expect(derivedOg(1.08, null, 4)).toBeNull()
    expect(derivedOg(1.08, 4, 4)).toBeNull()
    expect(derivedOg(1.08, 3, 4)).toBeNull()
  })

  it('ne propose rien sans densité de fin d’ébullition', () => {
    expect(derivedOg(null, 20, 4)).toBeNull()
  })
})
