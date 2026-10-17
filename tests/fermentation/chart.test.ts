import { describe, expect, it } from 'vitest'
import { seriesWithGaps } from '@/lib/fermentation/chart'

const H = 3600_000

describe('courbe de fermentation', () => {
  it('coupe la courbe dans un trou anormal (iSpindel muet, mesure de test un an après)', () => {
    const points = [0, 0.25, 0.5, 0.75, 1, 24 * 365].map((h, i) => ({ time: h * H, value: 1.1 - i * 0.01 }))
    const series = seriesWithGaps(points)
    expect(series).toHaveLength(7)
    expect(series[5]).toEqual({ time: H + 1, value: null })
  })

  it('ne coupe pas des saisies manuelles espacées d’un jour, et ignore les valeurs absentes', () => {
    const points = [0, 24, 48, 72].map((h) => ({ time: h * H, value: h === 24 ? null : 1.05 }))
    expect(seriesWithGaps(points).map((p) => p.value)).toEqual([1.05, 1.05, 1.05])
  })
})
