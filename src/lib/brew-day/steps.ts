import { calculateVolumes, SPARGE_WATER_TEMP_C } from '@/lib/brew-calc/volumes'
import type { EquipmentProfile } from '@/lib/brew-calc/types'
import type { BatchStep } from '@/lib/db/queries/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

export type NewBatchStep = Omit<BatchStep, 'id'>

/** Génère les étapes du Brew Day (empâtage, ébullition, ajouts, houblonnage à froid) d'une recette. */
export function buildBatchSteps(recipe: RecipeDetails, equipmentProfile: EquipmentProfile | null): NewBatchStep[] {
  const steps: NewBatchStep[] = []
  let order = 0

  const grainFermentables = recipe.fermentables.filter((f) => f.type === 'grain')
  const totalGrainKg = grainFermentables.reduce((sum, f) => sum + f.amountKg, 0)
  const grainList = grainFermentables.map((f) => `${f.amountKg} kg ${f.name}`).join(', ')
  const volumes = equipmentProfile ? calculateVolumes(recipe.targetVolumeL, totalGrainKg, equipmentProfile) : null

  steps.push({
    stepType: 'strike-water',
    label: volumes
      ? `Chauffer l'eau d'empâtage : ${volumes.mashWaterL.toFixed(1)} L`
      : "Chauffer l'eau d'empâtage",
    orderIndex: order++,
    plannedDurationMin: null,
    triggerTimeMin: null,
    status: 'todo',
    actualStartAt: null,
    actualEndAt: null,
  })

  steps.push({
    stepType: 'mash',
    label: grainList ? `Empâtage — ajouter le grain : ${grainList}` : 'Empâtage — ajouter le grain',
    orderIndex: order++,
    plannedDurationMin: 60,
    triggerTimeMin: null,
    status: 'todo',
    actualStartAt: null,
    actualEndAt: null,
  })

  if (volumes && volumes.spargeWaterL > 0) {
    steps.push({
      stepType: 'sparge-water',
      label: `Chauffer l'eau de rinçage : ${volumes.spargeWaterL.toFixed(1)} L @ ${SPARGE_WATER_TEMP_C} °C`,
      orderIndex: order++,
      plannedDurationMin: null,
      triggerTimeMin: null,
      status: 'todo',
      actualStartAt: null,
      actualEndAt: null,
    })
    steps.push({
      stepType: 'sparge',
      label: `Rinçage : ${volumes.spargeWaterL.toFixed(1)} L d'eau @ ${SPARGE_WATER_TEMP_C} °C`,
      orderIndex: order++,
      plannedDurationMin: null,
      triggerTimeMin: null,
      status: 'todo',
      actualStartAt: null,
      actualEndAt: null,
    })
  }

  steps.push({
    stepType: 'heat-to-boil',
    label: "Chauffer jusqu'à ébullition",
    orderIndex: order++,
    plannedDurationMin: null,
    triggerTimeMin: null,
    status: 'todo',
    actualStartAt: null,
    actualEndAt: null,
  })

  steps.push({
    stepType: 'boil',
    label: `Ébullition (${recipe.boilTimeMin} min)`,
    orderIndex: order++,
    plannedDurationMin: recipe.boilTimeMin,
    triggerTimeMin: null,
    status: 'todo',
    actualStartAt: null,
    actualEndAt: null,
  })

  const boilAdditions = [
    ...recipe.hops
      .filter((h) => h.use === 'boil' || h.use === 'first-wort')
      .map((h) => ({
        stepType: 'hop-addition' as const,
        label: `Ajout houblon : ${h.name} (${h.amountG} g)`,
        timeMin: h.timeMin,
      })),
    ...recipe.otherIngredients.map((o) => ({
      stepType: 'other-addition' as const,
      label: `Ajout : ${o.name} (${o.amount})`,
      timeMin: o.timeMin,
    })),
  ].sort((a, b) => b.timeMin - a.timeMin)
  for (const addition of boilAdditions) {
    steps.push({
      stepType: addition.stepType,
      label: addition.label,
      orderIndex: order++,
      plannedDurationMin: null,
      triggerTimeMin: addition.timeMin,
      status: 'todo',
      actualStartAt: null,
      actualEndAt: null,
    })
  }

  if (recipe.hops.some((h) => h.use === 'whirlpool')) {
    steps.push({
      stepType: 'whirlpool',
      label: 'Whirlpool',
      orderIndex: order++,
      plannedDurationMin: 15,
      triggerTimeMin: 0,
      status: 'todo',
      actualStartAt: null,
      actualEndAt: null,
    })
  }

  steps.push({
    stepType: 'cooling',
    label: 'Refroidissement',
    orderIndex: order++,
    plannedDurationMin: null,
    triggerTimeMin: null,
    status: 'todo',
    actualStartAt: null,
    actualEndAt: null,
  })

  const dryHops = recipe.hops.filter((h) => h.use === 'dry-hop')
  for (const hop of dryHops) {
    const days = hop.dryHopDays ?? 0
    steps.push({
      stepType: 'dry-hop-addition',
      label:
        hop.dryHopTempC != null
          ? `Houblonnage à froid : ${hop.name} (${hop.amountG} g) — ${days} j @ ${hop.dryHopTempC} °C`
          : `Houblonnage à froid : ${hop.name} (${hop.amountG} g) — ${days} j`,
      orderIndex: order++,
      plannedDurationMin: days * 24 * 60,
      triggerTimeMin: null,
      status: 'todo',
      actualStartAt: null,
      actualEndAt: null,
    })
  }

  return steps
}

/** Types d'étape présents au plus une fois par brassin : on les retrouve par type, même si leur libellé change. */
const SINGLE_STEP_TYPES: BatchStep['stepType'][] = [
  'strike-water',
  'mash',
  'sparge-water',
  'sparge',
  'heat-to-boil',
  'boil',
  'whirlpool',
  'cooling',
]

export interface BatchStepsUpdatePlan {
  /** Étapes 'todo' remplacées par la nouvelle génération. */
  deleteIds: string[]
  insert: NewBatchStep[]
  /** Étapes déjà commencées/terminées, conservées (statut et minuteurs intacts) mais renumérotées/mises à jour. */
  update: Pick<BatchStep, 'id' | 'label' | 'orderIndex' | 'plannedDurationMin' | 'triggerTimeMin'>[]
}

/**
 * Calcule comment aligner les étapes d'un brassin sur sa recette modifiée :
 * - les étapes encore 'todo' sont supprimées et régénérées depuis `fresh` ;
 * - les étapes commencées ou terminées sont gardées. Si la nouvelle recette contient
 *   la même étape (même type unique, ou même ajout = même libellé), elle prend ses
 *   nouvelles valeurs (ex. durée d'ébullition) ; sinon elle reste telle quelle, à sa place.
 */
export function planBatchStepsUpdate(existing: BatchStep[], fresh: NewBatchStep[]): BatchStepsUpdatePlan {
  const ordered = [...existing].sort((a, b) => a.orderIndex - b.orderIndex)
  const started = ordered.filter((s) => s.status !== 'todo')
  const deleteIds = ordered.filter((s) => s.status === 'todo').map((s) => s.id)

  const sameStep = (f: NewBatchStep, s: BatchStep) =>
    f.stepType === s.stepType && (SINGLE_STEP_TYPES.includes(s.stepType) || f.label === s.label)

  // Associe chaque étape commencée à une étape de la nouvelle génération (index dans `fresh`).
  const matchedFreshIndex = new Map<string, number>()
  const claimed = new Set<number>()
  for (const step of started) {
    const index = fresh.findIndex((f, i) => !claimed.has(i) && sameStep(f, step))
    if (index !== -1) {
      matchedFreshIndex.set(step.id, index)
      claimed.add(index)
    }
  }

  // Position des étapes commencées sans équivalent : juste après l'étape (quelle qu'elle soit) qui les précédait.
  type Entry = { position: number; step: NewBatchStep; id?: string }
  const entries: Entry[] = fresh.map((f, i) => {
    const keptId = [...matchedFreshIndex].find(([, index]) => index === i)?.[0]
    return { position: i, step: f, id: keptId }
  })
  let previousPosition = -1
  for (const step of ordered) {
    const index = matchedFreshIndex.get(step.id) ?? fresh.findIndex((f) => sameStep(f, step))
    if (index !== -1) {
      previousPosition = index
    } else if (step.status !== 'todo') {
      entries.push({ position: previousPosition + 0.5, step, id: step.id })
    }
  }
  entries.sort((a, b) => a.position - b.position)

  const insert: NewBatchStep[] = []
  const update: BatchStepsUpdatePlan['update'] = []
  entries.forEach((entry, orderIndex) => {
    if (entry.id) {
      update.push({
        id: entry.id,
        label: entry.step.label,
        orderIndex,
        plannedDurationMin: entry.step.plannedDurationMin,
        triggerTimeMin: entry.step.triggerTimeMin,
      })
    } else {
      insert.push({ ...entry.step, orderIndex })
    }
  })

  return { deleteIds, insert, update }
}
