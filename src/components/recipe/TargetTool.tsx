import { useState } from 'react'
import { Crosshair } from 'lucide-react'

export interface TargetFeedback {
  text: string
  warn?: boolean
}

/**
 * Petit outil « Viser une valeur » d'une section d'ingrédients : on saisit la cible,
 * le formulaire ajuste les quantités et l'outil affiche ce qui a changé.
 */
export function TargetTool({
  label,
  inputLabel,
  step,
  decimals,
  current,
  description,
  disabledReason,
  onApply,
}: {
  label: string
  inputLabel: string
  step: string
  decimals: number
  /** Valeur actuelle de la recette : proposée comme point de départ. */
  current: number
  /** Ce que l'outil va modifier (affiché avant d'appliquer). */
  description: string
  /** Outil indisponible (ex. aucun houblon d'ébullition) : la raison remplace le formulaire. */
  disabledReason?: string
  onApply: (target: number) => TargetFeedback
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [feedback, setFeedback] = useState<TargetFeedback | null>(null)

  function start() {
    setDraft(Number.isFinite(current) ? current.toFixed(decimals) : '')
    setFeedback(null)
    setOpen(true)
  }

  function apply() {
    const target = Number.parseFloat(draft.replace(',', '.'))
    if (!Number.isFinite(target)) {
      setFeedback({ text: 'Saisissez une valeur.', warn: true })
      return
    }
    setFeedback(onApply(target))
    setOpen(false)
  }

  if (!open) {
    return (
      <div className="space-y-1">
        <button type="button" onClick={start} className="btn-secondary btn-sm">
          <Crosshair size={14} />
          {label}
        </button>
        {feedback && <Feedback feedback={feedback} />}
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
      {disabledReason ? (
        <p className="text-sm text-slate-600">{disabledReason}</p>
      ) : (
        <>
          <p className="text-xs text-slate-600">{description}</p>
          <div className="flex items-end gap-2">
            <label className="block min-w-0 flex-1">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{inputLabel}</span>
              <input
                type="number"
                inputMode="decimal"
                step={step}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Entrée applique l'outil au lieu d'enregistrer la recette.
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    apply()
                  }
                }}
                autoFocus
                className="field-input tabular-nums"
              />
            </label>
            <button type="button" onClick={apply} className="btn-primary btn-sm">
              Appliquer
            </button>
          </div>
        </>
      )}
      {feedback && <Feedback feedback={feedback} />}
      <button type="button" onClick={() => setOpen(false)} className="text-xs font-medium text-slate-500 underline">
        {disabledReason ? 'Fermer' : 'Annuler'}
      </button>
    </div>
  )
}

function Feedback({ feedback }: { feedback: TargetFeedback }) {
  return <p className={`text-xs ${feedback.warn ? 'text-orange-700' : 'text-green-700'}`}>{feedback.text}</p>
}
