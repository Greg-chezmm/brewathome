import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  resetBatchStep,
  toggleBatchStepItem,
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

  /**
   * Exécute une écriture ; renvoie false si elle a échoué (l'erreur est alors affichée).
   * `patch` est appliqué tout de suite au cache : l'écran réagit sans attendre l'écriture ni le rechargement
   * (parfois lents), et revient à l'état d'avant si l'écriture échoue.
   */
  async function run(action: () => Promise<void>, patch?: { stepId: string; changes: Partial<BatchStep> }): Promise<boolean> {
    setError(null)
    let previous: BatchStep[] | undefined
    if (patch) {
      // Un rechargement déjà en route renverrait l'état d'avant et effacerait la modification.
      await queryClient.cancelQueries({ queryKey: stepsKey })
      previous = queryClient.getQueryData<BatchStep[]>(stepsKey)
      queryClient.setQueryData<BatchStep[]>(stepsKey, (old) =>
        old?.map((s) => (s.id === patch.stepId ? { ...s, ...patch.changes } : s)),
      )
    }
    try {
      await action()
      return true
    } catch (err) {
      if (patch && previous) queryClient.setQueryData(stepsKey, previous)
      setError((err as Error).message)
      return false
    } finally {
      queryClient.invalidateQueries({ queryKey: stepsKey })
    }
  }

  function startStep(step: BatchStep) {
    const actualStartAt = new Date().toISOString()
    return run(() => updateBatchStepStatus(step.id, 'in-progress', { actualStartAt }), {
      stepId: step.id,
      changes: { status: 'in-progress', actualStartAt },
    })
  }

  async function completeStep(step: BatchStep) {
    const actualEndAt = new Date().toISOString()
    const saved = await run(() => updateBatchStepStatus(step.id, 'done', { actualEndAt }), {
      stepId: step.id,
      changes: { status: 'done', actualEndAt },
    })
    if (!saved) return
    document.title = 'BrewAtHome'
    onAdvance(step)
  }

  async function skipStep(step: BatchStep) {
    const saved = await run(() => updateBatchStepStatus(step.id, 'skipped'), {
      stepId: step.id,
      changes: { status: 'skipped' },
    })
    if (!saved) return
    onAdvance(step)
  }

  function resetStep(step: BatchStep) {
    onReset(step)
    document.title = 'BrewAtHome'
    return run(() => resetBatchStep(step.id), {
      stepId: step.id,
      changes: { status: 'todo', actualStartAt: null, actualEndAt: null },
    })
  }

  function toggleItem(step: BatchStep, itemId: string) {
    const checked = !step.checkedItems.includes(itemId)
    const checkedItems = checked ? [...step.checkedItems, itemId] : step.checkedItems.filter((id) => id !== itemId)
    // Mise à jour optimiste (appliquée par `run`, avec retour arrière en cas d'échec) : la case réagit
    // immédiatement. On n'envoie que la case touchée, la base fusionne avec ce que l'autre appareil a coché.
    return run(() => toggleBatchStepItem(step.id, itemId, checked).then(() => undefined), {
      stepId: step.id,
      changes: { checkedItems },
    })
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
