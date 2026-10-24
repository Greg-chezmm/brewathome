import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BatchStep } from '@/lib/db/queries/batches'

const api = vi.hoisted(() => ({ toggle: vi.fn() }))

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))
vi.mock('@/lib/db/queries/batches', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/queries/batches')>()),
  toggleBatchStepItem: api.toggle,
}))

const { useStepActions } = await import('@/hooks/useStepActions')

const step = (checkedItems: string[]) => ({ id: 's1', checkedItems }) as unknown as BatchStep

function setup(initial: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['batch-steps', 'b1'], [step(initial)])
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useStepActions({ batchId: 'b1', onAdvance: vi.fn(), onReset: vi.fn() }), { wrapper })
  const cached = () => client.getQueryData<BatchStep[]>(['batch-steps', 'b1'])![0].checkedItems
  return { result, cached }
}

describe('useStepActions.toggleItem', () => {
  beforeEach(() => {
    api.toggle.mockReset()
  })

  it('coche une case en envoyant seulement cette case à la base', async () => {
    api.toggle.mockResolvedValue(['a', 'b'])
    const { result, cached } = setup(['a'])
    await act(async () => {
      await result.current.toggleItem(step(['a']), 'b')
    })
    expect(api.toggle).toHaveBeenCalledWith('s1', 'b', true)
    expect(cached()).toEqual(['a', 'b'])
  })

  it('décoche une case déjà cochée', async () => {
    api.toggle.mockResolvedValue([])
    const { result, cached } = setup(['a'])
    await act(async () => {
      await result.current.toggleItem(step(['a']), 'a')
    })
    expect(api.toggle).toHaveBeenCalledWith('s1', 'a', false)
    expect(cached()).toEqual([])
  })

  it('revient à l’état d’avant et affiche l’erreur si l’écriture échoue', async () => {
    api.toggle.mockRejectedValue(new Error('hors ligne'))
    const { result, cached } = setup(['a'])
    await act(async () => {
      await result.current.toggleItem(step(['a']), 'b')
    })
    expect(cached()).toEqual(['a'])
    expect(result.current.error).toBe('hors ligne')
  })
})
