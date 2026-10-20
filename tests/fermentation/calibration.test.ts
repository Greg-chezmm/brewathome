import { describe, expect, it } from 'vitest'
import { applyGravityOffset, gravityOffset } from '@/lib/fermentation/calibration'

const H = 3_600_000
const t0 = Date.UTC(2026, 0, 1)
const at = (hours: number, gravity: number | null) => ({ time: t0 + hours * H, gravity })

describe('Décalage de l’iSpindel d’après la DI au densimètre', () => {
  it('exemple : DI 1,074 au densimètre, iSpindel à 1,071 → décalage +0,003', () => {
    const readings = [at(0, 1.071), at(1, 1.071), at(2, 1.071), at(3, 1.07)]
    const result = gravityOffset(readings, 1.074, null)
    expect(result?.offset).toBeCloseTo(0.003, 5)
    expect(result?.count).toBe(4)
  })

  it('médiane des premières heures : un relevé aberrant ne fausse pas le décalage', () => {
    const readings = [at(0, 1.09), at(1, 1.071), at(2, 1.0715), at(3, 1.071)]
    expect(gravityOffset(readings, 1.074, null)?.offset).toBeCloseTo(0.00275, 5)
  })

  it('ignore les relevés au-delà de la fenêtre de départ (la fermentation a commencé)', () => {
    const readings = [at(0, 1.071), at(2, 1.071), at(4, 1.071), at(30, 1.04), at(31, 1.04)]
    expect(gravityOffset(readings, 1.074, null)?.offset).toBeCloseTo(0.003, 5)
  })

  it('ignore les relevés postérieurs aux ajouts en fermentation', () => {
    const readings = [at(0, 1.071), at(1, 1.071), at(2, 1.071), at(3, 1.085), at(4, 1.085)]
    expect(gravityOffset(readings, 1.074, t0 + 2.5 * H)?.offset).toBeCloseTo(0.003, 5)
  })

  it('sans DI mesurée, pas de décalage (ni DI prévue ni suggérée comme référence)', () => {
    expect(gravityOffset([at(0, 1.071), at(1, 1.071), at(2, 1.071)], null, null)).toBeNull()
  })

  it('trop peu de relevés de départ : pas de décalage', () => {
    expect(gravityOffset([at(0, 1.071), at(1, 1.071)], 1.074, null)).toBeNull()
    expect(gravityOffset([at(0, null), at(1, null), at(2, null)], 1.074, null)).toBeNull()
  })

  it('ne dépend pas de l’ordre des relevés', () => {
    const readings = [at(2, 1.071), at(0, 1.071), at(1, 1.071)]
    expect(gravityOffset(readings, 1.074, null)?.offset).toBeCloseTo(0.003, 5)
  })

  it('applique le décalage sans bruit d’arrondi, et laisse passer les valeurs nulles', () => {
    expect(applyGravityOffset(1.071, 0.003)).toBe(1.074)
    expect(applyGravityOffset(null, 0.003)).toBeNull()
    expect(applyGravityOffset(1.02, 0)).toBe(1.02)
  })
})
