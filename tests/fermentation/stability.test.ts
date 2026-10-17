import { describe, expect, it } from 'vitest'
import { gravityStability, type GravityPoint } from '@/lib/fermentation/stability'

const HOUR = 3600_000
const start = Date.UTC(2025, 9, 19)

/** Un relevé toutes les 15 min, densité donnée par `gravityAt(heures)`, avec un bruit de ±0,001. */
function ispindel(hours: number, gravityAt: (h: number) => number): GravityPoint[] {
  const points: GravityPoint[] = []
  for (let i = 0; i <= hours * 4; i++) {
    const h = i / 4
    const noise = [0, 0.001, -0.001, 0][i % 4]
    points.push({ time: start + h * HOUR, gravity: Math.round((gravityAt(h) + noise) * 1000) / 1000 })
  }
  return points
}

describe('gravityStability', () => {
  it('signale une densité immobile depuis plus de 2 jours', () => {
    // Baisse de 1.060 à 1.012 en 4 jours, puis plateau pendant 3 jours.
    const result = gravityStability(ispindel(7 * 24, (h) => Math.max(1.012, 1.06 - (0.048 * h) / 96)))
    expect(result).not.toBeNull()
    expect(result!.gravity).toBeCloseTo(1.012, 3)
    expect(result!.stable).toBe(true)
    expect(result!.stableDays).toBeGreaterThan(2.5)
    expect(result!.stableDays).toBeLessThan(3.5)
  })

  it('ne dit rien pendant la fermentation active', () => {
    const result = gravityStability(ispindel(3 * 24, (h) => 1.06 - (0.03 * h) / 72))
    expect(result!.stable).toBe(false)
    expect(result!.stableDays).toBeLessThan(1)
  })

  it('un plateau trop court ne suffit pas', () => {
    const result = gravityStability(ispindel(5 * 24, (h) => Math.max(1.012, 1.06 - (0.048 * h) / 96)))
    expect(result!.stable).toBe(false)
  })

  it('ignore une fermentation pas encore partie', () => {
    expect(gravityStability(ispindel(3 * 24, () => 1.06))).toBeNull()
  })

  it('fonctionne avec quelques saisies manuelles espacées', () => {
    const manual: GravityPoint[] = [
      { time: start, gravity: 1.055 },
      { time: start + 5 * 24 * HOUR, gravity: 1.013 },
      { time: start + 7 * 24 * HOUR, gravity: 1.012 },
      { time: start + 9 * 24 * HOUR, gravity: 1.012 },
    ]
    const result = gravityStability(manual)
    expect(result!.stable).toBe(true)
    expect(result!.stableSince).toBe(start + 5 * 24 * HOUR)
  })

  it('pas de quoi juger sans relevé de densité', () => {
    expect(gravityStability([{ time: start, gravity: null }])).toBeNull()
    expect(gravityStability([])).toBeNull()
  })
})
