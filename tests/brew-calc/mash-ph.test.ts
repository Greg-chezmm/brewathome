import { describe, expect, it } from 'vitest'
import { estimateMashPh, grainDiPh, mashGrainKind, mashPhVerdict } from '@/lib/brew-calc/mash-ph'
import type { Fermentable } from '@/lib/brew-calc/types'

const grain = (name: string, amountKg: number, colorLovibond: number): Fermentable => ({ name, type: 'grain', amountKg, colorLovibond, yieldPercent: 78 })
const paleAle = [grain('Pale Ale', 4.5, 3), grain('Crystal 60', 0.5, 60)]
const stout = [grain('Pale Ale', 4, 3), grain('Orge torréfiée', 0.4, 300), grain('Malt chocolat', 0.3, 350)]

describe('pH d’empâtage', () => {
  it('classe les grains (bibliothèque, puis nom et couleur)', () => {
    expect(mashGrainKind(grain('Pilsner', 1, 1.6))).toBe('base')
    expect(mashGrainKind(grain('CaraMunich', 1, 45))).toBe('crystal')
    expect(mashGrainKind(grain('Carafa Spécial III', 1, 470))).toBe('roasted')
    expect(mashGrainKind(grain('Malt acidulé', 1, 2))).toBe('acid')
    expect(mashGrainKind(grain('Flocons d’avoine', 1, 1))).toBe('adjunct')
    expect(mashGrainKind(grain('Mon malt maison', 1, 400))).toBe('roasted')
  })

  it('pH DI : Troester pour les caramel, baisse avec la couleur pour les malts touraillés', () => {
    expect(grainDiPh('crystal', 60)).toBeCloseTo(5.22 - 0.3024, 6)
    expect(grainDiPh('base', 2)).toBeCloseTo(5.72, 6)
    expect(grainDiPh('base', 9)).toBeLessThan(grainDiPh('base', 2))
  })

  it('pale ale en eau douce dans la plage, stout plus acide', () => {
    const pale = estimateMashPh({ fermentables: paleAle, mashWaterL: 15, residualAlkalinityPpm: 0 })!
    const dark = estimateMashPh({ fermentables: stout, mashWaterL: 14, residualAlkalinityPpm: 0 })!
    expect(pale.ph).toBeGreaterThan(5.5)
    expect(pale.ph).toBeLessThan(5.7)
    expect(dark.ph).toBeLessThan(pale.ph - 0.1)
  })

  it('une eau alcaline remonte le pH, l’acide lactique le baisse jusqu’à la cible', () => {
    const soft = estimateMashPh({ fermentables: paleAle, mashWaterL: 15, residualAlkalinityPpm: 0 })!
    const hard = estimateMashPh({ fermentables: paleAle, mashWaterL: 15, residualAlkalinityPpm: 150 })!
    expect(hard.ph).toBeGreaterThan(soft.ph + 0.15)
    expect(hard.lacticMlToTarget).toBeGreaterThan(0)
    const corrected = estimateMashPh({ fermentables: paleAle, mashWaterL: 15, residualAlkalinityPpm: 150, lacticAcidMl: hard.lacticMlToTarget })!
    expect(corrected.ph).toBeCloseTo(5.4, 1)
  })

  it('malt acidulé : ≈ 0,1 de pH en moins par % du grain', () => {
    const without = estimateMashPh({ fermentables: [grain('Pilsner', 5, 1.6)], mashWaterL: 15, residualAlkalinityPpm: 0 })!
    const with2 = estimateMashPh({ fermentables: [grain('Pilsner', 4.9, 1.6), grain('Malt acidulé', 0.1, 2)], mashWaterL: 15, residualAlkalinityPpm: 0 })!
    expect(with2.acidMaltPercent).toBeCloseTo(2, 6)
    expect(without.ph - with2.ph).toBeGreaterThan(0.1)
    expect(without.ph - with2.ph).toBeLessThan(0.25)
  })

  it('bicarbonate proposé quand le pH est trop bas, rien sans grain à l’empâtage', () => {
    const veryDark = estimateMashPh({ fermentables: [grain('Pale Ale', 2, 3), grain('Orge torréfiée', 1, 300)], mashWaterL: 9, residualAlkalinityPpm: -30 })!
    expect(veryDark.ph).toBeLessThan(5.2)
    expect(veryDark.bakingSodaGToTarget).toBeGreaterThan(0)
    expect(estimateMashPh({ fermentables: [{ ...grain('Sucre', 1, 0), type: 'sugar' }], mashWaterL: 10, residualAlkalinityPpm: 0 })).toBeNull()
    expect(mashPhVerdict(5.4)).toMatch(/bonne plage/)
  })
})
