import { describe, expect, it, vi } from 'vitest'
import { STARTER_RECIPE } from '@/data/starter-recipe'
import { computeRecipe, type RecipeStatsInput } from '@/lib/brew-calc/recipe-stats'
import { adjustHopForIbu, bitteringHopIndex, scaleFermentablesToOg, scaleHopsToIbu } from '@/lib/brew-calc/targets'
import type { Hop } from '@/lib/brew-calc/types'
import { DEFAULT_EQUIPMENT_PROFILE } from '@/lib/db/queries/equipmentProfiles'

// equipmentProfiles charge le client Supabase, qui exige des clés absentes en CI.
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))

const input: RecipeStatsInput = { ...STARTER_RECIPE, equipment: DEFAULT_EQUIPMENT_PROFILE }

const hop = (patch: Partial<Hop>): Hop => ({ name: 'H', amountG: 20, alphaAcidPercent: 10, timeMin: 60, use: 'boil', ...patch })

describe('viser une DI', () => {
  it('atteint la DI visée, à l’arrondi de 10 g près', () => {
    const fermentables = scaleFermentablesToOg(input, 1.06)!
    expect(computeRecipe({ ...input, fermentables }).og).toBeCloseTo(1.06, 3)
  })

  it('garde les proportions du grain', () => {
    const fermentables = scaleFermentablesToOg(input, 1.065)!
    const ratio = (i: number) => fermentables[i].amountKg / STARTER_RECIPE.fermentables[i].amountKg
    expect(ratio(1)).toBeCloseTo(ratio(0), 1)
    expect(ratio(2)).toBeCloseTo(ratio(0), 1)
    expect(fermentables.map((f) => f.name)).toEqual(STARTER_RECIPE.fermentables.map((f) => f.name))
  })

  it('ne propose rien sans fermentable ou pour une DI absurde', () => {
    expect(scaleFermentablesToOg({ ...input, fermentables: [] }, 1.05)).toBeNull()
    expect(scaleFermentablesToOg(input, 1)).toBeNull()
    expect(scaleFermentablesToOg(input, Number.NaN)).toBeNull()
  })
})

describe('viser un IBU (tous les houblons à l’échelle)', () => {
  it('atteint l’IBU visé en gardant les proportions', () => {
    const hops = scaleHopsToIbu(input, 40)!
    expect(computeRecipe({ ...input, hops }).ibu).toBeCloseTo(40, 0)
    const ratio = (i: number) => hops[i].amountG / (STARTER_RECIPE.hops[i].amountG || 1)
    for (let i = 1; i < hops.length; i++) expect(ratio(i)).toBeCloseTo(ratio(0), 1)
  })

  it('redimensionnement d’équipement : DI et IBU conservés sur un nouveau volume/efficacité', () => {
    const before = computeRecipe(input)
    // Nouveau matériel : volume plus petit, efficacité différente.
    const newInput: RecipeStatsInput = {
      ...input,
      targetVolumeL: input.targetVolumeL * 0.7,
      mashEfficiencyPercent: 78,
    }
    const fermentables = scaleFermentablesToOg(newInput, before.og)!
    const hops = scaleHopsToIbu({ ...newInput, fermentables }, before.ibu)!
    const after = computeRecipe({ ...newInput, fermentables, hops })
    expect(after.og).toBeCloseTo(before.og, 2)
    expect(after.ibu).toBeCloseTo(before.ibu, 0)
  })

  it('ne propose rien sans houblon ou pour un IBU absurde', () => {
    expect(scaleHopsToIbu({ ...input, hops: [] }, 30)).toBeNull()
    expect(scaleHopsToIbu(input, 0)).toBeNull()
    expect(scaleHopsToIbu(input, Number.NaN)).toBeNull()
  })
})

describe('houblon amérisant', () => {
  it('prend l’ajout le plus long en ébullition', () => {
    expect(bitteringHopIndex(STARTER_RECIPE.hops)).toBe(0)
    expect(bitteringHopIndex([hop({ timeMin: 15 }), hop({ timeMin: 60 }), hop({ use: 'whirlpool', timeMin: 90 })])).toBe(1)
  })

  it('préfère le premier moût, qui bout plus longtemps', () => {
    expect(bitteringHopIndex([hop({ timeMin: 60 }), hop({ use: 'first-wort', timeMin: 0 })])).toBe(1)
  })

  it('aucun sans houblon d’ébullition', () => {
    expect(bitteringHopIndex([hop({ use: 'dry-hop' }), hop({ use: 'whirlpool' })])).toBeNull()
    expect(bitteringHopIndex([])).toBeNull()
  })
})

describe('viser un IBU', () => {
  it.each(['tinseth', 'rager', 'garetz'] as const)('atteint l’IBU visé en ne touchant que l’amérisant (%s)', (ibuFormula) => {
    const base = { ...input, ibuFormula }
    const result = adjustHopForIbu(base, 0, 45)!
    expect(result.unreachable).toBe(false)
    // Arrondi au gramme : un gramme de Magnum (14 %) pèse environ 1 IBU.
    expect(Math.abs(computeRecipe({ ...base, hops: result.hops }).ibu - 45)).toBeLessThan(1)
    expect(result.hops.slice(1)).toEqual(STARTER_RECIPE.hops.slice(1))
    expect(result.hops[0].amountG).toBe(result.amountG)
    expect(Number.isInteger(result.amountG)).toBe(true)
  })

  it('signale une cible déjà dépassée par les houblons d’arôme', () => {
    const result = adjustHopForIbu(input, 0, 1)!
    expect(result.amountG).toBe(0)
    expect(result.unreachable).toBe(true)
  })

  it('compte 0 g pour un champ en cours de saisie', () => {
    const hops = STARTER_RECIPE.hops.map((h, i) => (i === 1 ? { ...h, amountG: Number.NaN } : h))
    expect(adjustHopForIbu({ ...input, hops }, 0, 40)).not.toBeNull()
  })
})
