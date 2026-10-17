import { describe, expect, it } from 'vitest'
import {
  hopstandOf,
  tinsethContributions,
  calculateIBU_Garetz,
  calculateIBU_Rager,
  garetzContributions,
  garetzUtilization,
  calculateIBU_Tinseth,
  hopstandUtilizationFactor,
} from '@/lib/brew-calc/ibu'
import type { Hop } from '@/lib/brew-calc/types'

describe('calculateIBU_Tinseth', () => {
  it('matches the hand-computed classic example (28g @ 10% AA, 60 min, OG 1.050, 20L)', () => {
    const hops: Hop[] = [{ name: 'Test Hop', amountG: 28, alphaAcidPercent: 10, timeMin: 60, use: 'boil' }]
    const ibu = calculateIBU_Tinseth(hops, 1.05, 20)
    expect(ibu).toBeCloseTo(32.3, 1)
  })

  it('ignores dry-hop additions entirely', () => {
    const hops: Hop[] = [{ name: 'Dry Hop', amountG: 50, alphaAcidPercent: 5.5, timeMin: 7200, use: 'dry-hop' }]
    expect(calculateIBU_Tinseth(hops, 1.05, 20)).toBe(0)
  })

  it('applies a reduced, temperature-dependent utilization to whirlpool additions', () => {
    const whirlpoolHop: Hop = { name: 'Whirlpool', amountG: 20, alphaAcidPercent: 8, timeMin: 20, use: 'whirlpool' }
    const boilHop: Hop = { ...whirlpoolHop, use: 'boil' }
    const whirlpoolIbu = calculateIBU_Tinseth([whirlpoolHop], 1.05, 20)
    const boilIbu = calculateIBU_Tinseth([boilHop], 1.05, 20)
    expect(whirlpoolIbu).toBeGreaterThan(0)
    expect(whirlpoolIbu).toBeLessThan(boilIbu)
  })

  it('whirlpool contribution decreases at lower hopstand temperatures', () => {
    const whirlpoolHop: Hop = { name: 'Whirlpool', amountG: 20, alphaAcidPercent: 8, timeMin: 20, use: 'whirlpool' }
    const hot = calculateIBU_Tinseth([whirlpoolHop], 1.05, 20, { hopstandTempC: 90 })
    const cool = calculateIBU_Tinseth([whirlpoolHop], 1.05, 20, { hopstandTempC: 65 })
    expect(hot).toBeGreaterThan(cool)
  })

  it('utilization increases with boil time and decreases with higher gravity', () => {
    const shortBoil: Hop = { name: 'h', amountG: 10, alphaAcidPercent: 10, timeMin: 10, use: 'boil' }
    const longBoil: Hop = { ...shortBoil, timeMin: 60 }
    expect(calculateIBU_Tinseth([longBoil], 1.05, 20)).toBeGreaterThan(
      calculateIBU_Tinseth([shortBoil], 1.05, 20),
    )

    const lowGravity = calculateIBU_Tinseth([longBoil], 1.04, 20)
    const highGravity = calculateIBU_Tinseth([longBoil], 1.09, 20)
    expect(lowGravity).toBeGreaterThan(highGravity)
  })

  it('sums contributions from multiple hop additions', () => {
    const hop1: Hop = { name: 'h1', amountG: 15, alphaAcidPercent: 12, timeMin: 60, use: 'boil' }
    const hop2: Hop = { name: 'h2', amountG: 15, alphaAcidPercent: 5, timeMin: 15, use: 'boil' }
    const total = calculateIBU_Tinseth([hop1, hop2], 1.05, 20)
    const sumOfIndividual =
      calculateIBU_Tinseth([hop1], 1.05, 20) + calculateIBU_Tinseth([hop2], 1.05, 20)
    expect(total).toBeCloseTo(sumOfIndividual, 10)
  })
})

describe('calculateIBU_Rager', () => {
  it('produces a positive IBU value for a standard boil addition', () => {
    const hops: Hop[] = [{ name: 'Test Hop', amountG: 28, alphaAcidPercent: 10, timeMin: 60, use: 'boil' }]
    const ibu = calculateIBU_Rager(hops, 1.05, 20)
    expect(ibu).toBeGreaterThan(0)
  })

  it('applies the gravity adjustment only above boil gravity 1.050', () => {
    const hops: Hop[] = [{ name: 'Test Hop', amountG: 28, alphaAcidPercent: 10, timeMin: 60, use: 'boil' }]
    const atThreshold = calculateIBU_Rager(hops, 1.05, 20)
    const aboveThreshold = calculateIBU_Rager(hops, 1.09, 20)
    expect(aboveThreshold).toBeLessThan(atThreshold)
  })
})

describe('hopstandUtilizationFactor', () => {
  it('matches the ~0.23 reference value documented for 80°C', () => {
    expect(hopstandUtilizationFactor(80)).toBeCloseTo(0.23, 2)
  })

  it('reaches 1 at the boiling point and decreases below it', () => {
    expect(hopstandUtilizationFactor(100)).toBeCloseTo(1, 6)
    expect(hopstandUtilizationFactor(60)).toBeLessThan(hopstandUtilizationFactor(80))
  })
})

describe('garetzUtilization', () => {
  it('suit la table par paliers de Garetz', () => {
    expect(garetzUtilization(0)).toBe(0)
    expect(garetzUtilization(10)).toBe(0)
    expect(garetzUtilization(15)).toBeCloseTo(0.02, 10)
    expect(garetzUtilization(30)).toBeCloseTo(0.11, 10)
    expect(garetzUtilization(60)).toBeCloseTo(0.2, 10)
    expect(garetzUtilization(90)).toBeCloseTo(0.23, 10)
    expect(garetzUtilization(120)).toBeCloseTo(0.23, 10)
  })

  it('ne décroît jamais avec le temps d’ébullition', () => {
    for (let t = 0; t < 120; t++) expect(garetzUtilization(t + 1)).toBeGreaterThanOrEqual(garetzUtilization(t))
  })
})

describe('calculateIBU_Garetz', () => {
  const bittering: Hop = { name: 'Test Hop', amountG: 28, alphaAcidPercent: 10, timeMin: 60, use: 'boil' }

  it('cas calculé à la main : 28 g à 10 %, 60 min, densité 1,050, 20 L, CF = 1', () => {
    // U(60) = 20 % → IBU avant HF : 0,20 × 0,10 × 28 × 1000 / 20 = 28,0 (GF = TF = 1).
    // HF = I / 260 + 1 et I × HF = 28 → I² / 260 + I − 28 = 0
    // → I = 130 × (√(1 + 4 × 28 / 260) − 1) = 130 × (1,19615 − 1) ≈ 25,50.
    expect(calculateIBU_Garetz([bittering], 1.05, 20)).toBeCloseTo(25.5, 1)
    // Même recette en Tinseth : 32,3 IBU — Garetz est plus bas.
    expect(calculateIBU_Garetz([bittering], 1.05, 20)).toBeLessThan(calculateIBU_Tinseth([bittering], 1.05, 20))
  })

  it('cas calculé à la main avec concentration et densité : 25 L → 20 L, densité 1,060', () => {
    // CF = 20 / 25 = 0,8 ; GF = (1,060 − 1,050) / 0,2 + 1 = 1,05 ; R = 28 / 1,05 = 26,667.
    // I × (1 + 0,8 × I / 260) = 26,667 → I = 2R / (1 + √(1 + 4 × 0,8 × R / 260)) ≈ 24,78.
    expect(calculateIBU_Garetz([bittering], 1.06, 20, { boilVolumeL: 25 })).toBeCloseTo(24.78, 2)
  })

  it('le facteur d’amertume est le point fixe de l’itération du livre', () => {
    const options = { boilVolumeL: 25 }
    const ibu = calculateIBU_Garetz([bittering], 1.06, 20, options)
    // Itération « à la Garetz » : on repart des IBU obtenus comme IBU visés jusqu'à stabilité.
    let iterated = calculateIBU_Garetz([bittering], 1.06, 20, { ...options, desiredIbu: 0 })
    for (let i = 0; i < 50; i++) iterated = calculateIBU_Garetz([bittering], 1.06, 20, { ...options, desiredIbu: iterated })
    expect(iterated).toBeCloseTo(ibu, 6)
  })

  it('utilise les IBU visés pour HF quand ils sont fournis', () => {
    // HF = 40 / 260 + 1 → 28 / 1,1538 ≈ 24,27.
    expect(calculateIBU_Garetz([bittering], 1.05, 20, { desiredIbu: 40 })).toBeCloseTo(28 / (40 / 260 + 1), 6)
  })

  it('reste plus bas que Tinseth sur des recettes courantes', () => {
    const recipe: Hop[] = [
      { name: 'Magnum', amountG: 20, alphaAcidPercent: 13, timeMin: 60, use: 'boil', form: 'pellet' },
      { name: 'Cascade', amountG: 30, alphaAcidPercent: 6, timeMin: 15, use: 'boil', form: 'pellet' },
      { name: 'Citra', amountG: 30, alphaAcidPercent: 12, timeMin: 5, use: 'boil', form: 'pellet' },
    ]
    for (const gravity of [1.04, 1.05, 1.065, 1.08]) {
      const garetz = calculateIBU_Garetz(recipe, gravity, 20)
      const tinseth = calculateIBU_Tinseth(recipe, gravity, 20)
      expect(garetz).toBeGreaterThan(0.4 * tinseth)
      expect(garetz).toBeLessThan(tinseth)
    }
  })

  it('croît avec la quantité de houblon, mais moins que proportionnellement (HF)', () => {
    const amounts = [10, 20, 40, 80]
    const ibus = amounts.map((amountG) => calculateIBU_Garetz([{ ...bittering, amountG }], 1.05, 20))
    for (let i = 1; i < ibus.length; i++) {
      expect(ibus[i]).toBeGreaterThan(ibus[i - 1])
      expect(ibus[i]).toBeLessThan(2 * ibus[i - 1])
    }
  })

  it('croît avec le temps d’ébullition et baisse avec la densité au-delà de 1,050', () => {
    const at = (timeMin: number, gravity = 1.05) => calculateIBU_Garetz([{ ...bittering, timeMin }], gravity, 20)
    expect(at(60)).toBeGreaterThan(at(30))
    expect(at(30)).toBeGreaterThan(at(15))
    expect(at(10)).toBe(0)
    expect(at(60, 1.04)).toBeCloseTo(at(60, 1.05), 10)
    expect(at(60, 1.09)).toBeLessThan(at(60, 1.05))
  })

  it('baisse avec l’altitude (TF) et quand on bout un moût concentré (CF)', () => {
    const base = calculateIBU_Garetz([bittering], 1.05, 20)
    expect(calculateIBU_Garetz([bittering], 1.05, 20, { altitudeM: 1500 })).toBeLessThan(base)
    expect(calculateIBU_Garetz([bittering], 1.05, 20, { altitudeM: 0 })).toBeCloseTo(base, 10)
    // Ébullition partielle : 10 L bouillis pour 20 L finaux → CF = 2, HF plus fort.
    expect(calculateIBU_Garetz([bittering], 1.05, 20, { boilVolumeL: 10 })).toBeLessThan(base)
  })

  it('gère whirlpool, premier moût, pellets et dry hop comme Tinseth', () => {
    const whirlpool: Hop = { ...bittering, timeMin: 30, use: 'whirlpool' }
    const [wp] = garetzContributions([whirlpool], 1.05, 20, { hopstandTempC: 80 })
    const [boil30] = garetzContributions([{ ...whirlpool, use: 'boil' }], 1.05, 20)
    expect(wp).toBeGreaterThan(0)
    expect(wp).toBeLessThan(boil30)

    expect(calculateIBU_Garetz([{ ...bittering, use: 'dry-hop', timeMin: 4320 }], 1.05, 20)).toBe(0)
    expect(calculateIBU_Garetz([{ ...bittering, use: 'mash' }], 1.05, 20)).toBe(0)

    // Premier moût : durée d'ébullition et × 1,10 (avant HF).
    const fwh = calculateIBU_Garetz([{ ...bittering, use: 'first-wort', timeMin: 0 }], 1.05, 20, { boilTimeMin: 60 })
    expect(fwh).toBeGreaterThan(calculateIBU_Garetz([bittering], 1.05, 20))

    const [pellet] = garetzContributions([{ ...bittering, form: 'pellet' }], 1.05, 20, { desiredIbu: 30 })
    const [leaf] = garetzContributions([{ ...bittering, form: 'leaf' }], 1.05, 20, { desiredIbu: 30 })
    expect(pellet / leaf).toBeCloseTo(1.1, 6)
  })

  it('répartit le total entre les ajouts', () => {
    const hops: Hop[] = [bittering, { ...bittering, timeMin: 20, amountG: 15 }]
    const parts = garetzContributions(hops, 1.06, 20, { boilVolumeL: 24 })
    expect(parts[0] + parts[1]).toBeCloseTo(calculateIBU_Garetz(hops, 1.06, 20, { boilVolumeL: 24 }), 10)
    expect(parts[0]).toBeGreaterThan(parts[1])
  })
})

describe('Tinseth : pellets et hopstand', () => {
  const boil = { name: 'Magnum', amountG: 20, alphaAcidPercent: 12, timeMin: 10, use: 'boil' as const }

  it('donne 10 % d’utilisation en plus aux pellets qu’aux cônes', () => {
    const [pellet] = tinsethContributions([{ ...boil, form: 'pellet' }], 1.05, 20)
    const [leaf] = tinsethContributions([{ ...boil, form: 'leaf' }], 1.05, 20)
    expect(pellet / leaf).toBeCloseTo(1.1, 6)
  })

  it('fait continuer l’isomérisation des ajouts en ébullition pendant le hopstand', () => {
    const whirlpool = { name: 'Citra', amountG: 10, alphaAcidPercent: 12, timeMin: 30, use: 'whirlpool' as const, temperatureC: 90 }
    const [without] = tinsethContributions([boil], 1.05, 20)
    const [withHopstand] = tinsethContributions([boil, whirlpool], 1.05, 20)
    expect(withHopstand).toBeGreaterThan(without * 1.2)
    expect(hopstandOf([boil, whirlpool])).toEqual({ minutes: 30, temperatureC: 90 })
  })
})
