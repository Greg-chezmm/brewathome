import { describe, expect, it } from 'vitest'
import {
  bottlingReferenceL,
  compareBottling,
  normalizePackaging,
  packagedVolumeL,
  PACKAGING_FORMATS,
  remainingAsContainers,
} from '@/lib/brew-day/bottling'

describe('Embouteillage : litres conditionnés', () => {
  it('propose les formats 33 cl, 50 cl, 75 cl et le fût de 5 L', () => {
    expect(PACKAGING_FORMATS.map((f) => [f.key, f.volumeL])).toEqual([
      ['bottle33', 0.33],
      ['bottle50', 0.5],
      ['bottle75', 0.75],
      ['keg5', 5],
    ])
  })

  it('additionne les litres de chaque format', () => {
    // 24 × 0,33 + 10 × 0,5 + 4 × 0,75 + 1 × 5 = 7,92 + 5 + 3 + 5 = 20,92
    expect(packagedVolumeL({ bottle33: 24, bottle50: 10, bottle75: 4, keg5: 1 })).toBeCloseTo(20.92, 5)
    expect(packagedVolumeL({})).toBe(0)
  })

  it('normalise une valeur lue en base : entiers positifs seulement', () => {
    expect(normalizePackaging({ bottle33: 12, bottle50: -3, bottle75: 2.6, keg5: 'x', autre: 4 })).toEqual({
      bottle33: 12,
      bottle50: 0,
      bottle75: 3,
      keg5: 0,
    })
    expect(normalizePackaging(null)).toEqual({ bottle33: 0, bottle50: 0, bottle75: 0, keg5: 0 })
  })

  describe('comparaison avec le volume à conditionner', () => {
    it('conforme dans la tolérance (lie au fond, échantillons)', () => {
      expect(compareBottling(19.6, 20)).toMatchObject({ verdict: 'ok', diffL: expect.closeTo(-0.4, 5) })
    })

    it('litres manquants : à vérifier', () => {
      const result = compareBottling(18, 20)
      expect(result.verdict).toBe('missing')
      expect(result.diffL).toBeCloseTo(-2, 5)
      expect(result.advice).toMatch(/manque/)
    })

    it('plus de litres conditionnés que de bière : comptage ou volume à revoir', () => {
      const result = compareBottling(21.5, 20)
      expect(result.verdict).toBe('excess')
      expect(result.advice).toMatch(/plus/)
    })

    it('sans volume de référence, pas de verdict', () => {
      expect(compareBottling(10, null)).toEqual({ diffL: null, verdict: 'unknown', advice: null })
    })
  })

  it('le reste à conditionner est traduit en contenants', () => {
    // 2 L restants : 2 bouteilles de 75 cl (1,5 L) + de quoi finir avec une 50 cl.
    expect(remainingAsContainers(2)).toEqual({ bottle75: 2, bottle50: 1 })
    expect(remainingAsContainers(0.1)).toEqual({})
    expect(remainingAsContainers(-1)).toEqual({})
  })

  describe('volume à conditionner', () => {
    it('volume mesuré au fermenteur moins les pertes du profil (lie, trub)', () => {
      expect(bottlingReferenceL(20, 19, 1)).toBe(19)
    })

    it('à défaut de mesure, le volume visé par la recette', () => {
      expect(bottlingReferenceL(null, 18.5, 1)).toBe(17.5)
    })

    it('sans profil d’équipement, aucune perte retranchée', () => {
      expect(bottlingReferenceL(20, 19, null)).toBe(20)
    })

    it('jamais négatif, et null sans aucun volume', () => {
      expect(bottlingReferenceL(0.5, 19, 2)).toBe(0)
      expect(bottlingReferenceL(null, null, 1)).toBeNull()
    })
  })
})
