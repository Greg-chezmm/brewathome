import { describe, expect, it } from 'vitest'
import {
  defaultFermentationSteps,
  dryHopEvents,
  fermentationPositionAt,
  fermentationSchedule,
  nextFermentationStep,
  totalFermentationDays,
  type FermentationStep,
} from '@/lib/brew-calc/fermentation-profile'
import type { Hop } from '@/lib/brew-calc/types'

const profile: FermentationStep[] = [
  { type: 'primary', tempC: 18, days: 10 },
  { type: 'secondary', tempC: 20, days: 4 },
  { type: 'cold-crash', tempC: 2, days: 3 },
]

const dryHop = (patch: Partial<Hop> = {}): Hop => ({ name: 'Citra', amountG: 50, alphaAcidPercent: 12, timeMin: 0, use: 'dry-hop', ...patch })

describe('profil de fermentation', () => {
  it('cumule les jours étape par étape', () => {
    expect(totalFermentationDays(profile)).toBe(17)
    expect(fermentationSchedule(profile).map((s) => [s.startDay, s.endDay])).toEqual([
      [0, 10],
      [10, 14],
      [14, 17],
    ])
  })

  it('situe le brassin dans son profil', () => {
    expect(fermentationPositionAt(profile, 2.5)).toMatchObject({ index: 0, daysLeftInStep: 7.5, done: false })
    expect(fermentationPositionAt(profile, 12)?.current?.type).toBe('secondary')
    expect(fermentationPositionAt(profile, 12)?.next?.type).toBe('cold-crash')
    expect(fermentationPositionAt(profile, 20)).toMatchObject({ current: null, done: true })
    expect(fermentationPositionAt([], 3)).toBeNull()
  })

  it('propose un profil selon la levure, et une étape suivante logique', () => {
    expect(defaultFermentationSteps('ale')).toEqual([{ type: 'primary', tempC: 18, days: 14 }])
    expect(defaultFermentationSteps('lager').map((s) => s.type)).toEqual(['primary', 'conditioning'])
    expect(nextFermentationStep([]).type).toBe('primary')
    expect(nextFermentationStep(profile.slice(0, 1)).type).toBe('cold-crash')
    expect(nextFermentationStep(profile).type).toBe('conditioning')
  })

  it('place les dry hops : jour fixé, sinon en fin de primaire (au plus tôt jour 3)', () => {
    expect(dryHopEvents([dryHop({ dryHopDay: 6, dryHopDays: 4 })], profile)[0]).toMatchObject({ day: 6, removeDay: 10 })
    expect(dryHopEvents([dryHop({ dryHopDays: 3 })], profile)[0]).toMatchObject({ day: 7, removeDay: 10 })
    expect(dryHopEvents([dryHop({ dryHopDays: 9 })], profile)[0].day).toBe(3)
    expect(dryHopEvents([dryHop({ use: 'boil' })], profile)).toEqual([])
  })
})
