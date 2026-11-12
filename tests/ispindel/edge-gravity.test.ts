import { describe, expect, it } from 'vitest'
import { parseGravity, plateauToSG } from '../../supabase/functions/ispindel/gravity'

describe('parseGravity (Edge Function iSpindel)', () => {
  it('ignore le 0 exact d’un iSpindel non calibré, et les valeurs absentes ou invalides', () => {
    expect(parseGravity(0, undefined)).toBeNull()
    expect(parseGravity(undefined, undefined)).toBeNull()
    expect(parseGravity('1.050', undefined)).toBeNull()
    expect(parseGravity(Number.NaN, undefined)).toBeNull()
  })

  it('garde une densité SG sans unité', () => {
    expect(parseGravity(1.048, undefined)).toBe(1.048)
    expect(parseGravity(0.996, undefined)).toBe(0.996)
  })

  it('convertit des °Plato de début de fermentation', () => {
    expect(parseGravity(12, undefined)).toBeCloseTo(1.0484, 3)
  })

  it('convertit des °Plato proches de 0 en fin de fermentation au lieu de les prendre pour une SG', () => {
    // Cas réel : un polynôme en Plato envoyait 0,057 puis 0,002, enregistrés comme SG 0,057.
    expect(parseGravity(0.057, undefined)).toBeCloseTo(1.0002, 4)
    expect(parseGravity(0.002, undefined)).toBeCloseTo(1.0, 4)
    expect(parseGravity(1.5, undefined)).toBeCloseTo(plateauToSG(1.5), 6)
  })

  it('accepte un Plato négatif (bière sous 1,000) au lieu de le rejeter', () => {
    expect(parseGravity(-0.3, undefined)).toBeCloseTo(0.9988, 4)
    expect(parseGravity(-0.3, 'P')).toBeCloseTo(0.9988, 4)
  })

  it('rejette une valeur hors de toute plage plausible', () => {
    expect(parseGravity(-40, undefined)).toBeNull()
    expect(parseGravity(80, undefined)).toBeNull()
  })

  it('respecte une unité explicite', () => {
    expect(parseGravity(1.012, 'G')).toBe(1.012)
    expect(parseGravity(-1, 'G')).toBeNull()
    expect(parseGravity(3, 'P')).toBeCloseTo(plateauToSG(3), 6)
  })
})
