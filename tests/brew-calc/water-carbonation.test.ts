import { describe, expect, it } from 'vitest'
import { primingSugarGrams } from '@/lib/brew-calc/carbonation'
import {
  WATER_TARGETS,
  applySalts,
  ionsAboveTarget,
  residualAlkalinity,
  suggestSalts,
  sulfateToChlorideRatio,
  type WaterProfile,
} from '@/lib/brew-calc/water'
import { dryYeastForCells } from '@/lib/brew-calc/yeast'

const distilled: WaterProfile = { calcium: 0, magnesium: 0, sodium: 0, sulfate: 0, chloride: 0, bicarbonate: 0 }

describe('applySalts', () => {
  it('adds the per-g/L contribution of each salt (1 g of gypsum in 1 L)', () => {
    const result = applySalts(distilled, { gypsum: 1 }, 1)
    expect(result.calcium).toBeCloseTo(232.8, 1)
    expect(result.sulfate).toBeCloseTo(557.7, 1)
    expect(result.chloride).toBe(0)
  })

  it('scales with the water volume and adds to the source profile', () => {
    const source = { ...distilled, calcium: 20 }
    const result = applySalts(source, { calciumChloride: 5 }, 25)
    expect(result.calcium).toBeCloseTo(20 + 272.6 * 0.2, 6)
    expect(result.chloride).toBeCloseTo(482.3 * 0.2, 6)
  })

  it('computes the sulfate/chloride balance', () => {
    expect(sulfateToChlorideRatio({ ...distilled, sulfate: 300, chloride: 100 })).toBe(3)
  })
})

describe('primingSugarGrams', () => {
  it('needs 10 % more dextrose and 40 % more dry malt extract than sucrose', () => {
    const sucrose = primingSugarGrams(2.4, 19, 21)
    expect(primingSugarGrams(2.4, 19, 21, 'dextrose')).toBeCloseTo(sucrose * 1.1, 6)
    expect(primingSugarGrams(2.4, 19, 21, 'dme')).toBeCloseTo(sucrose * 1.4, 6)
  })

  it('never returns a negative amount', () => {
    expect(primingSugarGrams(0.5, 5, 20)).toBe(0)
  })
})

describe('dryYeastForCells', () => {
  it('converts cells to grams (10 billion/g) and rounds sachets up', () => {
    expect(dryYeastForCells(200)).toEqual({ grams: 20, sachets: 2 })
    expect(dryYeastForCells(50).sachets).toBe(1)
  })
})

describe('suggestSalts', () => {
  it('approche un profil cible depuis une eau osmosée', () => {
    const target = WATER_TARGETS.find((t) => t.id === 'hoppy')!.profile
    const grams = suggestSalts(distilled, target, 10)
    expect(grams.gypsum).toBeGreaterThan(0)
    const result = applySalts(distilled, grams, 10)
    expect(result.sulfate).toBeGreaterThan(200)
    expect(result.sulfate).toBeLessThan(300)
    expect(sulfateToChlorideRatio(result)).toBeGreaterThan(2.5)
    expect(result.calcium).toBeGreaterThan(70)
    expect(result.calcium).toBeLessThan(150)
  })

  it('profil rond : plus de chlorure de calcium que de gypse, rapport inversé', () => {
    const target = WATER_TARGETS.find((t) => t.id === 'juicy')!.profile
    const grams = suggestSalts(distilled, target, 20)
    expect(grams.calciumChloride!).toBeGreaterThan(grams.gypsum ?? 0)
    expect(sulfateToChlorideRatio(applySalts(distilled, grams, 20))).toBeLessThan(0.8)
  })

  it('rien à ajouter si l’eau correspond déjà, et signale les ions en excès', () => {
    const target = WATER_TARGETS.find((t) => t.id === 'balanced')!.profile
    expect(suggestSalts(target, target, 10)).toEqual({})
    const hard = { ...target, bicarbonate: 300, sulfate: 90 }
    expect(ionsAboveTarget(hard, target)).toEqual(['bicarbonate'])
  })

  it('alcalinité résiduelle : bicarbonates moins calcium et magnésium', () => {
    expect(residualAlkalinity({ ...distilled, bicarbonate: 61, calcium: 35, magnesium: 7 })).toBeCloseTo(50 - 10 - 1, 6)
  })
})
