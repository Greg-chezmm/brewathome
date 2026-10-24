import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase/client', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }))

const { toggleBatchStepItem } = await import('@/lib/db/queries/batches')

describe('toggleBatchStepItem', () => {
  beforeEach(() => rpc.mockReset())

  it('envoie à la base l’intention (la case, cochée ou non), pas le tableau entier', async () => {
    rpc.mockResolvedValue({ data: ['mill'], error: null })
    await toggleBatchStepItem('step-1', 'mill', true)
    expect(rpc).toHaveBeenCalledWith('toggle_checked_item', { p_step_id: 'step-1', p_item: 'mill', p_checked: true })
  })

  it('rend le tableau à jour calculé par la base', async () => {
    rpc.mockResolvedValue({ data: ['weigh-grain-0', 'mill'], error: null })
    await expect(toggleBatchStepItem('step-1', 'mill', true)).resolves.toEqual(['weigh-grain-0', 'mill'])
  })

  it('lève l’erreur de la base', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('réseau') })
    await expect(toggleBatchStepItem('step-1', 'mill', false)).rejects.toThrow('réseau')
  })

  it('lève une erreur lisible si l’étape est introuvable (la fonction rend NULL)', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(toggleBatchStepItem('inconnue', 'mill', true)).rejects.toThrow(/étape/i)
  })

  it('ignore ce que la base rendrait si ce n’est pas un tableau', async () => {
    rpc.mockResolvedValue({ data: { a: 1 }, error: null })
    await expect(toggleBatchStepItem('step-1', 'mill', true)).rejects.toThrow()
  })
})
