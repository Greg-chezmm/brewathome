import {
  dryHopEvents,
  FERMENTATION_STEP_LABELS,
  fermentationSchedule,
  totalFermentationDays,
  type FermentationStep,
} from '@/lib/brew-calc/fermentation-profile'
import { fermentableUse } from '@/lib/brew-calc/gravity'
import type { Fermentable, Hop, OtherIngredient } from '@/lib/brew-calc/types'
import { formatWeightKg } from '@/lib/brew-calc/units'
import { fermentationDayTime } from './plan'

/** Rappel daté de la fermentation : ajout, changement de température, fin du profil. */
export interface FermentationReminder {
  /** Identifiant stable (UID de l'événement d'agenda : le réimporter le met à jour au lieu de le doubler). */
  key: string
  title: string
  description: string
  /** Jour compté depuis l'ensemencement. */
  day: number
  /** Début du rappel (ms). */
  time: number
}

/** Jour par défaut d'un ajout en fermentation sans jour prévu : après le pic de fermentation. */
export const DEFAULT_FERMENTATION_ADDITION_DAY = 3

/** Durée de fermentation supposée quand la recette n'a pas de profil (jours). */
export const DEFAULT_PRIMARY_DAYS = 14

/** Heure par défaut des rappels (heure locale). */
export const DEFAULT_REMINDER_TIME = '09:00'

/** Durée d'un événement de rappel dans l'agenda. */
const REMINDER_DURATION_MS = 15 * 60 * 1000

/** Date (ms) d'un jour de fermentation, à l'heure locale `hh:mm`. */
export function reminderTime(start: number, day: number, time: string): number {
  const date = new Date(fermentationDayTime(start, day))
  const [hours, minutes] = time.split(':').map(Number)
  date.setHours(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0, 0, 0)
  return date.getTime()
}

/**
 * Rappels d'un brassin, datés depuis le début de la fermentation : ajouts en fermentation
 * (au jour choisi), dry hops (ajout et retrait), changements d'étape du profil (nouvelle
 * consigne de température, cold crash) et fin du profil. Triés par date.
 */
export function fermentationReminders({
  steps,
  hops,
  fermentables,
  otherIngredients = [],
  start,
  additionDays = {},
  time = DEFAULT_REMINDER_TIME,
}: {
  steps: FermentationStep[]
  hops: Hop[]
  fermentables: Fermentable[]
  /** Autres ajouts : ceux « en fermentation » (copeaux, épices…) ont leur rappel d'ajout et de retrait. */
  otherIngredients?: OtherIngredient[]
  start: number
  /** Jour choisi pour chaque ajout en fermentation (par nom) ; à défaut `DEFAULT_FERMENTATION_ADDITION_DAY`. */
  additionDays?: Record<string, number>
  time?: string
}): FermentationReminder[] {
  const reminders: Omit<FermentationReminder, 'time'>[] = []

  const additionKeys = new Map<string, number>()
  for (const f of fermentables.filter((f) => fermentableUse(f) === 'fermentation')) {
    // Deux ajouts de même nom : le premier garde la clé historique (UID déjà dans l'agenda), les suivants un suffixe.
    const seen = (additionKeys.get(f.name) ?? 0) + 1
    additionKeys.set(f.name, seen)
    reminders.push({
      key: seen === 1 ? `addition-${f.name}` : `addition-${f.name}-${seen}`,
      title: `Ajout en fermentation : ${f.name} (${formatWeightKg(f.amountKg)})`,
      description: 'Dissoudre dans un peu d’eau bouillie refroidie, puis verser doucement dans le fermenteur.',
      day: additionDays[f.name] ?? DEFAULT_FERMENTATION_ADDITION_DAY,
    })
  }

  otherIngredients
    .filter((o) => o.use === 'fermentation')
    .forEach((o, i) => {
      const day = o.day ?? DEFAULT_FERMENTATION_ADDITION_DAY
      reminders.push({
        key: `other-${i}`,
        title: `Ajout en fermentation : ${o.name} (${o.amount})`,
        description: 'Dans un sachet ou une boule inox désinfectés, en limitant l’entrée d’air dans le fermenteur.',
        day,
      })
      if (o.contactDays) {
        reminders.push({
          key: `other-${i}-remove`,
          title: `Retirer : ${o.name}`,
          description: 'Fin du temps de contact : goûter, puis retirer ou soutirer si le résultat est là.',
          day: day + o.contactDays,
        })
      }
    })

  dryHopEvents(hops, steps).forEach((d, i) => {
    reminders.push({
      key: `dry-hop-${i}`,
      title: `Dry hop : ${d.name} (${d.amountG.toLocaleString('fr-FR')} g)`,
      description: 'Houblon dans un sac désinfecté, en limitant l’entrée d’air dans le fermenteur.',
      day: d.day,
    })
    if (d.removeDay !== null) {
      reminders.push({
        key: `dry-hop-${i}-remove`,
        title: `Retirer le dry hop : ${d.name}`,
        description: 'Fin du temps de contact : retirer le sac ou soutirer, au-delà le houblon donne des goûts herbacés.',
        day: d.removeDay,
      })
    }
  })

  fermentationSchedule(steps).forEach((s, i) => {
    if (i === 0) return
    reminders.push({
      key: `step-${i}`,
      title:
        s.type === 'cold-crash'
          ? `Cold crash : descendre à ${s.tempC.toLocaleString('fr-FR')} °C`
          : `${FERMENTATION_STEP_LABELS[s.type]} : passer à ${s.tempC.toLocaleString('fr-FR')} °C`,
      description: `${s.days.toLocaleString('fr-FR')} jour${s.days > 1 ? 's' : ''} à ${s.tempC.toLocaleString('fr-FR')} °C.`,
      day: s.startDay,
    })
  })

  // Sans profil : fin probable de la primaire (même hypothèse que pour placer les dry hops).
  const total = totalFermentationDays(steps)
  reminders.push({
    key: 'end',
    title: total > 0 ? 'Fin de la fermentation : vérifier la densité, conditionner' : 'Fin de fermentation probable : contrôler la densité',
    description: 'Densité stable 2-3 jours de suite : mise en bouteilles ou en fût (calcul du resucrage dans les outils).',
    day: total > 0 ? total : DEFAULT_PRIMARY_DAYS,
  })

  return reminders
    .map((r) => ({ ...r, time: reminderTime(start, r.day, time) }))
    .sort((a, b) => a.time - b.time)
}

/** Date UTC au format iCalendar / Google Agenda : 20261021T070000Z. */
function utcStamp(time: number): string {
  return new Date(time).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Échappement d'un texte iCalendar (RFC 5545 §3.3.11). */
function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Coupe une ligne iCalendar à 75 octets, les suites commençant par une espace (RFC 5545 §3.1). */
function foldLine(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ''
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74
    if (encoder.encode(current + char).length > limit) {
      parts.push(current)
      current = char
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/**
 * Fichier iCalendar (.ics) des rappels : s'importe dans Google Agenda, Apple Calendrier, Outlook…
 * Chaque événement porte une alarme à son heure et un UID stable (brassin + rappel) : les
 * agendas qui le gèrent mettent à jour l'événement au lieu de le dupliquer à un nouvel import.
 */
export function remindersToIcs(reminders: FermentationReminder[], batch: { id: string; name: string }, now = Date.now()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BrewAtHome//Rappels de fermentation//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...reminders.flatMap((r) => [
      'BEGIN:VEVENT',
      `UID:${batch.id}-${r.key.replace(/[^\w-]/g, '_')}@brewathome`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART:${utcStamp(r.time)}`,
      `DTEND:${utcStamp(r.time + REMINDER_DURATION_MS)}`,
      `SUMMARY:${escapeText(`🍺 ${batch.name} — ${r.title}`)}`,
      `DESCRIPTION:${escapeText(`${r.description}\nJour ${r.day} de fermentation.`)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(r.title)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/** Lien « ajouter à Google Agenda » d'un rappel (événement pré-rempli, à valider). */
export function googleCalendarUrl(reminder: FermentationReminder, batchName: string): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `🍺 ${batchName} — ${reminder.title}`,
    dates: `${utcStamp(reminder.time)}/${utcStamp(reminder.time + REMINDER_DURATION_MS)}`,
    details: `${reminder.description}\nJour ${reminder.day} de fermentation.`,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}
