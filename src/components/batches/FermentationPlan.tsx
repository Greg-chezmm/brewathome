import { Link } from 'react-router-dom'
import {
  dryHopEvents,
  FERMENTATION_STEP_LABELS,
  fermentationPositionAt,
  fermentationSchedule,
  totalFermentationDays,
  type FermentationStep,
  type FermentationStepType,
} from '@/lib/brew-calc/fermentation-profile'
import type { Hop } from '@/lib/brew-calc/types'
import { elapsedFermentationDays, fermentationDayTime, TEMPERATURE_TOLERANCE_C } from '@/lib/fermentation/plan'

const STEP_COLORS: Record<FermentationStepType, string> = {
  primary: 'bg-amber-400',
  secondary: 'bg-orange-400',
  conditioning: 'bg-indigo-400',
  'cold-crash': 'bg-sky-400',
}

const fmt = (value: number, digits = 0) => value.toLocaleString('fr-FR', { maximumFractionDigits: digits })
const formatDate = (t: number) => new Date(t).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const plural = (n: number, word: string) => `${fmt(n)} ${word}${n > 1 ? 's' : ''}`

/**
 * Profil de fermentation de la recette appliqué au brassin : étape en cours, consigne de
 * température, prochaines étapes et dry hops datés depuis l'ensemencement.
 */
export function FermentationPlan({
  batchId,
  steps,
  hops,
  start,
  now,
  currentTempC,
}: {
  batchId: string
  steps: FermentationStep[]
  hops: Hop[]
  /** Début de la fermentation (ms), null si inconnu : le plan s'affiche alors en jours. */
  start: number | null
  now: number
  currentTempC: number | null
}) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Pas de profil de fermentation dans la recette de ce brassin.{' '}
        <Link to={`/batches/${batchId}/edit-recipe`} className="font-medium text-indigo-600 hover:underline">
          L’ajouter
        </Link>{' '}
        pour suivre les étapes (primaire, garde, cold crash) et les jours de dry hop.
      </p>
    )
  }

  const schedule = fermentationSchedule(steps)
  const total = totalFermentationDays(steps)
  const elapsed = start !== null ? elapsedFermentationDays(start, now) : null
  const position = elapsed !== null ? fermentationPositionAt(steps, elapsed) : null
  const dryHops = dryHopEvents(hops, steps)
  const day = elapsed !== null ? Math.floor(Math.max(0, elapsed)) : null
  const when = (d: number) => (start !== null ? formatDate(fermentationDayTime(start, d)) : `jour ${fmt(d)}`)

  const current = position?.current ?? null
  const tempGap = current && currentTempC !== null ? currentTempC - current.tempC : null

  return (
    <section className="card space-y-4" aria-label="Profil de fermentation">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="section-title">Profil de fermentation</h2>
        <p className="text-sm text-slate-500">
          {day !== null && !position?.done ? `Jour ${fmt(day)} sur ${fmt(total)}` : `${plural(total, 'jour')} au total`}
        </p>
      </div>

      {/* Frise : chaque étape à proportion de sa durée, curseur sur aujourd'hui. */}
      <div className="relative pt-1">
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
          {schedule.map((s, i) =>
            s.endDay > s.startDay ? (
              <div
                key={i}
                className={`${STEP_COLORS[s.type]} ${position && !position.done && position.index !== i ? 'opacity-40' : ''} border-r border-white last:border-r-0`}
                style={{ width: `${((s.endDay - s.startDay) / total) * 100}%` }}
                title={`${FERMENTATION_STEP_LABELS[s.type]} : ${s.tempC} °C, ${plural(s.days, 'jour')}`}
              />
            ) : null,
          )}
        </div>
        {elapsed !== null && elapsed >= 0 && elapsed <= total && (
          <div
            className="absolute top-0 h-5 w-0.5 -translate-x-1/2 rounded bg-slate-900"
            style={{ left: `${(elapsed / total) * 100}%` }}
            aria-hidden
          />
        )}
        {dryHops.map((d, i) =>
          d.day <= total ? (
            <span
              key={i}
              className="absolute -bottom-3 -translate-x-1/2 text-[10px]"
              style={{ left: `${(d.day / total) * 100}%` }}
              title={`Dry hop jour ${d.day} : ${d.name}`}
              aria-hidden
            >
              🌿
            </span>
          ) : null,
        )}
      </div>

      <ol className="space-y-1.5 pt-2 text-sm">
        {schedule.map((s, i) => {
          const isCurrent = position?.index === i && !position.done
          const isPast = position ? position.done || i < position.index : false
          return (
            <li
              key={i}
              className={`flex flex-wrap items-center justify-between gap-x-3 rounded-lg px-2.5 py-1.5 ${
                isCurrent ? 'bg-indigo-50 font-medium text-indigo-900' : isPast ? 'text-slate-400' : 'text-slate-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STEP_COLORS[s.type]}`} aria-hidden />
                {FERMENTATION_STEP_LABELS[s.type]} · {fmt(s.tempC, 1)} °C · {plural(s.days, 'jour')}
              </span>
              <span className="text-xs tabular-nums">
                {isCurrent && position ? `en cours · encore ${plural(Math.ceil(position.daysLeftInStep), 'jour')}` : `dès le ${when(s.startDay)}`}
              </span>
            </li>
          )
        })}
      </ol>

      {current && tempGap !== null && Math.abs(tempGap) > TEMPERATURE_TOLERANCE_C && (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Dernier relevé à {fmt(currentTempC!, 1)} °C : {fmt(Math.abs(tempGap), 1)} °C {tempGap > 0 ? 'au-dessus' : 'en dessous'} de la
          consigne ({fmt(current.tempC, 1)} °C).
          {tempGap > 0 && current.type === 'primary' && ' Trop chaud en début de fermentation : risque d’arômes de solvant ou de fruits trop marqués.'}
        </p>
      )}
      {position?.done && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Profil terminé : la bière est prête à être conditionnée (vérifiez que la densité est stable).
        </p>
      )}

      {dryHops.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Dry hop</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {dryHops.map((d, i) => {
              const status =
                day === null
                  ? null
                  : day < d.day
                    ? `dans ${plural(d.day - day, 'jour')}`
                    : day === d.day
                      ? 'aujourd’hui'
                      : d.removeDay !== null && day < d.removeDay
                        ? `en contact · retrait ${d.removeDay - day === 0 ? 'aujourd’hui' : `dans ${plural(d.removeDay - day, 'jour')}`}`
                        : 'fait'
              return (
                <li key={i} className="flex flex-wrap justify-between gap-x-3">
                  <span>
                    {d.name} ({fmt(d.amountG)} g) · {when(d.day)}
                    {d.removeDay !== null && <span className="text-slate-500"> → retrait {when(d.removeDay)}</span>}
                  </span>
                  {status && (
                    <span className={`text-xs ${status === 'aujourd’hui' ? 'font-semibold text-indigo-700' : 'text-slate-500'}`}>{status}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
