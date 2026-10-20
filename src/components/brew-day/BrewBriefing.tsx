import { useState } from 'react'
import { buildBriefing, formatBriefingDuration } from '@/lib/brew-day/briefing'
import type { BatchStep } from '@/lib/db/queries/batches'

/** « Avant de commencer » : durée, matériel et sécurité. Affichée tant que rien n'est démarré, masquable. */
export function BrewBriefing({ steps }: { steps: BatchStep[] }) {
  const [hidden, setHidden] = useState(false)
  if (hidden || steps.some((s) => s.status !== 'todo')) return null
  const { totalMinutes, equipment, safety } = buildBriefing(steps)

  return (
    <section aria-label="Avant de commencer" className="space-y-3 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
      <h2 className="text-base font-bold">Avant de commencer</h2>
      <p>
        Comptez environ <strong>{formatBriefingDuration(totalMinutes)}</strong> de brassage, hors installation et nettoyage.
      </p>
      <div>
        <p className="font-semibold">À préparer</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {equipment.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-semibold">Sécurité</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          {safety.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <button type="button" onClick={() => setHidden(true)} className="btn-secondary">
        J’ai compris, masquer
      </button>
    </section>
  )
}
