import { effectiveMashSteps, isMashOut, type MashStep } from '@/lib/brew-calc/mash'
import { REFERENCE_MASH_TEMP_C } from '@/lib/brew-calc/recipe-stats'
import { fermentableUse } from '@/lib/brew-calc/gravity'
import { calculateStrikeWaterTempC, calculateVolumes, SPARGE_WATER_TEMP_C } from '@/lib/brew-calc/volumes'
import type { EquipmentProfile } from '@/lib/brew-calc/types'
import { formatWeightKg } from '@/lib/brew-calc/units'
import type { BatchStep } from '@/lib/db/queries/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'
import { sessionRecipe } from './sessions'

export type NewBatchStep = Omit<BatchStep, 'id' | 'checkedItems' | 'notes'>

/** Température de l'eau d'empâtage pour atteindre `mashTempC` une fois le grain (à 20 °C) ajouté. */
export function strikeWaterTempFor(mashTempC: number, totalGrainKg: number, mashWaterL: number | undefined): number | null {
  if (!mashWaterL || totalGrainKg <= 0) return null
  return calculateStrikeWaterTempC(mashTempC, GRAIN_TEMP_C, mashWaterL / totalGrainKg)
}

/** Température du grain supposée (pièce), pour le calcul de l'eau d'empâtage. */
export const GRAIN_TEMP_C = 20

export { MASH_OUT_TEMP_C } from '@/lib/brew-calc/mash'

/** Libellé d'un palier intermédiaire : c'est par lui que le guide du Brew Day retrouve le palier. */
export function mashStepLabel(step: MashStep): string {
  return `Palier « ${step.name} » : ${step.tempC} °C pendant ${step.timeMin} min`
}

/** Température du premier palier : c'est elle que doit atteindre l'eau d'empâtage une fois le grain versé. */
export function firstMashTempC(recipe: Pick<RecipeDetails, 'mashSteps' | 'mashTempC'>): number {
  return effectiveMashSteps(recipe)[0]?.tempC ?? REFERENCE_MASH_TEMP_C
}

/** Sucres ajoutés à l'ébullition : 10 min avant la fin, juste de quoi les dissoudre et les stériliser. */
export const BOIL_SUGAR_MIN = 10

/** Le serpentin plonge dans l'ébullition à 15 min de la fin : assez pour le désinfecter. */
export const CHILLER_SANITIZE_MIN = 15

/**
 * Génère les étapes du Brew Day d'une recette, dans l'ordre de la journée :
 * préparation → empâtage → filtration/rinçage → ébullition → refroidissement
 * → ensemencement → rangement, puis houblonnage à froid (les jours suivants).
 * En plusieurs sessions (`sessions` > 1), la partie chaude (empâtage → refroidissement) est répétée
 * pour chaque session avec sa part de la recette, les étapes portant leur numéro de session ;
 * préparation, ensemencement, rangement et ajouts en fermentation restent communs.
 */
export function buildBatchSteps(recipe: RecipeDetails, equipmentProfile: EquipmentProfile | null, sessions = 1): NewBatchStep[] {
  const steps: NewBatchStep[] = []
  let session: number | null = null
  const add: AddStep = (step) =>
    steps.push({
      plannedDurationMin: null,
      triggerTimeMin: null,
      status: 'todo',
      actualStartAt: null,
      actualEndAt: null,
      session,
      ...step,
      orderIndex: steps.length,
    })

  add({ stepType: 'preparation', label: 'Préparation : nettoyage, concassage, eau' })

  const part = sessionRecipe(recipe, sessions)
  for (let n = 1; n <= sessions; n++) {
    session = sessions > 1 ? n : null
    addHotSideSteps(part, equipmentProfile, add, sessions > 1)
  }
  session = null

  add({ stepType: 'pitch', label: recipe.yeasts[0] ? `Ensemencement : ${recipe.yeasts[0].name}` : 'Ensemencement' })
  add({ stepType: 'cleanup', label: 'Rangement et nettoyage' })

  for (const f of recipe.fermentables.filter((f) => fermentableUse(f) === 'fermentation')) {
    add({ stepType: 'fermentation-addition', label: `Ajout en fermentation : ${f.name} (${formatWeightKg(f.amountKg)})` })
  }

  for (const hop of recipe.hops.filter((h) => h.use === 'dry-hop')) {
    const days = hop.dryHopDays ?? 0
    // Le jour n'apparaît que s'il est fixé dans la recette (les anciens libellés restent identiques).
    const day = hop.dryHopDay != null ? ` au jour ${hop.dryHopDay}` : ''
    add({
      stepType: 'dry-hop-addition',
      label:
        hop.dryHopTempC != null
          ? `Houblonnage à froid${day} : ${hop.name} (${hop.amountG} g) — ${days} j @ ${hop.dryHopTempC} °C`
          : `Houblonnage à froid${day} : ${hop.name} (${hop.amountG} g) — ${days} j`,
      plannedDurationMin: days * 24 * 60,
    })
  }

  return steps
}

type AddStep = (step: Pick<NewBatchStep, 'stepType' | 'label'> & Partial<NewBatchStep>) => void

/** Partie chaude d'une session : eau d'empâtage → paliers → rinçage → ébullition et ajouts → refroidissement. */
function addHotSideSteps(
  recipe: RecipeDetails,
  equipmentProfile: EquipmentProfile | null,
  add: AddStep,
  transferToFermenter: boolean,
) {
  // Le grain ajouté ailleurs qu'à l'empâtage (rare) n'absorbe pas d'eau de maische : seul celui de l'empâtage compte.
  const mashFermentables = recipe.fermentables.filter((f) => fermentableUse(f) === 'mash')
  const grainFermentables = mashFermentables.filter((f) => f.type === 'grain')
  const totalGrainKg = grainFermentables.reduce((sum, f) => sum + f.amountKg, 0)
  const grainList = mashFermentables.map((f) => `${formatWeightKg(f.amountKg)} ${f.name}`).join(', ')
  const volumes = equipmentProfile ? calculateVolumes(recipe.targetVolumeL, totalGrainKg, recipe.boilTimeMin, equipmentProfile) : null
  const mashSteps = effectiveMashSteps(recipe)
  const strikeTempC = strikeWaterTempFor(firstMashTempC(recipe), totalGrainKg, volumes?.mashWaterL)

  add({
    stepType: 'strike-water',
    label: volumes
      ? `Chauffer l'eau d'empâtage : ${volumes.mashWaterL.toFixed(1)} L${strikeTempC !== null ? ` à ${strikeTempC.toFixed(0)} °C` : ''}`
      : "Chauffer l'eau d'empâtage",
  })
  // Un palier = une étape minutée : le premier reçoit le grain, le dernier (s'il est chaud) est le mash-out.
  mashSteps.forEach((mashStep, i) => {
    if (i === 0) {
      add({
        stepType: 'mash',
        label: grainList ? `Empâtage à ${mashStep.tempC} °C — ajouter le grain : ${grainList}` : `Empâtage à ${mashStep.tempC} °C`,
        plannedDurationMin: mashStep.timeMin,
      })
    } else if (isMashOut(mashSteps, i)) {
      add({ stepType: 'mash-out', label: `Mash-out à ${mashStep.tempC} °C`, plannedDurationMin: mashStep.timeMin })
    } else {
      add({ stepType: 'mash-step', label: mashStepLabel(mashStep), plannedDurationMin: mashStep.timeMin })
    }
  })

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
    // Extrait dès le début de l'ébullition ; sucres (candi, miel…) en fin d'ébullition, pour ne pas les caraméliser.
    ...recipe.fermentables
      .filter((f) => fermentableUse(f) === 'boil')
      .map((f) => ({
        stepType: 'other-addition' as const,
        label: `Ajout : ${f.name} (${formatWeightKg(f.amountKg)})`,
        timeMin: f.type === 'extract' ? recipe.boilTimeMin : Math.min(BOIL_SUGAR_MIN, recipe.boilTimeMin),
      })),
    ...recipe.otherIngredients.map((o) => ({
      stepType: 'other-addition' as const,
      label: `Ajout : ${o.name} (${o.amount})`,
      timeMin: o.timeMin,
    })),
    // Le serpentin se désinfecte dans le moût bouillant, juste avant la fin (après un ajout au même moment).
    {
      stepType: 'chiller-sanitize' as const,
      label: 'Plonger le serpentin pour le désinfecter',
      timeMin: Math.min(CHILLER_SANITIZE_MIN, recipe.boilTimeMin),
    },
  ].sort((a, b) => b.timeMin - a.timeMin)
  for (const addition of boilAdditions) {
    add({ stepType: addition.stepType, label: addition.label, triggerTimeMin: addition.timeMin })
  }

  if (recipe.hops.some((h) => h.use === 'whirlpool')) {
    add({ stepType: 'whirlpool', label: 'Whirlpool / hopstand', plannedDurationMin: 15, triggerTimeMin: 0 })
  }

  add({
    stepType: 'cooling',
    label: transferToFermenter
      ? `Refroidissement sous 25 °C puis transfert au fermenteur (${recipe.targetVolumeL.toFixed(1)} L)`
      : 'Refroidissement sous 25 °C',
  })
}

/** Types d'étape présents au plus une fois par brassin (par session) : on les retrouve par type, même si leur libellé change. */
const SINGLE_STEP_TYPES: BatchStep['stepType'][] = [
  'preparation',
  'strike-water',
  'mash',
  'mash-out',
  'sparge-water',
  'sparge',
  'heat-to-boil',
  'boil',
  'chiller-sanitize',
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
    f.stepType === s.stepType &&
    (f.session ?? null) === (s.session ?? null) &&
    (SINGLE_STEP_TYPES.includes(s.stepType) || f.label === s.label)

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
