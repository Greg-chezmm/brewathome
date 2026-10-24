import { useState } from 'react'
import { CalendarPlus, Download } from 'lucide-react'
import type { FermentationStep } from '@/lib/brew-calc/fermentation-profile'
import { fermentableUse } from '@/lib/brew-calc/gravity'
import type { Fermentable, Hop, OtherIngredient } from '@/lib/brew-calc/types'
import {
  DEFAULT_FERMENTATION_ADDITION_DAY,
  DEFAULT_REMINDER_TIME,
  fermentationReminders,
  googleCalendarUrl,
  remindersToIcs,
} from '@/lib/fermentation/reminders'

const formatDate = (t: number) =>
  new Date(t).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Nom de fichier sans caractères gênants : « brune-forte-rappels.ics ». */
function fileName(batchName: string): string {
  const slug = batchName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${slug || 'brassin'}-rappels.ics`
}

/**
 * Rappels de la fermentation à mettre dans son agenda (ajouts, dry hops, changements de
 * température, fin) : fichier .ics pour tout ajouter d'un coup, ou un lien Google Agenda par rappel.
 * C'est l'agenda du téléphone qui notifie, sans serveur.
 */
export function FermentationReminders({
  batch,
  steps,
  hops,
  fermentables,
  otherIngredients,
  start,
  now,
}: {
  batch: { id: string; name: string }
  steps: FermentationStep[]
  hops: Hop[]
  fermentables: Fermentable[]
  otherIngredients?: OtherIngredient[]
  /** Début de la fermentation (ms) ; null si rien ne permet de le dater. */
  start: number | null
  now: number
}) {
  const [time, setTime] = useState(DEFAULT_REMINDER_TIME)
  const [additionDays, setAdditionDays] = useState<Record<string, number>>({})
  const additions = fermentables.filter((f) => fermentableUse(f) === 'fermentation')

  if (start === null) {
    return (
      <section className="card" aria-label="Rappels dans l'agenda">
        <h2 className="section-title">Rappels dans l'agenda</h2>
        <p className="mt-1 text-sm text-slate-500">
          Renseignez la date de brassage (ou terminez l'ensemencement au Brew Day) pour dater les rappels.
        </p>
      </section>
    )
  }

  const upcoming = fermentationReminders({ steps, hops, fermentables, otherIngredients, start, additionDays, time }).filter((r) => r.time > now)

  function download() {
    const blob = new Blob([remindersToIcs(upcoming, batch)], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName(batch.name)
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <section className="card space-y-3" aria-label="Rappels dans l'agenda">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="section-title">Rappels dans l'agenda</h2>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Heure des rappels
          <input type="time" value={time} onChange={(e) => setTime(e.target.value || DEFAULT_REMINDER_TIME)} className="field-input w-28" />
        </label>
      </div>

      {additions.length > 0 && (
        <div className="space-y-1.5 text-sm">
          {additions.map((f) => (
            <label key={f.name} className="flex flex-wrap items-center gap-2 text-slate-700">
              Ajout de {f.name} au jour
              <input
                type="number"
                min={0}
                max={60}
                value={additionDays[f.name] ?? DEFAULT_FERMENTATION_ADDITION_DAY}
                onChange={(e) => {
                  const day = Number.parseInt(e.target.value, 10)
                  if (Number.isFinite(day) && day >= 0) setAdditionDays({ ...additionDays, [f.name]: day })
                }}
                className="field-input w-20"
                aria-label={`Jour d'ajout de ${f.name}`}
              />
              <span className="text-xs text-slate-500">après le pic de fermentation, quand la mousse retombe</span>
            </label>
          ))}
        </div>
      )}

      {upcoming.length === 0 ? (
        <p className="text-sm text-slate-500">Plus aucun rappel à venir pour ce brassin.</p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 text-sm">
            {upcoming.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                <span className="min-w-0">
                  <span className="block text-slate-800">{r.title}</span>
                  <span className="block text-xs text-slate-500">
                    {formatDate(r.time)} · jour {r.day}
                  </span>
                </span>
                <a
                  href={googleCalendarUrl(r, batch.name)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex shrink-0 items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                >
                  <CalendarPlus size={14} /> Google Agenda
                </a>
              </li>
            ))}
          </ul>
          <button type="button" onClick={download} className="btn-secondary btn-sm">
            <Download size={16} /> Tout ajouter à mon agenda (.ics)
          </button>
          <p className="text-xs text-slate-500">
            Le fichier s'ouvre dans Calendrier (iPhone, Mac) ou Outlook et s'importe dans Google Agenda sur ordinateur ; sur
            Android, utilisez plutôt les liens Google Agenda.
          </p>
        </>
      )}
    </section>
  )
}
