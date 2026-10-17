import { describe, expect, it } from 'vitest'
import { currentGravity, fermentationProgress } from '@/lib/fermentation/progress'

describe('Progression de la fermentation', () => {
  it('densité actuelle : médiane des 4 derniers relevés, dans l’ordre du temps', () => {
    const readings = [
      { time: 5, gravity: 1.02 },
      { time: 1, gravity: 1.05 },
      { time: 2, gravity: 1.03 },
      { time: 3, gravity: 1.021 },
      { time: 4, gravity: null },
      { time: 6, gravity: 1.019 },
    ]
    // Derniers relevés de densité : 1.030, 1.021, 1.020, 1.019 → médiane 1.0205.
    expect(currentGravity(readings)).toBeCloseTo(1.0205, 5)
    expect(currentGravity([{ time: 1, gravity: null }])).toBeNull()
  })

  it('alcool et atténuation montent à mesure que la densité baisse', () => {
    const start = fermentationProgress(1.105, 1.105, 1.025)
    expect(start).toEqual({ abv: 0, attenuation: 0, progressPercent: 0 })

    const midway = fermentationProgress(1.105, 1.065, 1.025)
    expect(midway.abv).toBeCloseTo(5.25, 2)
    expect(midway.progressPercent).toBeCloseTo(50, 5)

    // Plus sec que prévu : au-delà de 100 %.
    const dry = fermentationProgress(1.105, 1.017, 1.025)
    expect(dry.abv).toBeCloseTo(11.55, 2)
    expect(dry.attenuation).toBeCloseTo(83.8, 1)
    expect(dry.progressPercent).toBeGreaterThan(100)
  })

  it('une densité au-dessus de la DI (mesure bruitée) ne donne pas d’alcool négatif', () => {
    expect(fermentationProgress(1.05, 1.051, null)).toEqual({ abv: 0, attenuation: 0, progressPercent: null })
  })
})
