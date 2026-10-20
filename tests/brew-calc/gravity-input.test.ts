import { describe, expect, it } from 'vitest'
import { parseGravityInput } from '@/lib/brew-calc/gravity-input'

describe('parseGravityInput', () => {
  it('lit une densité avec virgule ou point', () => {
    expect(parseGravityInput('1,048')).toBe(1.048)
    expect(parseGravityInput('1.048')).toBe(1.048)
  })
  it('lit des points comme 48 -> 1,048', () => {
    expect(parseGravityInput('48')).toBe(1.048)
  })
  it('convertit Plato et Brix', () => {
    expect(parseGravityInput('12,5P')).toBeCloseTo(1.0505, 3)
    expect(parseGravityInput('12.5 °P')).toBeCloseTo(1.0505, 3)
    expect(parseGravityInput('12 brix')).toBeCloseTo(1.0483, 3)
  })
  it('renvoie null pour un texte vide ou illisible', () => {
    expect(parseGravityInput('')).toBeNull()
    expect(parseGravityInput('abc')).toBeNull()
  })
})
