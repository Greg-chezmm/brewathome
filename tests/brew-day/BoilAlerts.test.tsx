import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBoilAlerts } from '@/hooks/useBoilAlerts'
import type { BatchStep } from '@/lib/db/queries/batches'

const START = new Date('2026-01-01T10:00:00Z').getTime()
const MIN = 60_000

function step(id: string, over: Partial<BatchStep> = {}): BatchStep {
  return {
    id,
    stepType: 'other',
    label: id,
    orderIndex: 0,
    plannedDurationMin: null,
    triggerTimeMin: null,
    status: 'todo',
    actualStartAt: null,
    actualEndAt: null,
    checkedItems: [],
    session: null,
    notes: null,
    ...over,
  } as BatchStep
}

/** Ébullition de 60 min démarrée à START ; l'ajout « Houblon » est dû à 45 min (15 min avant la fin). */
function boilSteps(): BatchStep[] {
  return [
    step('boil', { stepType: 'boil', status: 'in-progress', actualStartAt: new Date(START).toISOString(), plannedDurationMin: 60 }),
    step('hop', { stepType: 'hop-addition', label: 'Houblon', triggerTimeMin: 15 }),
  ]
}

const BEFORE_DUE = START + 10 * MIN
const DUE = START + 46 * MIN

beforeEach(() => {
  document.title = 'BrewAtHome'
})
afterEach(() => vi.restoreAllMocks())

describe('useBoilAlerts', () => {
  it('ne fait rien avant l’échéance', () => {
    const play = vi.fn(() => true)
    renderHook(() => useBoilAlerts(boilSteps(), BEFORE_DUE, true, play))
    expect(play).not.toHaveBeenCalled()
    expect(document.title).toBe('BrewAtHome')
  })

  it('joue le son et change le titre à l’échéance, une seule fois', () => {
    const play = vi.fn(() => true)
    const steps = boilSteps()
    const { rerender } = renderHook(({ now }) => useBoilAlerts(steps, now, true, play), { initialProps: { now: DUE } })
    rerender({ now: DUE + 1000 })
    rerender({ now: DUE + 2000 })
    expect(play).toHaveBeenCalledTimes(1)
    expect(document.title).toBe('⏰ Houblon — BrewAtHome')
  })

  it('réessaie le son tant que play() échoue, sans rejouer ensuite', () => {
    const play = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(false).mockReturnValue(true)
    const steps = boilSteps()
    const { rerender } = renderHook(({ now }) => useBoilAlerts(steps, now, true, play), { initialProps: { now: DUE } })
    expect(document.title).toBe('⏰ Houblon — BrewAtHome')
    rerender({ now: DUE + 1000 })
    rerender({ now: DUE + 2000 })
    rerender({ now: DUE + 3000 })
    rerender({ now: DUE + 4000 })
    expect(play).toHaveBeenCalledTimes(3)
  })

  it('ne remet pas le titre à jour à chaque nouvel essai du son', () => {
    const play = vi.fn(() => false)
    const steps = boilSteps()
    const { rerender } = renderHook(({ now }) => useBoilAlerts(steps, now, true, play), { initialProps: { now: DUE } })
    document.title = 'Autre titre'
    rerender({ now: DUE + 1000 })
    expect(document.title).toBe('Autre titre')
  })

  it('alerte aussi à la fin d’un minuteur', () => {
    const play = vi.fn(() => true)
    const steps = [step('mash', { stepType: 'mash', label: 'Empâtage', status: 'in-progress', actualStartAt: new Date(START).toISOString(), plannedDurationMin: 60 })]
    renderHook(() => useBoilAlerts(steps, START + 61 * MIN, true, play))
    expect(play).toHaveBeenCalledTimes(1)
    expect(document.title).toBe('⏰ Minuteur terminé : Empâtage — BrewAtHome')
  })

  it('forget() ré-arme le titre et le son', () => {
    const play = vi.fn(() => true)
    const steps = boilSteps()
    const { result, rerender } = renderHook(({ now }) => useBoilAlerts(steps, now, true, play), { initialProps: { now: DUE } })
    expect(play).toHaveBeenCalledTimes(1)
    document.title = 'BrewAtHome'
    result.current.forget('hop')
    rerender({ now: DUE + 1000 })
    expect(play).toHaveBeenCalledTimes(2)
    expect(document.title).toBe('⏰ Houblon — BrewAtHome')
  })

  it('ne fait rien quand les alertes sont désactivées', () => {
    const play = vi.fn(() => true)
    renderHook(() => useBoilAlerts(boilSteps(), DUE, false, play))
    expect(play).not.toHaveBeenCalled()
    expect(document.title).toBe('BrewAtHome')
  })

  it('restaure le titre de l’onglet au démontage', () => {
    const play = vi.fn(() => true)
    const { unmount } = renderHook(() => useBoilAlerts(boilSteps(), DUE, true, play))
    expect(document.title).toBe('⏰ Houblon — BrewAtHome')
    unmount()
    expect(document.title).toBe('BrewAtHome')
  })
})
