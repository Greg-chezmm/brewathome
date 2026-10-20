import { MeasurementsPanel } from '@/components/batches/MeasurementsPanel'
import type { EquipmentProfile } from '@/lib/brew-calc/types'
import { derivedOg, type MeasurementKey, type MeasurementValues } from '@/lib/brew-day/measurements'
import {
  blendedFermenter,
  SESSION_MEASUREMENT_LABELS,
  type SessionMeasurementKey,
} from '@/lib/brew-day/sessions'
import {
  updateBatchSessionMeasurements,
  type BatchDetails,
  type BatchStep,
  type BatchStepType,
} from '@/lib/db/queries/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

/** Mesures à relever à chaque étape (comme dans Brewfather), comparées aux valeurs de la recette. */
const STEP_MEASUREMENTS: Partial<Record<BatchStepType, MeasurementKey[]>> = {
  mash: ['mashPh', 'mashTempReachedC'],
  'heat-to-boil': ['preBoilVolumeL', 'preBoilGravity'],
  cooling: ['postBoilVolumeL', 'postBoilGravity'],
  pitch: ['fermenterTopUpL', 'fermenterVolumeL', 'og'],
}

/** Brassin en plusieurs sessions : mesures propres à chaque session (le volume versé au fermenteur en plus). */
const SESSION_STEP_MEASUREMENTS: Partial<Record<BatchStepType, SessionMeasurementKey[]>> = {
  'heat-to-boil': ['preBoilVolumeL', 'preBoilGravity'],
  cooling: ['postBoilVolumeL', 'postBoilGravity', 'fermenterVolumeL'],
}

interface StepMeasurementsProps {
  batch: BatchDetails
  step: BatchStep
  /** Recette entière du brassin. */
  recipe: RecipeDetails
  /** Part de recette d'une session. */
  part: RecipeDetails
  planned: MeasurementValues | null
  plannedSession: MeasurementValues | null
  equipment: EquipmentProfile | null | undefined
  brewSessions: number
}

/** Panneau de mesures de l'étape affichée ; rien si l'étape n'a pas de mesure à relever. */
export function StepMeasurements({ batch, step, recipe, part, planned, plannedSession, equipment, brewSessions }: StepMeasurementsProps) {
  const sessionFields = step.session != null ? SESSION_STEP_MEASUREMENTS[step.stepType] : undefined
  const batchFields = !sessionFields ? STEP_MEASUREMENTS[step.stepType] : undefined

  if (step.session != null && sessionFields && plannedSession) {
    const sessionIndex = step.session - 1
    return (
      <MeasurementsPanel
        batchId={batch.id}
        fields={sessionFields}
        measured={{ ...batch.measurements, ...batch.sessionMeasurements[sessionIndex] }}
        planned={plannedSession}
        recipe={part}
        equipment={equipment}
        labels={SESSION_MEASUREMENT_LABELS}
        title={`Mesures de la session ${step.session}`}
        onSave={(changes) => updateBatchSessionMeasurements(batch.id, sessionIndex, changes)}
      />
    )
  }

  if (batchFields && planned) {
    return (
      <MeasurementsPanel
        batchId={batch.id}
        fields={batchFields}
        measured={batch.measurements}
        planned={planned}
        recipe={recipe}
        equipment={equipment}
        title="Mesures de l'étape"
        suggestions={step.stepType === 'pitch' ? pitchSuggestions(batch, brewSessions) : undefined}
      />
    )
  }

  return null
}

/**
 * DI et volume proposés à l'ensemencement : mélange des sessions s'il y en a plusieurs ; sinon DI déduite
 * de la densité de fin d'ébullition (et de l'appoint d'eau enregistré), jamais si la DI est déjà saisie.
 */
function pitchSuggestions(batch: BatchDetails, brewSessions: number) {
  const blend = brewSessions > 1 ? blendedFermenter(batch.sessionMeasurements, batch.measurements.fermenterTopUpL) : null
  if (blend) {
    return {
      og: { value: blend.og, label: 'Mélange des sessions' },
      fermenterVolumeL: { value: blend.volumeL, label: 'Versé par les sessions' },
    }
  }
  const { og, postBoilGravity, fermenterVolumeL, fermenterTopUpL } = batch.measurements
  if (og != null) return undefined
  const endOfBoilOg = derivedOg(postBoilGravity, fermenterVolumeL, fermenterTopUpL)
  if (endOfBoilOg == null) return undefined
  return { og: { value: endOfBoilOg, label: (fermenterTopUpL ?? 0) > 0 ? "Fin d'ébullition, avec appoint" : "Fin d'ébullition" } }
}
