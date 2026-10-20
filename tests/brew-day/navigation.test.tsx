import { describe, expect, it } from 'vitest'
import {
  filterStepsBySession,
  initialActiveStep,
  nextUnfinishedStep,
  sessionFilterFromParam,
} from '@/lib/brew-day/navigation'
import type { BatchStep, BatchStepStatus } from '@/lib/db/queries/batches'

function step(id: string, status: BatchStepStatus = 'todo', session: number | null = null): BatchStep {
  return {
    id,
    stepType: 'mash',
    label: id,
    orderIndex: 0,
    plannedDurationMin: null,
    triggerTimeMin: null,
    status,
    actualStartAt: null,
    actualEndAt: null,
    checkedItems: [],
    session,
    notes: null,
  }
}

describe('sessionFilterFromParam', () => {
  it('retient une session valide quand le brassin en a plusieurs', () => {
    expect(sessionFilterFromParam('2', 2)).toBe(2)
  })

  it('ignore une session hors limites, absente ou non numérique', () => {
    expect(sessionFilterFromParam('3', 2)).toBeNull()
    expect(sessionFilterFromParam('0', 2)).toBeNull()
    expect(sessionFilterFromParam(null, 2)).toBeNull()
    expect(sessionFilterFromParam('abc', 2)).toBeNull()
  })

  it('ignore le paramètre pour un brassin à session unique', () => {
    expect(sessionFilterFromParam('1', 1)).toBeNull()
  })
})

describe('filterStepsBySession', () => {
  const steps = [step('commune'), step('s1', 'todo', 1), step('s2', 'todo', 2)]

  it('garde tout sans filtre', () => {
    expect(filterStepsBySession(steps, null)).toHaveLength(3)
  })

  it('garde les étapes de la session et les étapes communes', () => {
    expect(filterStepsBySession(steps, 2).map((s) => s.id)).toEqual(['commune', 's2'])
  })
})

describe('initialActiveStep', () => {
  it('prend la première étape pas encore faite', () => {
    expect(initialActiveStep([step('a', 'done'), step('b', 'skipped'), step('c'), step('d')])?.id).toBe('c')
  })

  it('prend la dernière quand tout est fini', () => {
    expect(initialActiveStep([step('a', 'done'), step('b', 'skipped')])?.id).toBe('b')
  })

  it('renvoie null sans étape', () => {
    expect(initialActiveStep([])).toBeNull()
  })
})

describe('nextUnfinishedStep', () => {
  it('saute les étapes finies ou passées', () => {
    const steps = [step('a'), step('b', 'done'), step('c', 'skipped'), step('d')]
    expect(nextUnfinishedStep(steps, steps[0])?.id).toBe('d')
  })

  it('préfère la même session avant les suivantes', () => {
    const steps = [step('a', 'todo', 1), step('b', 'todo', 2), step('c', 'todo', 1)]
    expect(nextUnfinishedStep(steps, steps[0])?.id).toBe('c')
  })

  it('renvoie null en fin de liste', () => {
    const steps = [step('a'), step('b', 'done')]
    expect(nextUnfinishedStep(steps, steps[0])).toBeNull()
  })
})
