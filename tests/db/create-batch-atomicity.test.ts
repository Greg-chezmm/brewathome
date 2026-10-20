import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ParsedRecipeDraft } from '@/lib/beerxml/types'
import type { BrewfatherBatchImport } from '@/lib/brewfather/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'
import { STARTER_RECIPE } from '@/data/starter-recipe'
import { fakeDb } from './fake-supabase'

const recipes = vi.hoisted(() => ({
  getRecipeWithDetails: vi.fn(),
  updateRecipeStatus: vi.fn(async () => {}),
}))

vi.mock('@/lib/supabase/client', async () => ({ supabase: (await import('./fake-supabase')).fakeSupabase }))
vi.mock('@/lib/db/queries/equipmentProfiles', () => ({
  getEquipmentProfile: async () => null,
  findOrCreateEquipmentProfile: async () => null,
}))
vi.mock('@/lib/db/queries/recipes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/queries/recipes')>()),
  getRecipeWithDetails: recipes.getRecipeWithDetails,
  updateRecipeStatus: recipes.updateRecipeStatus,
}))

const { createBatchFromRecipe, createBatchFromBrewfather } = await import('@/lib/db/queries/batches')

const savedRecipe = {
  ...STARTER_RECIPE,
  id: 'r1',
  status: 'validated',
  createdAt: '2026-01-01',
  estOg: null,
  estFg: null,
  estIbu: null,
  estSrm: null,
  estAbv: null,
} as unknown as RecipeDetails

const imported: BrewfatherBatchImport = {
  brewfatherId: 'bf-1',
  name: 'Pale Ale importée',
  brewDate: '2026-02-01',
  status: 'planned',
  ogMeasured: null,
  fgMeasured: null,
  volumeMeasuredL: null,
  measurements: {},
  draft: { ...STARTER_RECIPE, style: null } as unknown as ParsedRecipeDraft,
  equipment: null,
}

const stepsError = new Error('réseau coupé pendant l’insertion des étapes')

function failStepsInsert(cleanup: (() => never) | { error: unknown } | null = null) {
  fakeDb.respond = (call) => {
    if (call.table === 'batch_steps' && call.op === 'insert') return { data: null, error: stepsError }
    if (call.table === 'batches' && call.op === 'delete') {
      if (typeof cleanup === 'function') return cleanup()
      return { data: null, error: cleanup?.error ?? null }
    }
    return { data: call.single ? { id: 'batches-1' } : null, error: null }
  }
}

describe('création d’un brassin : jamais de brassin sans étapes', () => {
  beforeEach(() => {
    fakeDb.reset()
    recipes.getRecipeWithDetails.mockReset().mockResolvedValue(savedRecipe)
    recipes.updateRecipeStatus.mockClear()
  })

  it('crée le brassin puis ses étapes, et valide la recette', async () => {
    expect(await createBatchFromRecipe('u1', 'r1', 'Brassin', null)).toBe('batches-1')
    expect(fakeDb.find('batch_steps', 'insert')).toBeDefined()
    expect(fakeDb.find('batches', 'delete')).toBeUndefined()
    expect(recipes.updateRecipeStatus).toHaveBeenCalledWith('r1', 'validated')
  })

  it('supprime le brassin si l’insertion des étapes échoue, et remonte l’erreur d’origine', async () => {
    failStepsInsert()
    await expect(createBatchFromRecipe('u1', 'r1', 'Brassin', null)).rejects.toBe(stepsError)
    expect(fakeDb.find('batches', 'delete')?.filters).toEqual([['id', 'batches-1']])
    expect(recipes.updateRecipeStatus).not.toHaveBeenCalled()
  })

  it('remonte l’erreur d’origine même si le nettoyage échoue', async () => {
    failStepsInsert({ error: new Error('nettoyage impossible') })
    await expect(createBatchFromRecipe('u1', 'r1', 'Brassin', null)).rejects.toBe(stepsError)
    expect(fakeDb.find('batches', 'delete')).toBeDefined()
  })

  it('remonte l’erreur d’origine même si le nettoyage lève une exception', async () => {
    failStepsInsert(() => {
      throw new Error('réseau toujours coupé')
    })
    await expect(createBatchFromRecipe('u1', 'r1', 'Brassin', null)).rejects.toBe(stepsError)
  })

  it('même garantie pour un brassin importé de Brewfather non encore brassé', async () => {
    failStepsInsert()
    await expect(createBatchFromBrewfather('u1', imported)).rejects.toBe(stepsError)
    expect(fakeDb.find('batches', 'delete')?.filters).toEqual([['id', 'batches-1']])
  })

  it('un brassin Brewfather déjà brassé n’a pas d’étapes à insérer ni à nettoyer', async () => {
    expect(await createBatchFromBrewfather('u1', { ...imported, status: 'completed' })).toBe('batches-1')
    expect(fakeDb.find('batch_steps', 'insert')).toBeUndefined()
    expect(fakeDb.find('batches', 'delete')).toBeUndefined()
  })
})
