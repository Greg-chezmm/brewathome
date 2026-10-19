import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FieldLabel } from '@/components/InfoTooltip'
import { HYDROMETER_CALIBRATION_C, correctGravityForTemperature } from '@/lib/brew-calc/gravity-correction'
import type { EquipmentProfile } from '@/lib/brew-calc/types'
import {
  MEASUREMENTS,
  brewhouseEfficiencyPercent,
  compareGravity,
  isGravityKey,
  mashEfficiencyPercent,
  type MeasurementKey,
  type MeasurementKind,
  type MeasurementValues,
} from '@/lib/brew-day/measurements'
import { updateBatchMeasurements } from '@/lib/db/queries/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

const INPUT: Record<MeasurementKind, { step: string; min: number; max: number; decimals: number }> = {
  gravity: { step: '0.001', min: 0.98, max: 1.2, decimals: 3 },
  volume: { step: '0.1', min: 0, max: 1000, decimals: 1 },
  ph: { step: '0.01', min: 3, max: 8, decimals: 2 },
  temperature: { step: '0.5', min: -5, max: 100, decimals: 1 },
}

/** Plage de pH d'empâtage où les enzymes travaillent bien. */
const MASH_PH_RANGE: [number, number] = [5.2, 5.6]

const fmt = (value: number, decimals: number) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
const formatGravity = (value: number) => value.toFixed(3)
const formatValue = (key: MeasurementKey, value: number) =>
  isGravityKey(key) ? formatGravity(value) : `${fmt(value, INPUT[MEASUREMENTS[key].kind].decimals)} ${MEASUREMENTS[key].unit}`

const toDraft = (key: MeasurementKey, value: number | null) =>
  value === null ? '' : isGravityKey(key) ? value.toFixed(3) : String(value)

/**
 * Saisie de mesures du brassin (densités, volumes, pH…), chacune comparée à la recette dès
 * qu'elle est enregistrée ; affiche aussi les efficacités qu'elles permettent de calculer.
 * Utilisé à chaque étape du Brew Day, sur la page du brassin et en fin de fermentation.
 */
export function MeasurementsPanel({
  batchId,
  fields,
  measured,
  planned,
  recipe,
  equipment,
  title = 'Mesures',
  labels,
  suggestions,
  onSave = (changes) => updateBatchMeasurements(batchId, changes),
}: {
  batchId: string
  fields: MeasurementKey[]
  measured: MeasurementValues
  planned: MeasurementValues
  recipe: RecipeDetails
  equipment: EquipmentProfile | null | undefined
  title?: string
  /** Libellés remplaçant ceux de `MEASUREMENTS` (ex. mesures d'une session). */
  labels?: Partial<Record<MeasurementKey, string>>
  /** Valeurs calculées proposées (ex. DI du mélange des sessions), reprises d'un clic dans le champ. */
  suggestions?: Partial<Record<MeasurementKey, { value: number; label: string }>>
  /** Enregistrement des mesures modifiées (par défaut : celles du brassin). */
  onSave?: (changes: Partial<Record<MeasurementKey, number | null>>) => Promise<void>
}) {
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(fields.map((key) => [key, toDraft(key, measured[key])])) as Record<MeasurementKey, string>,
  )
  // Température de l'échantillon (facultative) : la densité lue est ramenée à 20 °C avant enregistrement.
  const [sampleTemps, setSampleTemps] = useState<Partial<Record<MeasurementKey, string>>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sampleTempC = (key: MeasurementKey) => {
    const text = (sampleTemps[key] ?? '').trim().replace(',', '.')
    const value = text === '' ? null : Number.parseFloat(text)
    return value !== null && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null
  }

  const parsed = Object.fromEntries(
    fields.map((key) => {
      const text = drafts[key].trim().replace(',', '.')
      const reading = text === '' ? null : Number.parseFloat(text)
      const sampleTemp = sampleTempC(key)
      if (reading === null || sampleTemp === null || !isGravityKey(key)) return [key, reading]
      return [key, Math.round(correctGravityForTemperature(reading, sampleTemp) * 10000) / 10000]
    }),
  ) as Record<MeasurementKey, number | null>
  const invalid = fields.filter((key) => {
    const value = parsed[key]
    const { min, max } = INPUT[MEASUREMENTS[key].kind]
    return value !== null && !(value >= min && value <= max)
  })
  const changes = Object.fromEntries(
    fields.filter((key) => parsed[key] !== measured[key]).map((key) => [key, parsed[key]]),
  ) as Partial<Record<MeasurementKey, number | null>>
  const dirty = Object.keys(changes).length > 0

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (invalid.length > 0 || !dirty) return
    setSaving(true)
    setError(null)
    try {
      await onSave(changes)
      await queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const shrinkage = equipment?.thermalShrinkagePercent
  const efficiencies: { label: string; actual: number | null; planned: number | null }[] = []
  if (fields.includes('preBoilGravity') || fields.includes('preBoilVolumeL')) {
    efficiencies.push({
      label: "Efficacité de l'empâtage",
      actual:
        measured.preBoilGravity !== null && measured.preBoilVolumeL !== null
          ? mashEfficiencyPercent(recipe, measured.preBoilGravity, measured.preBoilVolumeL, shrinkage)
          : null,
      planned: recipe.mashEfficiencyPercent,
    })
  }
  if (fields.includes('og')) {
    efficiencies.push({
      label: 'Efficacité de la brasserie',
      actual:
        measured.og !== null && measured.fermenterVolumeL !== null
          ? brewhouseEfficiencyPercent(recipe, measured.og, measured.fermenterVolumeL)
          : null,
      planned:
        planned.og !== null && planned.fermenterVolumeL !== null
          ? brewhouseEfficiencyPercent(recipe, planned.og, planned.fermenterVolumeL)
          : null,
    })
  }

  return (
    <form onSubmit={save} className="rounded-3xl border border-slate-200 bg-white p-5">
      <p className="mb-3 font-semibold text-slate-800">{title}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((key) => {
          const meta = MEASUREMENTS[key]
          const label = labels?.[key] ?? meta.label
          const input = INPUT[meta.kind]
          const suggestion = suggestions?.[key]
          return (
            <div key={key}>
              <FieldLabel hint={meta.hint}>
                {label}
                <span
                  className={`ml-1.5 rounded px-1 py-px text-[10px] normal-case tracking-normal ${
                    meta.required ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {meta.required ? 'à saisir' : 'facultatif'}
                </span>
              </FieldLabel>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step={input.step}
                  inputMode="decimal"
                  value={drafts[key]}
                  placeholder={planned[key] !== null ? toDraft(key, Number(planned[key]!.toFixed(input.decimals))) : ''}
                  onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })}
                  aria-label={label}
                  className="field-input w-32"
                />
                {meta.kind !== 'gravity' && <span className="text-sm text-slate-500">{meta.unit}</span>}
                {planned[key] !== null && (
                  <span className="text-xs text-slate-500">prévu {formatValue(key, planned[key]!)}</span>
                )}
              </div>
              {isGravityKey(key) && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <label className="flex items-center gap-1.5">
                    Temp. de l’échantillon
                    <input
                      type="number"
                      step="0.5"
                      inputMode="decimal"
                      value={sampleTemps[key] ?? ''}
                      placeholder={String(HYDROMETER_CALIBRATION_C)}
                      onChange={(e) => setSampleTemps({ ...sampleTemps, [key]: e.target.value })}
                      aria-label={`Température de l’échantillon — ${label}`}
                      className="field-input w-16 py-1"
                    />
                    °C
                  </label>
                  {sampleTempC(key) !== null && parsed[key] !== null && (
                    <span className="font-medium text-indigo-600">
                      → {formatGravity(parsed[key]!)} à {HYDROMETER_CALIBRATION_C} °C
                    </span>
                  )}
                </div>
              )}
              {suggestion && (
                <button
                  type="button"
                  onClick={() => setDrafts({ ...drafts, [key]: toDraft(key, Number(suggestion.value.toFixed(input.decimals))) })}
                  className="mt-1 text-xs font-medium text-indigo-600 hover:underline"
                >
                  {suggestion.label} : {formatValue(key, suggestion.value)} — reprendre
                </button>
              )}
              {invalid.includes(key) && (
                <p className="mt-1 text-xs text-red-600">
                  Valeur attendue entre {input.min} et {input.max}.
                </p>
              )}
              <MeasurementResult measurementKey={key} measured={measured[key]} planned={planned[key]} />
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving || !dirty || invalid.length > 0} className="btn-primary btn-sm">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      {efficiencies.length > 0 && (
        <dl className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 text-sm sm:grid-cols-2">
          {efficiencies.map(({ label, actual, planned: expected }) => (
            <div key={label}>
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-semibold text-slate-900">
                {actual !== null ? `${fmt(actual, 1)} %` : '—'}
                {expected !== null && <span className="ml-1.5 font-normal text-slate-500">(prévue {fmt(expected, 0)} %)</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </form>
  )
}

function MeasurementResult({
  measurementKey: key,
  measured,
  planned,
}: {
  measurementKey: MeasurementKey
  measured: number | null
  planned: number | null
}) {
  if (measured === null) return null

  if (isGravityKey(key) && planned !== null) {
    const { points, verdict, advice } = compareGravity(key, planned, measured)
    const signed = `${points > 0 ? '+' : ''}${points} pt${Math.abs(points) > 1 ? 's' : ''}`
    return (
      <div className="mt-1 text-xs">
        <p className={`font-medium ${verdict === 'ok' ? 'text-green-700' : 'text-amber-700'}`}>
          {verdict === 'ok' ? `Conforme à la recette (${signed})` : `${signed} ${verdict === 'low' ? 'sous' : 'au-dessus de'} la prévision`}
        </p>
        {advice && <p className="mt-0.5 text-slate-600">{advice}</p>}
      </div>
    )
  }

  if (key === 'mashPh') {
    const [low, high] = MASH_PH_RANGE
    const ok = measured >= low && measured <= high
    return (
      <p className={`mt-1 text-xs font-medium ${ok ? 'text-green-700' : 'text-amber-700'}`}>
        {ok
          ? `Dans la plage idéale (${fmt(low, 1)}–${fmt(high, 1)})`
          : measured > high
            ? 'Trop haut : un peu d’acide lactique ou de sels de calcium (gypse, CaCl2) le fera baisser.'
            : 'Trop bas : un peu de bicarbonate le remontera.'}
      </p>
    )
  }

  if (MEASUREMENTS[key].kind === 'volume' && planned !== null) {
    const delta = measured - planned
    if (Math.abs(delta) < 0.05) return <p className="mt-1 text-xs font-medium text-green-700">Conforme à la recette</p>
    return (
      <p className="mt-1 text-xs font-medium text-slate-600">
        {delta > 0 ? '+' : '−'}
        {fmt(Math.abs(delta), 1)} L par rapport à la recette
      </p>
    )
  }

  return null
}
