import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  resetBatchStep,
  updateBatchStepChecklist,
  updateBatchStepNotes,
  updateBatchStepStatus,
  type BatchStep,
} from '@/lib/db/queries/batches'

interface StepActionsOptions {
  batchId: string | undefined
  /** Appelé après une étape terminée ou passée (et écrite avec succès) pour enchaîner sur la suivante. */
  onAdvance: (step: BatchStep) => void
  /** Appelé quand une étape est remise à zéro (ré-arme son alerte sonore). */
  onReset: (step: BatchStep) => void
}

/** Écritures de l'étape en cours (démarrer, terminer, passer, cocher, noter) et leur message d'erreur. */
export function useStepActions({ batchId, onAdvance, onReset }: StepActionsOptions) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const stepsKey = ['batch-steps', batchId]

  /** Exécute une écriture ; renvoie false si elle a échoué (l'erreur est alors affichée). */
  async function run(action: () => Promise<void>): Promise<boolean> {
    setError(null)
    try {
      await action()
      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    } finally {
      queryClient.invalidateQueries({ queryKey: stepsKey })
    }
  }

  function startStep(step: BatchStep) {
    return run(() => updateBatchStepStatus(step.id, 'in-progress', { actualStartAt: new Date().toISOString() }))
  }

  async function completeStep(step: BatchStep) {
    if (!(await run(() => updateBatchStepStatus(step.id, 'done', { actualEndAt: new Date().toISOString() })))) return
    document.title = 'BrewAtHome'
    onAdvance(step)
  }

  async function skipStep(step: BatchStep) {
    if (!(await run(() => updateBatchStepStatus(step.id, 'skipped')))) return
    onAdvance(step)
  }

  function resetStep(step: BatchStep) {
    onReset(step)
    document.title = 'BrewAtHome'
    return run(() => resetBatchStep(step.id))
  }

  function toggleItem(step: BatchStep, itemId: string) {
    const checkedItems = step.checkedItems.includes(itemId)
      ? step.checkedItems.filter((id) => id !== itemId)
      : [...step.checkedItems, itemId]
    // Mise à jour optimiste : la case réagit immédiatement, même avec un réseau lent.
    queryClient.setQueryData<BatchStep[]>(stepsKey, (old) =>
      old?.map((s) => (s.id === step.id ? { ...s, checkedItems } : s)),
    )
    return run(() => updateBatchStepChecklist(step.id, checkedItems))
  }

  function saveStepNotes(step: BatchStep, notes: string) {
    const value = notes.trim() === '' ? null : notes
    if (value === step.notes) return
    // Mise à jour optimiste : le refetch toutes les 5 s ne doit pas effacer la note tout juste saisie.
    queryClient.setQueryData<BatchStep[]>(stepsKey, (old) =>
      old?.map((s) => (s.id === step.id ? { ...s, notes: value } : s)),
    )
    return run(() => updateBatchStepNotes(step.id, value))
  }

  return { error, startStep, completeStep, skipStep, resetStep, toggleItem, saveStepNotes }
}
