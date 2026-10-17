import { describe, expect, it } from 'vitest'
import { brewfatherReadingsToImport } from '@/lib/brewfather/readings'

const t0 = Date.UTC(2025, 9, 19, 16, 39, 44)

describe('relevés Brewfather → suivi de fermentation', () => {
  const readings = [
    { time: t0 + 900_000, sg: 1.093, temp: 18.2, angle: 70.58, battery: 4.14, type: 'iSpindel', id: 'ISPINDEL' },
    { time: t0, sg: 1.109, temp: 17.1, angle: 75.1, battery: 4.144943, type: 'iSpindel', id: 'ISPINDEL' },
    { time: t0 + 1_800_000, sg: 1.09, type: 'manual', comment: ' densimètre ' },
    { time: t0 + 2_700_000, type: 'iSpindel' },
  ]

  it('garde l’ordre chronologique, la source, l’angle et la batterie', () => {
    const rows = brewfatherReadingsToImport(readings)
    expect(rows.map((r) => r.gravity)).toEqual([1.109, 1.093, 1.09])
    expect(rows[0]).toEqual({
      recordedAt: '2025-10-19T16:39:44.000Z',
      source: 'ispindel',
      gravity: 1.109,
      temperatureC: 17.1,
      rawAngle: 75.1,
      battery: 4.144943,
      comment: null,
    })
    expect(rows[2]).toMatchObject({ source: 'manual', temperatureC: null, rawAngle: null, comment: 'densimètre' })
  })

  it('un second import n’ajoute que les nouveaux relevés', () => {
    const already = ['2025-10-19T16:39:44.000Z', '2025-10-19T16:54:44+00:00']
    expect(brewfatherReadingsToImport(readings, already).map((r) => r.gravity)).toEqual([1.09])
  })
})
