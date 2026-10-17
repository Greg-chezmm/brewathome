import { describe, expect, it, vi } from 'vitest'
import bjcpStyles from '@/data/bjcp-styles-2021.json'
import { STARTER_RECIPE } from '@/data/starter-recipe'
import { estimateRecipeStats } from '@/lib/brew-calc/recipe-stats'
import { matchStyle } from '@/lib/brew-calc/style-matching'
import { DEFAULT_EQUIPMENT_PROFILE } from '@/lib/db/queries/equipmentProfiles'

// equipmentProfiles charge le client Supabase, qui exige des clés absentes en CI.
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))

const style = bjcpStyles.find((s) => s.id === STARTER_RECIPE.styleId)!
const ranges = {
  og: { min: style.ogMin, max: style.ogMax },
  fg: { min: style.fgMin, max: style.fgMax },
  ibu: { min: style.ibuMin, max: style.ibuMax },
  srm: { min: style.srmMin, max: style.srmMax },
  abv: { min: style.abvMin, max: style.abvMax },
}

describe('recette offerte aux nouveaux comptes', () => {
  it('existe dans le référentiel BJCP', () => {
    expect(style.name).toBe('American Pale Ale')
  })

  it.each([
    ['sans profil d’équipement (à la création du compte)', null],
    ['avec le profil d’équipement par défaut', DEFAULT_EQUIPMENT_PROFILE],
  ])('est dans toutes les plages du style %s', (_label, equipment) => {
    const stats = estimateRecipeStats({ ...STARTER_RECIPE, equipment })
    const match = matchStyle(stats, ranges)
    expect(match.allMatch, JSON.stringify(stats)).toBe(true)
  })
})
