import { useEffect, useRef } from 'react'
import { boilTiming } from '@/components/brew-day/stepMeta'
import type { BatchStep } from '@/lib/db/queries/batches'

/**
 * Alerte sonore (et titre de l'onglet) quand un ajout de l'ébullition arrive à échéance.
 * Toutes les sessions comptent, même celles d'un autre onglet : un ajout oublié coûte plus qu'un bip en double.
 * Renvoie `forget(stepId)` pour ré-armer l'alerte d'une étape remise à zéro.
 */
export function useBoilAlerts(steps: BatchStep[] | undefined, now: number, enabled: boolean, play: () => void) {
  const alertedStepIds = useRef(new Set<string>())

  useEffect(() => {
    if (!enabled || !steps) return
    for (const step of steps) {
      if (boilTiming(steps, step, now).timing.isDue && !alertedStepIds.current.has(step.id)) {
        alertedStepIds.current.add(step.id)
        play()
        document.title = `⏰ ${step.label} — BrewAtHome`
      }
    }
  }, [now, steps, enabled, play])

  return { forget: (stepId: string) => alertedStepIds.current.delete(stepId) }
}
