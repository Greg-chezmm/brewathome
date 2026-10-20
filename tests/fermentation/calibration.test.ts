import { describe, expect, it } from 'vitest'
import { applyCalibration, applyGravityOffset, gravityCalibration, gravityOffset, manualCalibration } from '@/lib/fermentation/calibration'

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

describe('Calibration en deux points (DI et DF au densimètre)', () => {
  const start = [at(0, 1.071), at(1, 1.071), at(2, 1.071)]
  const end = [at(300, 1.013), at(301, 1.013), at(302, 1.013)]

  it('corrige décalage et pente : l’iSpindel retombe sur la DF mesurée', () => {
    const cal = gravityCalibration([...start, ...end], 1.074, 1.012, null)!
    expect(cal.twoPoint).toBe(true)
    // chute réelle 62 points, chute iSpindel 58 points
    expect(cal.scale).toBeCloseTo(62 / 58, 5)
    expect(applyCalibration(1.071, cal)).toBeCloseTo(1.074, 4)
    expect(applyCalibration(1.013, cal)).toBeCloseTo(1.012, 3)
  })

  it('sans DF : décalage seul', () => {
    const cal = gravityCalibration([...start, ...end], 1.074, null, null)!
    expect(cal.twoPoint).toBe(false)
    expect(cal.scale).toBe(1)
    expect(applyCalibration(1.013, cal)).toBeCloseTo(1.016, 4)
  })

  it('ajouts de sucre en fermentation : décalage seul', () => {
    const cal = gravityCalibration([...start, ...end], 1.074, 1.012, t0 + 100 * H)!
    expect(cal.twoPoint).toBe(false)
  })

  it('DF aberrante (pente hors plage) : décalage seul', () => {
    const stuck = [at(300, 1.05), at(301, 1.05), at(302, 1.05)]
    expect(gravityCalibration([...start, ...stuck], 1.074, 1.0, null)!.twoPoint).toBe(false)
  })

  it('pas assez de relevés de fin : décalage seul', () => {
    expect(gravityCalibration([...start, at(300, 1.013)], 1.074, 1.012, null)!.twoPoint).toBe(false)
  })

  it('décalage manuel : ajoute simplement le décalage', () => {
    expect(applyCalibration(1.05, manualCalibration(-0.002))).toBeCloseTo(1.048, 4)
    expect(applyCalibration(null, manualCalibration(0.01))).toBeNull()
  })
})
