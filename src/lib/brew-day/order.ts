import { isStepFinished, type BatchStep } from '@/lib/db/queries/batches'

/**
 * Première étape non terminée qui empêche de démarrer `step` (null si rien ne bloque) : on ne lance
 * pas l'ébullition pendant l'empâtage. En 2 sessions, une étape de session n'attend que sa propre
 * session et les étapes communes ; une étape commune attend toutes les sessions.
 */
export function startBlocker(steps: BatchStep[], step: BatchStep): BatchStep | null {
  return (
    steps
      .filter(
        (other) =>
          other.orderIndex < step.orderIndex &&
          !isStepFinished(other.status) &&
          (step.session == null || other.session == null || other.session === step.session),
      )
      .sort((a, b) => a.orderIndex - b.orderIndex)[0] ?? null
  )
}
