import { describe, expect, it } from 'vitest'
import {
  evaluatePolynomial,
  fitPolynomial,
  formatPolynomial,
  parseCalibrationPoints,
  serializeCalibrationPoints,
  type CalibrationPoint,
} from '@/lib/ispindel/polynomial'

const quadratic = (x: number) => 0.0004 * x * x + 0.12 * x - 5
const points: CalibrationPoint[] = [25, 35, 45, 55, 65, 75].map((tilt) => ({ tilt, gravity: quadratic(tilt) }))

describe('fitPolynomial', () => {
  it('retrouve les coefficients exacts d’un polynôme de degré 2', () => {
    const fit = fitPolynomial(points, 2)!
    expect(fit.coefficients[0]).toBeCloseTo(-5, 6)
    expect(fit.coefficients[1]).toBeCloseTo(0.12, 8)
    expect(fit.coefficients[2]).toBeCloseTo(0.0004, 9)
    expect(fit.r2).toBeCloseTo(1, 10)
    expect(fit.maxError).toBeLessThan(1e-8)
  })

  it('ajuste une droite avec un R² inférieur à 1 sur des points bruités', () => {
    const noisy = points.map((p, i) => ({ ...p, gravity: p.gravity + (i % 2 ? 0.2 : -0.2) }))
    const fit = fitPolynomial(noisy, 1)!
    expect(fit.r2).toBeLessThan(1)
    expect(fit.r2).toBeGreaterThan(0.9)
    expect(fit.maxError).toBeGreaterThan(0.1)
  })

  it('refuse un degré qui demande plus de points que disponibles', () => {
    expect(fitPolynomial(points.slice(0, 2), 2)).toBeNull()
    expect(fitPolynomial(points.slice(0, 1), 1)).toBeNull()
  })

  it('refuse des angles tous identiques', () => {
    expect(
      fitPolynomial(
        [
          { tilt: 40, gravity: 1 },
          { tilt: 40, gravity: 5 },
        ],
        1,
      ),
    ).toBeNull()
  })

  it('reste stable pour un degré 3 sur des angles réalistes', () => {
    const cubic = (x: number) => 1e-5 * x ** 3 - 0.001 * x ** 2 + 0.2 * x - 7
    const pts = [22, 30, 38, 46, 54, 62, 70].map((tilt) => ({ tilt, gravity: cubic(tilt) }))
    const fit = fitPolynomial(pts, 3)!
    expect(evaluatePolynomial(fit.coefficients, 50)).toBeCloseTo(cubic(50), 6)
  })
})

describe('formatPolynomial', () => {
  it('écrit le polynôme comme l’attend le portail iSpindel', () => {
    expect(formatPolynomial([-5, 0.12, 0.0004])).toBe('0.0004*tilt*tilt+0.12*tilt-5')
    expect(formatPolynomial([2, -0.5])).toBe('-0.5*tilt+2')
  })

  it('omet les termes nuls et garde assez de décimales', () => {
    expect(formatPolynomial([0, 0.000123456789, 0])).toBe('0.000123457*tilt')
  })
})

describe('sauvegarde des points', () => {
  it('relit ce qu’elle a écrit', () => {
    expect(parseCalibrationPoints(serializeCalibrationPoints(points))).toEqual(points)
  })

  it('lit l’ancien format [[angle, densité], …] de la page du projet iSpindel', () => {
    expect(parseCalibrationPoints('[[25,1.0],[40,5.5]]')).toEqual([
      { tilt: 25, gravity: 1.0 },
      { tilt: 40, gravity: 5.5 },
    ])
  })

  it('renvoie null pour un contenu illisible', () => {
    expect(parseCalibrationPoints('pas du json')).toBeNull()
    expect(parseCalibrationPoints('{"a":1}')).toBeNull()
    expect(parseCalibrationPoints('[["a","b"]]')).toBeNull()
  })
})
