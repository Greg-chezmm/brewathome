import { describe, expect, it } from 'vitest'
import { boilTiming, groupSteps } from '@/components/brew-day/stepMeta'
import { stepGuide } from '@/lib/brew-day/checklist'
import { batchSummary, plannedMeasurements, type MeasurementValues } from '@/lib/brew-day/measurements'
import {
  aggregateSessionMeasurements,
  blendedFermenter,
  clampBrewSessions,
  exceedsKettle,
  normalizeSessionMeasurements,
  sessionRecipe,
  sessionVolumes,
  type SessionMeasurements,
} from '@/lib/brew-day/sessions'
import { buildBatchSteps, planBatchStepsUpdate } from '@/lib/brew-day/steps'
import type { EquipmentProfile } from '@/lib/brew-calc/types'
import type { BatchStep } from '@/lib/db/queries/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

const recipe: RecipeDetails = {
  id: 'r1',
  name: 'Brune forte',
  status: 'validated',
  styleId: null,
  type: 'all-grain',
  targetVolumeL: 20,
  boilTimeMin: 60,
  mashEfficiencyPercent: 72,
  mashTempC: 66,
  mashSteps: [{ name: 'Saccharification', tempC: 66, timeMin: 60 }],
  ibuFormula: 'tinseth',
  equipmentProfileId: null,
  notes: null,
  estOg: 1.07,
  estFg: 1.016,
  estIbu: null,
  estSrm: null,
  estAbv: null,
  createdAt: '2026-01-01',
  fermentables: [
    { name: 'Pale', type: 'grain', amountKg: 6, colorLovibond: 3, yieldPercent: 80 },
    { name: 'Candi', type: 'sugar', amountKg: 0.4, colorLovibond: 1, yieldPercent: 100, use: 'boil' },
    { name: 'Sucre', type: 'sugar', amountKg: 0.2, colorLovibond: 0, yieldPercent: 100, use: 'fermentation' },
  ],
  hops: [
    { name: 'Magnum', amountG: 30, alphaAcidPercent: 12, timeMin: 60, use: 'boil' },
    { name: 'Citra', amountG: 50, alphaAcidPercent: 12, timeMin: 0, use: 'dry-hop', dryHopDays: 4 },
  ],
  yeasts: [{ name: 'US-05', type: 'dry', style: 'ale', attenuationPercent: 78 }],
  otherIngredients: [{ name: 'Whirlfloc', amount: '1 tablette', timeMin: 15 }],
}

const equipment: EquipmentProfile = {
  name: 'Marmite 20 L',
  boilKettleVolumeL: 20,
  mashTunVolumeL: null,
  targetBatchVolumeL: 10,
  boilTimeMin: 60,
  evaporationRateLPerHour: 2.88,
  grainAbsorptionLPerKg: 1,
  waterToGrainRatioLPerKg: 3,
  mashTunDeadspaceL: 0,
  hopAbsorptionL: 0.5,
  deadspaceL: 0,
  fermenterLossL: 0.7,
  thermalShrinkagePercent: 4,
  mashEfficiencyPercent: 75,
  hopUtilizationPercent: 100,
  method: 'biab',
}

const session = (values: Partial<SessionMeasurements>): SessionMeasurements => ({
  preBoilVolumeL: null,
  preBoilGravity: null,
  postBoilVolumeL: null,
  postBoilGravity: null,
  fermenterVolumeL: null,
  ...values,
})

function persisted(sessions: number): BatchStep[] {
  return buildBatchSteps(recipe, equipment, sessions).map((s, i) => ({ ...s, id: `s${i}`, checkedItems: [] }))
}

describe('Part de recette par session', () => {
  it('divise le côté chaud (grain, sucre et houblon d’ébullition, volume), pas la levure ni le fermenteur', () => {
    const part = sessionRecipe(recipe, 2)
    expect(part.targetVolumeL).toBe(10)
    expect(part.fermentables.map((f) => f.amountKg)).toEqual([3, 0.2, 0.2])
    expect(part.hops.map((h) => h.amountG)).toEqual([15, 50])
    expect(part.yeasts).toEqual(recipe.yeasts)
    expect(part.otherIngredients[0].amount).toBe('1 tablette ÷ 2')
  })

  it('une seule session : la recette telle quelle', () => {
    expect(sessionRecipe(recipe, 1)).toBe(recipe)
  })

  it('la recette déborde d’une cuve de 20 L, pas une session', () => {
    expect(exceedsKettle(recipe, equipment)).toBe(true)
    expect(sessionVolumes(recipe, 2, equipment)!.preBoilVolumeL).toBeLessThan(20)
    expect(exceedsKettle(recipe, null)).toBe(false)
  })

  it('borne le nombre de sessions', () => {
    expect(clampBrewSessions(undefined)).toBe(1)
    expect(clampBrewSessions(5)).toBe(2)
    expect(clampBrewSessions('2')).toBe(2)
  })
})

describe('Étapes en 2 sessions', () => {
  const steps = buildBatchSteps(recipe, equipment, 2)

  it('répète la partie chaude par session, préparation et ensemencement une seule fois', () => {
    const types = (session: number | null) => steps.filter((s) => s.session === session).map((s) => s.stepType)
    expect(types(null)).toEqual(['preparation', 'pitch', 'cleanup', 'fermentation-addition', 'dry-hop-addition'])
    expect(types(1)).toEqual(types(2))
    expect(types(1)[0]).toBe('strike-water')
    expect(types(1).at(-1)).toBe('cooling')
    // Session 1 entière, puis session 2, puis l'ensemencement.
    const order = steps.map((s) => s.session ?? 0)
    expect(order.indexOf(2)).toBeGreaterThan(order.lastIndexOf(1))
    expect(steps.findIndex((s) => s.stepType === 'pitch')).toBeGreaterThan(order.lastIndexOf(2))
  })

  it('chaque session a sa part d’ingrédients et transfère sa moitié du volume', () => {
    const labels = steps.filter((s) => s.session === 1).map((s) => s.label)
    expect(labels).toContain('Ajout houblon : Magnum (15 g)')
    expect(labels.find((l) => l.startsWith('Empâtage'))).toContain('3 kg Pale')
    expect(labels).toContain('Refroidissement sous 25 °C puis transfert au fermenteur (10.0 L)')
    expect(steps.find((s) => s.stepType === 'dry-hop-addition')!.label).toContain('50 g')
  })

  it('une session : pas de numéro de session, libellés inchangés', () => {
    const single = buildBatchSteps(recipe, equipment)
    expect(single.every((s) => s.session === null)).toBe(true)
    expect(single.find((s) => s.stepType === 'cooling')!.label).toBe('Refroidissement sous 25 °C')
  })

  it('régénération : une étape commencée reste rattachée à sa session', () => {
    const existing = persisted(2).map((s) =>
      s.stepType === 'boil' && s.session === 1 ? { ...s, status: 'in-progress' as const, actualStartAt: '2026-10-18T10:00:00Z' } : s,
    )
    const plan = planBatchStepsUpdate(existing, buildBatchSteps(recipe, equipment, 2))
    const boil1 = existing.find((s) => s.stepType === 'boil' && s.session === 1)!
    const boil1Order = plan.update.find((u) => u.id === boil1.id)!.orderIndex
    const fresh = buildBatchSteps(recipe, equipment, 2)
    expect(fresh[boil1Order]).toMatchObject({ stepType: 'boil', session: 1 })
    expect(plan.insert.filter((s) => s.stepType === 'boil')).toHaveLength(1)
  })
})

describe('Brew Day en 2 sessions', () => {
  const steps = persisted(2)

  it('une phase par session, dans l’ordre de la journée', () => {
    const labels = groupSteps(steps).map((g) => g.label)
    expect(labels[0]).toBe('Préparation')
    expect(labels).toContain('Session 1 · Empâtage')
    expect(labels.indexOf('Session 2 · Empâtage')).toBeGreaterThan(labels.indexOf('Session 1 · Refroidissement'))
    expect(labels.indexOf('Ensemencement')).toBeGreaterThan(labels.indexOf('Session 2 · Refroidissement'))
  })

  it('chaque ajout suit l’ébullition de sa session', () => {
    const now = Date.parse('2026-10-18T11:00:00Z')
    const started = steps.map((s) =>
      s.stepType === 'boil' && s.session === 2 ? { ...s, status: 'in-progress' as const, actualStartAt: '2026-10-18T10:00:00Z' } : s,
    )
    const magnum = (session: number) => started.find((s) => s.session === session && s.label.includes('Magnum'))!
    expect(boilTiming(started, magnum(2), now)).toMatchObject({ boilStarted: true, boilElapsedSeconds: 3600 })
    expect(boilTiming(started, magnum(2), now).timing.isDue).toBe(true)
    expect(boilTiming(started, magnum(1), now)).toMatchObject({ boilStarted: false, timing: { isDue: false } })
  })

  it('le refroidissement d’une session rappelle de verser son moût au fermenteur', () => {
    const cooling = steps.find((s) => s.stepType === 'cooling' && s.session === 1)!
    const guide = stepGuide(cooling, { recipe: sessionRecipe(recipe, 2), volumes: sessionVolumes(recipe, 2, equipment), method: 'biab', sessions: 2 })
    expect(guide.checklist.map((i) => i.label).join(' | ')).toContain('Transférer 10.0 L dans le fermenteur')
  })
})

describe('Mesures par session', () => {
  it('relit les mesures enregistrées, une entrée par session', () => {
    expect(normalizeSessionMeasurements([{ preBoilGravity: '1.050' }], 2)).toEqual([
      session({ preBoilGravity: 1.05 }),
      session({}),
    ])
    expect(normalizeSessionMeasurements(null, 1)).toEqual([session({})])
  })

  it('totaux du brassin : volumes additionnés, densités moyennées selon les volumes', () => {
    const totals = aggregateSessionMeasurements([
      session({ preBoilVolumeL: 12, preBoilGravity: 1.06, postBoilVolumeL: 10, postBoilGravity: 1.07 }),
      session({ preBoilVolumeL: 12, preBoilGravity: 1.05, postBoilVolumeL: 10.5, postBoilGravity: 1.06 }),
    ])
    expect(totals.preBoilVolumeL).toBe(24)
    expect(totals.preBoilGravity).toBeCloseTo(1.055, 4)
    expect(totals.postBoilVolumeL).toBe(20.5)
    expect(totals.postBoilGravity).toBeCloseTo(1 + (70 * 10 + 60 * 10.5) / 20.5 / 1000, 5)
  })

  it('pas de total tant qu’une session manque', () => {
    const totals = aggregateSessionMeasurements([session({ preBoilVolumeL: 12, preBoilGravity: 1.06 }), session({})])
    expect(totals).toEqual({ preBoilVolumeL: null, preBoilGravity: null, postBoilVolumeL: null, postBoilGravity: null })
  })

  it('DI du fermenteur : moyenne pondérée par les volumes versés, eau d’appoint comprise', () => {
    const sessions = [
      session({ postBoilGravity: 1.08, fermenterVolumeL: 10 }),
      session({ postBoilGravity: 1.06, fermenterVolumeL: 9 }),
    ]
    const blend = blendedFermenter(sessions, null)!
    expect(blend.volumeL).toBe(19)
    expect(blend.og).toBeCloseTo(1 + (80 * 10 + 60 * 9) / 19 / 1000, 5)
    const diluted = blendedFermenter(sessions, 1)!
    expect(diluted.volumeL).toBe(20)
    expect(diluted.og).toBeCloseTo(1 + (80 * 10 + 60 * 9) / 20 / 1000, 5)
    expect(blendedFermenter([sessions[0], session({})], null)).toBeNull()
  })

  it('prévu pour le brassin : volumes des 2 sessions additionnés, densités d’une session', () => {
    const whole = plannedMeasurements(recipe, equipment, 2)
    const part = plannedMeasurements(sessionRecipe(recipe, 2), equipment)
    expect(whole.preBoilVolumeL).toBeCloseTo(part.preBoilVolumeL! * 2, 6)
    expect(whole.preBoilGravity).toBeCloseTo(part.preBoilGravity!, 6)
    expect(whole.fermenterVolumeL).toBe(20)
  })

  it('résumé : évaporation horaire par session', () => {
    const measured = {
      ...Object.fromEntries(Object.keys(plannedMeasurements(recipe, equipment)).map((k) => [k, null])),
      preBoilVolumeL: 24,
      postBoilVolumeL: 18,
    } as MeasurementValues
    const evaporation = batchSummary(recipe, equipment, measured, 2).find((r) => r.label === 'Évaporation par heure')!
    expect(evaporation.actual).toBeCloseTo(3, 6)
  })
})
