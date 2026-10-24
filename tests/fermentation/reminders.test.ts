import { describe, expect, it } from 'vitest'
import type { FermentationStep } from '@/lib/brew-calc/fermentation-profile'
import type { Fermentable, Hop } from '@/lib/brew-calc/types'
import {
  DEFAULT_PRIMARY_DAYS,
  fermentationReminders,
  googleCalendarUrl,
  reminderTime,
  remindersToIcs,
} from '@/lib/fermentation/reminders'

const steps: FermentationStep[] = [
  { type: 'primary', tempC: 19, days: 10 },
  { type: 'conditioning', tempC: 20, days: 4 },
  { type: 'cold-crash', tempC: 2, days: 2 },
]
const hops: Hop[] = [
  { name: 'Citra', amountG: 50, alphaAcidPercent: 12, timeMin: 0, use: 'dry-hop', dryHopDay: 7, dryHopDays: 4 },
  { name: 'Magnum', amountG: 20, alphaAcidPercent: 12, timeMin: 60, use: 'boil' },
]
const fermentables: Fermentable[] = [
  { name: 'Pale', type: 'grain', amountKg: 5, colorLovibond: 3, yieldPercent: 80 },
  { name: 'Sucre candi', type: 'sugar', amountKg: 0.3, colorLovibond: 1, yieldPercent: 100, use: 'fermentation' },
]
// Ensemencé le 18/10/2026 à 18 h (heure locale).
const start = new Date(2026, 9, 18, 18, 0).getTime()

describe('Rappels de fermentation', () => {
  const reminders = fermentationReminders({ steps, hops, fermentables, start })
  const byKey = (key: string) => reminders.find((r) => r.key === key)!

  it('ajouts, dry hop (ajout et retrait), changements d’étape et fin, dans l’ordre', () => {
    expect(reminders.map((r) => [r.day, r.title])).toEqual([
      [3, 'Ajout en fermentation : Sucre candi (300 g)'],
      [7, 'Dry hop : Citra (50 g)'],
      [10, 'Garde : passer à 20 °C'],
      [11, 'Retirer le dry hop : Citra'],
      [14, 'Cold crash : descendre à 2 °C'],
      [16, 'Fin de la fermentation : vérifier la densité, conditionner'],
    ])
  })

  it('à l’heure choisie, le bon jour', () => {
    const dryHop = new Date(byKey('dry-hop-0').time)
    expect([dryHop.getDate(), dryHop.getMonth(), dryHop.getHours(), dryHop.getMinutes()]).toEqual([25, 9, 9, 0])
    expect(new Date(reminderTime(start, 1, '20:30')).getHours()).toBe(20)
  })

  it('jour d’ajout réglable', () => {
    const custom = fermentationReminders({ steps, hops, fermentables, start, additionDays: { 'Sucre candi': 5 } })
    expect(custom.find((r) => r.key === 'addition-Sucre candi')!.day).toBe(5)
  })

  it('sans profil : un rappel de contrôle de la densité en fin de primaire probable', () => {
    const bare = fermentationReminders({ steps: [], hops: [], fermentables: [], start })
    expect(bare).toEqual([expect.objectContaining({ key: 'end', day: DEFAULT_PRIMARY_DAYS, title: expect.stringMatching(/contrôler la densité/) })])
  })
})

describe('Agenda', () => {
  const reminders = fermentationReminders({ steps, hops, fermentables, start })
  const ics = remindersToIcs(reminders, { id: 'b1', name: 'Brune, forte' }, Date.UTC(2026, 9, 18))

  it('un événement par rappel, avec alarme, en lignes CRLF de 75 octets au plus', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(reminders.length)
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(reminders.length)
    expect(ics).toContain('UID:b1-dry-hop-0@brewathome')
    expect(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true)
  })

  it('échappe les virgules et dates en UTC', () => {
    const unfolded = ics.replace(/\r\n /g, '')
    expect(unfolded).toContain('SUMMARY:🍺 Brune\\, forte — Dry hop : Citra (50 g)')
    expect(unfolded).toContain(`DTSTART:${new Date(reminders[1].time).toISOString().replace(/[-:]/g, '').replace('.000', '')}`)
  })

  it('lien Google Agenda pré-rempli', () => {
    const url = new URL(googleCalendarUrl(reminders[1], 'Brune forte'))
    expect(url.hostname).toBe('calendar.google.com')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('🍺 Brune forte — Dry hop : Citra (50 g)')
    expect(url.searchParams.get('dates')).toMatch(/^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/)
  })
})

describe('Rappels — clés stables (UID de l’agenda)', () => {
  it('deux ajouts de même nom ont des clés distinctes, la première gardant la clé historique', () => {
    const twice: Fermentable[] = [
      { name: 'Sucre candi', type: 'sugar', amountKg: 0.3, colorLovibond: 1, yieldPercent: 100, use: 'fermentation' },
      { name: 'Sucre candi', type: 'sugar', amountKg: 0.2, colorLovibond: 1, yieldPercent: 100, use: 'fermentation' },
    ]
    const keys = fermentationReminders({ steps, hops, fermentables: twice, start }).map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain('addition-Sucre candi')
  })

  it('les UID de l’.ics sont tous différents', () => {
    const twice: Fermentable[] = [
      { name: 'Miel', type: 'sugar', amountKg: 0.3, colorLovibond: 1, yieldPercent: 100, use: 'fermentation' },
      { name: 'Miel', type: 'sugar', amountKg: 0.2, colorLovibond: 1, yieldPercent: 100, use: 'fermentation' },
    ]
    const list = fermentationReminders({ steps, hops, fermentables: twice, start })
    const ics = remindersToIcs(list, { id: 'b1', name: 'Test' })
    const uids = ics.split('\r\n').filter((l) => l.startsWith('UID:'))
    expect(new Set(uids).size).toBe(uids.length)
  })
})
