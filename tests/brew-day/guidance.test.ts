import { describe, expect, it } from 'vitest'
import { glossaryFor } from '@/lib/brew-day/glossary'
import { buildBriefing, formatBriefingDuration } from '@/lib/brew-day/briefing'
import type { BatchStep, BatchStepType } from '@/lib/db/queries/batches'

function step(stepType: BatchStepType, over: Partial<BatchStep> = {}): BatchStep {
  return {
    id: stepType,
    stepType,
    label: stepType,
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
  }
}

describe('glossaryFor', () => {
  it('repère les termes sans tenir compte des accents ni de la casse', () => {
    const terms = glossaryFor(['Ébullition', 'Ajouter le Whirlpool'])
    expect(terms.map((t) => t.term)).toEqual(['Ébullition', 'Whirlpool / hopstand'])
  })

  it('ne renvoie rien quand aucun terme du métier ne figure dans le texte', () => {
    expect(glossaryFor(['Nettoyer le plan de travail'])).toEqual([])
  })
})

describe('buildBriefing', () => {
  it('additionne les durées prévues, sans les ajouts calés sur l’ébullition ni les étapes passées', () => {
    const steps = [
      step('mash', { plannedDurationMin: 60 }),
      step('boil', { plannedDurationMin: 60 }),
      step('hop-addition', { plannedDurationMin: 5, triggerTimeMin: 15 }),
      step('mash-out', { plannedDurationMin: 10, status: 'skipped' }),
    ]
    expect(buildBriefing(steps).totalMinutes).toBe(120)
  })

  it('estime la durée des étapes sans minuteur (chauffe, rinçage, refroidissement) mais pas le nettoyage', () => {
    const steps = [
      step('strike-water'),
      step('mash', { plannedDurationMin: 60 }),
      step('sparge-water'),
      step('sparge'),
      step('heat-to-boil'),
      step('boil', { plannedDurationMin: 60 }),
      step('cooling'),
      step('pitch'),
      step('cleanup'),
    ]
    expect(buildBriefing(steps).totalMinutes).toBe(25 + 60 + 25 + 25 + 60 + 30 + 10)
  })

  it('ajoute le matériel propre aux étapes présentes et rappelle les risques de brûlure et de débordement', () => {
    const briefing = buildBriefing([step('sparge'), step('dry-hop-addition')])
    expect(briefing.equipment.some((e) => /rinçage/.test(e))).toBe(true)
    expect(briefing.equipment.some((e) => /dry hop/.test(e))).toBe(true)
    expect(briefing.safety.join(' ')).toMatch(/Brûlures/)
    expect(briefing.safety.join(' ')).toMatch(/boil-over/)
  })
})

describe('formatBriefingDuration', () => {
  it('formate heures et minutes', () => {
    expect(formatBriefingDuration(270)).toBe('4 h 30')
    expect(formatBriefingDuration(120)).toBe('2 h')
    expect(formatBriefingDuration(45)).toBe('45 min')
  })
})
