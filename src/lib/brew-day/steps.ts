import { REFERENCE_MASH_TEMP_C } from '@/lib/brew-calc/recipe-stats'
import { calculateStrikeWaterTempC, calculateVolumes, SPARGE_WATER_TEMP_C } from '@/lib/brew-calc/volumes'
import type { EquipmentProfile } from '@/lib/brew-calc/types'
import type { BatchStep } from '@/lib/db/queries/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

export type NewBatchStep = Omit<BatchStep, 'id' | 'checkedItems'>

/** Température de l'eau d'empâtage pour atteindre `mashTempC` une fois le grain (à 20 °C) ajouté. */
export function strikeWaterTempFor(mashTempC: number, totalGrainKg: number, mashWaterL: number | undefined): number | null {
  if (!mashWaterL || totalGrainKg <= 0) return null
  return calculateStrikeWaterTempC(mashTempC, GRAIN_TEMP_C, mashWaterL / totalGrainKg)
}

/** Température du grain supposée (pièce), pour le calcul de l'eau d'empâtage. */
export const GRAIN_TEMP_C = 20

/** Température du mash-out : bloque les enzymes et fluidifie le moût avant filtration. */
export const MASH_OUT_TEMP_C = 76

/**
 * Génère les étapes du Brew Day d'une recette, dans l'ordre de la journée :
 * préparation → empâtage → filtration/rinçage → ébullition → refroidissement
 * → ensemencement → rangement, puis houblonnage à froid (les jours suivants).
 */
export function buildBatchSteps(recipe: RecipeDetails, equipmentProfile: EquipmentProfile | null): NewBatchStep[] {
  const steps: NewBatchStep[] = []
  const add = (step: Pick<NewBatchStep, 'stepType' | 'label'> & Partial<NewBatchStep>) =>
    steps.push({
      plannedDurationMin: null,
      triggerTimeMin: null,
      status: 'todo',
      actualStartAt: null,
      actualEndAt: null,
      ...step,
      orderIndex: steps.length,
    })

  const grainFermentables = recipe.fermentables.filter((f) => f.type === 'grain')
  const totalGrainKg = grainFermentables.reduce((sum, f) => sum + f.amountKg, 0)
  const grainList = grainFermentables.map((f) => `${f.amountKg} kg ${f.name}`).join(', ')
  const volumes = equipmentProfile ? calculateVolumes(recipe.targetVolumeL, totalGrainKg, equipmentProfile) : null
  const mashTempC = recipe.mashTempC ?? REFERENCE_MASH_TEMP_C
  const strikeTempC = strikeWaterTempFor(mashTempC, totalGrainKg, volumes?.mashWaterL)

  add({ stepType: 'preparation', label: 'Préparation : nettoyage, concassage, eau' })

  add({
    stepType: 'strike-water',
    label: volumes
      ? `Chauffer l'eau d'empâtage : ${volumes.mashWaterL.toFixed(1)} L${strikeTempC !== null ? ` à ${strikeTempC.toFixed(0)} °C` : ''}`
      : "Chauffer l'eau d'empâtage",
  })
  add({
    stepType: 'mash',
    label: grainList ? `Empâtage à ${mashTempC} °C — ajouter le grain : ${grainList}` : `Empâtage à ${mashTempC} °C`,
    plannedDurationMin: 60,
  })
  add({ stepType: 'mash-out', label: `Mash-out à ${MASH_OUT_TEMP_C} °C`, plannedDurationMin: 10 })

  if (volumes && volumes.spargeWaterL > 0) {
    add({
      stepType: 'sparge-water',
      label: `Chauffer l'eau de rinçage : ${volumes.spargeWaterL.toFixed(1)} L @ ${SPARGE_WATER_TEMP_C} °C`,
    })
    add({
      stepType: 'sparge',
      label: `Filtration et rinçage : ${volumes.spargeWaterL.toFixed(1)} L d'eau @ ${SPARGE_WATER_TEMP_C} °C`,
    })
  }

  add({ stepType: 'heat-to-boil', label: "Chauffer jusqu'à ébullition" })
  add({ stepType: 'boil', label: `Ébullition (${recipe.boilTimeMin} min)`, plannedDurationMin: recipe.boilTimeMin })

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
    add({ stepType: addition.stepType, label: addition.label, triggerTimeMin: addition.timeMin })
  }

  if (recipe.hops.some((h) => h.use === 'whirlpool')) {
    add({ stepType: 'whirlpool', label: 'Whirlpool / hopstand', plannedDurationMin: 15, triggerTimeMin: 0 })
  }

  add({ stepType: 'cooling', label: 'Refroidissement sous 25 °C' })
  add({ stepType: 'pitch', label: recipe.yeasts[0] ? `Ensemencement : ${recipe.yeasts[0].name}` : 'Ensemencement' })
  add({ stepType: 'cleanup', label: 'Rangement et nettoyage' })

  for (const hop of recipe.hops.filter((h) => h.use === 'dry-hop')) {
    const days = hop.dryHopDays ?? 0
    add({
      stepType: 'dry-hop-addition',
      label:
        hop.dryHopTempC != null
          ? `Houblonnage à froid : ${hop.name} (${hop.amountG} g) — ${days} j @ ${hop.dryHopTempC} °C`
          : `Houblonnage à froid : ${hop.name} (${hop.amountG} g) — ${days} j`,
      plannedDurationMin: days * 24 * 60,
    })
  }

  return steps
}

/** Types d'étape présents au plus une fois par brassin : on les retrouve par type, même si leur libellé change. */
const SINGLE_STEP_TYPES: BatchStep['stepType'][] = [
  'preparation',
  'strike-water',
  'mash',
  'mash-out',
  'sparge-water',
  'sparge',
  'heat-to-boil',
  'boil',
  'whirlpool',
  'cooling',
  'pitch',
  'cleanup',
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
