import { beforeEach, describe, expect, it, vi } from 'vitest'

const update = vi.fn()
const eq = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: (...args: unknown[]) => {
        update(...args)
        return { eq }
      },
    }),
  },
}))

const { updateBatchTastings, updateBatchConditioning, updateBatchCosts } = await import('@/lib/db/queries/batches')

describe('écritures des dégustations, du conditionnement et du coût', () => {
  beforeEach(() => {
    update.mockClear()
    eq.mockReset()
    eq.mockResolvedValue({ error: null })
  })

  it('enregistre les dégustations du brassin', async () => {
    const tastings = [{ id: 't1', date: '2026-11-02', rating: 4, appearance: '', aroma: '', taste: '', changeNext: '' }]
    await updateBatchTastings('b1', tastings)
    expect(update).toHaveBeenCalledWith({ tastings })
    expect(eq).toHaveBeenCalledWith('id', 'b1')
  })

  it('enregistre le début du conditionnement et la durée de conditionnement', async () => {
    await updateBatchConditioning('b1', { conditioningStart: '2026-10-24', conditioningDays: 14 })
    expect(update).toHaveBeenCalledWith({ conditioning_start: '2026-10-24', conditioning_days: 14 })
  })

  it('efface la date et la durée avec null', async () => {
    await updateBatchConditioning('b1', { conditioningStart: null, conditioningDays: null })
    expect(update).toHaveBeenCalledWith({ conditioning_start: null, conditioning_days: null })
  })

  it('enregistre les lignes de coût', async () => {
    await updateBatchCosts('b1', [{ label: 'Pale', amount: 4.2 }])
    expect(update).toHaveBeenCalledWith({ costs: [{ label: 'Pale', amount: 4.2 }] })
  })

  it.each([
    ['dégustations', () => updateBatchTastings('b1', [])],
    ['conditionnement', () => updateBatchConditioning('b1', { conditioningStart: null, conditioningDays: null })],
    ['coût', () => updateBatchCosts('b1', [])],
  ])('lève l’erreur de la base (%s)', async (_name, call) => {
    eq.mockResolvedValue({ error: new Error('hors ligne') })
    await expect(call()).rejects.toThrow('hors ligne')
  })
})
