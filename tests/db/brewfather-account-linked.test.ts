import { beforeEach, describe, expect, it, vi } from 'vitest'

const select = vi.fn()
const maybeSingle = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  supabase: { from: () => ({ select: (...args: unknown[]) => (select(...args), { maybeSingle }) }) },
}))

const { hasBrewfatherAccount } = await import('@/lib/db/queries/brewfather')

describe('hasBrewfatherAccount', () => {
  beforeEach(() => {
    select.mockClear()
    maybeSingle.mockReset()
  })

  it('ne demande jamais la clé d’API à la base', async () => {
    maybeSingle.mockResolvedValue({ data: { brewfather_user_id: 'bf' }, error: null })
    await hasBrewfatherAccount()
    expect(select).toHaveBeenCalledWith('brewfather_user_id')
    expect(String(select.mock.calls[0][0])).not.toMatch(/api_key/)
  })

  it('dit si un compte Brewfather est relié', async () => {
    maybeSingle.mockResolvedValue({ data: { brewfather_user_id: 'bf' }, error: null })
    await expect(hasBrewfatherAccount()).resolves.toBe(true)
    maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(hasBrewfatherAccount()).resolves.toBe(false)
  })

  it('lève l’erreur de la base', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: new Error('réseau') })
    await expect(hasBrewfatherAccount()).rejects.toThrow('réseau')
  })
})
