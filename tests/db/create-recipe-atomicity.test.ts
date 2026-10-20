import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STARTER_RECIPE } from '@/data/starter-recipe'
import { fakeDb } from './fake-supabase'

vi.mock('@/lib/supabase/client', async () => ({ supabase: (await import('./fake-supabase')).fakeSupabase }))
vi.mock('@/lib/db/queries/equipmentProfiles', () => ({ getEquipmentProfile: async () => null }))

const { createRecipe } = await import('@/lib/db/queries/recipes')

const hopsError = new Error('réseau coupé pendant l’insertion des houblons')

function failOn(table: string, cleanup: (() => never) | { error: unknown } | null = null) {
  fakeDb.respond = (call) => {
    if (call.table === table && call.op === 'insert') return { data: null, error: hopsError }
    if (call.table === 'recipes' && call.op === 'delete') {
      if (typeof cleanup === 'function') return cleanup()
      return { data: null, error: cleanup?.error ?? null }
    }
    if (call.op === 'insert') return { data: call.single ? { id: 'recipes-1' } : [{ id: `${call.table}-new` }], error: null }
    return { data: call.op === 'select' ? [] : null, error: null }
  }
}

describe('création d’une recette : jamais de recette vide', () => {
  beforeEach(() => fakeDb.reset())

  it('crée la recette puis ses ingrédients', async () => {
    expect(await createRecipe('u1', STARTER_RECIPE)).toBe('recipes-1')
    expect(fakeDb.find('recipe_hops', 'insert')).toBeDefined()
    expect(fakeDb.find('recipes', 'delete')).toBeUndefined()
  })

  it('supprime la recette si l’insertion des ingrédients échoue, et remonte l’erreur d’origine', async () => {
    failOn('recipe_hops')
    await expect(createRecipe('u1', STARTER_RECIPE)).rejects.toBe(hopsError)
    expect(fakeDb.find('recipes', 'delete')?.filters).toEqual([['id', 'recipes-1']])
  })

  it('retire aussi les ingrédients déjà insérés avant l’échec', async () => {
    failOn('recipe_hops')
    await expect(createRecipe('u1', STARTER_RECIPE)).rejects.toBe(hopsError)
    expect(fakeDb.find('recipe_fermentables', 'delete')?.filters).toEqual([['id', ['recipe_fermentables-new']]])
  })

  it('remonte l’erreur d’origine même si le nettoyage échoue', async () => {
    failOn('recipe_hops', { error: new Error('nettoyage impossible') })
    await expect(createRecipe('u1', STARTER_RECIPE)).rejects.toBe(hopsError)
    expect(fakeDb.find('recipes', 'delete')).toBeDefined()
  })

  it('remonte l’erreur d’origine même si le nettoyage lève une exception', async () => {
    failOn('recipe_hops', () => {
      throw new Error('réseau toujours coupé')
    })
    await expect(createRecipe('u1', STARTER_RECIPE)).rejects.toBe(hopsError)
  })
})
