import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'

const mocks = vi.hoisted(() => ({
  recipeCount: 0,
  createRecipe: vi.fn(async () => 'new-recipe'),
  updateUser: vi.fn(async () => ({ error: null })),
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: () => ({ select: async () => ({ count: mocks.recipeCount, error: null }) }),
    auth: { updateUser: mocks.updateUser },
  },
}))
vi.mock('@/lib/db/queries/recipes', () => ({ createRecipe: mocks.createRecipe }))

const { ensureStarterRecipe } = await import('@/lib/db/queries/starterRecipe')
const { STARTER_RECIPE } = await import('@/data/starter-recipe')

let n = 0
const newUser = (metadata: Record<string, unknown> = {}) => ({ id: `user-${++n}`, user_metadata: metadata }) as unknown as User

describe('ensureStarterRecipe', () => {
  beforeEach(() => {
    mocks.recipeCount = 0
    mocks.createRecipe.mockClear()
    mocks.updateUser.mockClear()
  })

  it('offre la Pale Ale à un compte sans recette, puis pose le marqueur', async () => {
    const user = newUser()
    expect(await ensureStarterRecipe(user)).toBe(true)
    expect(mocks.createRecipe).toHaveBeenCalledWith(user.id, STARTER_RECIPE)
    expect(mocks.updateUser).toHaveBeenCalledWith({ data: { starter_recipe: true } })
  })

  it('ne touche pas un compte qui a déjà ses recettes (mais pose le marqueur)', async () => {
    mocks.recipeCount = 12
    expect(await ensureStarterRecipe(newUser())).toBe(false)
    expect(mocks.createRecipe).not.toHaveBeenCalled()
    expect(mocks.updateUser).toHaveBeenCalled()
  })

  it('ne recrée pas la recette une fois le marqueur posé (même supprimée)', async () => {
    expect(await ensureStarterRecipe(newUser({ starter_recipe: true }))).toBe(false)
    expect(mocks.createRecipe).not.toHaveBeenCalled()
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('une seule création même si l’effet se lance deux fois', async () => {
    const user = newUser()
    await Promise.all([ensureStarterRecipe(user), ensureStarterRecipe(user)])
    expect(mocks.createRecipe).toHaveBeenCalledTimes(1)
  })
})
