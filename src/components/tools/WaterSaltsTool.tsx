import { useState } from 'react'
import {
  BREWING_SALT_LABELS,
  applySalts,
  sulfateToChlorideRatio,
  type BrewingSalt,
  type WaterProfile,
} from '@/lib/brew-calc/water'
import { FieldLabel } from '@/components/InfoTooltip'

const IONS: { key: keyof WaterProfile; label: string; range: [number, number] }[] = [
  { key: 'calcium', label: 'Calcium (Ca)', range: [50, 150] },
  { key: 'magnesium', label: 'Magnésium (Mg)', range: [10, 30] },
  { key: 'sodium', label: 'Sodium (Na)', range: [0, 150] },
  { key: 'sulfate', label: 'Sulfates (SO4)', range: [50, 350] },
  { key: 'chloride', label: 'Chlorures (Cl)', range: [0, 250] },
  { key: 'bicarbonate', label: 'Bicarbonates (HCO3)', range: [0, 250] },
]

const SALTS = Object.keys(BREWING_SALT_LABELS) as BrewingSalt[]

/** L'analyse de l'eau du robinet ne change pas d'un brassin à l'autre : on la garde dans le navigateur. */
const STORAGE_KEY = 'brewathome.tools.source-water'

function loadSourceWater(): Record<keyof WaterProfile, string> {
  const empty = Object.fromEntries(IONS.map(({ key }) => [key, '0'])) as Record<keyof WaterProfile, string>
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Record<keyof WaterProfile, string>> | null
    return stored ? { ...empty, ...stored } : empty
  } catch {
    return empty
  }
}

function ratioVerdict(ratio: number): string {
  if (!Number.isFinite(ratio)) return 'sans chlorures : profil très sec'
  if (ratio > 1.5) return 'amertume mise en avant, finale sèche (IPA, pale ale)'
  if (ratio < 0.8) return 'rondeur maltée mise en avant (stout, NEIPA, bières de malt)'
  return 'équilibré'
}

export function WaterSaltsTool({ defaultVolumeL }: { defaultVolumeL?: number }) {
  const [source, setSource] = useState(loadSourceWater)
  const [volume, setVolume] = useState(defaultVolumeL ? String(defaultVolumeL) : '25')
  const [salts, setSalts] = useState<Record<BrewingSalt, string>>(
    () => Object.fromEntries(SALTS.map((salt) => [salt, ''])) as Record<BrewingSalt, string>,
  )

  function updateSource(key: keyof WaterProfile, value: string) {
    const next = { ...source, [key]: value }
    setSource(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Stockage indisponible (navigation privée) : la saisie vaut pour cette visite.
    }
  }

  const sourceProfile = Object.fromEntries(
    IONS.map(({ key }) => [key, Number.parseFloat(source[key]) || 0]),
  ) as unknown as WaterProfile
  const saltGrams = Object.fromEntries(
    SALTS.map((salt) => [salt, Number.parseFloat(salts[salt]) || 0]).filter(([, grams]) => (grams as number) > 0),
  ) as Partial<Record<BrewingSalt, number>>
  const volumeL = Number.parseFloat(volume)
  const result = volumeL > 0 ? applySalts(sourceProfile, saltGrams, volumeL) : null
  const ratio = result ? sulfateToChlorideRatio(result) : null

  return (
    <div className="card">
      <h2 className="section-title mb-1">Sels minéraux</h2>
      <p className="mb-3 text-sm text-slate-500">
        Profil de l'eau après ajout de sels. Partez de l'analyse de votre eau (fiche qualité de la commune, ou 0 partout
        pour une eau osmosée) ; elle est mémorisée dans ce navigateur.
      </p>

      <h3 className="mb-1 text-sm font-semibold text-slate-700">Eau de départ (ppm = mg/L)</h3>
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-6">
        {IONS.map(({ key, label }) => (
          <div key={key}>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`source-${key}`}>
              {label}
            </label>
            <input
              id={`source-${key}`}
              type="number"
              step="1"
              min="0"
              value={source[key]}
              onChange={(e) => updateSource(key, e.target.value)}
              className="field-input"
            />
          </div>
        ))}
      </div>

      <h3 className="mb-1 mt-4 text-sm font-semibold text-slate-700">Ajouts</h3>
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-3">
        <div>
          <FieldLabel hint="Eau traitée : empâtage + rinçage, ou chaque volume séparément pour un dosage par cuve.">
            Volume d'eau (L)
          </FieldLabel>
          <input type="number" step="0.5" value={volume} onChange={(e) => setVolume(e.target.value)} className="field-input" />
        </div>
        {SALTS.map((salt) => (
          <div key={salt}>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor={`salt-${salt}`}>
              {BREWING_SALT_LABELS[salt]} (g)
            </label>
            <input
              id={`salt-${salt}`}
              type="number"
              step="0.1"
              min="0"
              value={salts[salt]}
              onChange={(e) => setSalts({ ...salts, [salt]: e.target.value })}
              className="field-input"
            />
          </div>
        ))}
      </div>

      {result && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1 font-medium">Ion</th>
                <th className="py-1 text-right font-medium">Départ</th>
                <th className="py-1 text-right font-medium">Après sels</th>
                <th className="py-1 pl-3 font-medium">Repère</th>
              </tr>
            </thead>
            <tbody>
              {IONS.map(({ key, label, range }) => {
                const value = result[key]
                const outside = value < range[0] || value > range[1]
                return (
                  <tr key={key} className="border-t border-slate-100">
                    <td className="py-1 text-slate-700">{label}</td>
                    <td className="py-1 text-right text-slate-500">{Math.round(sourceProfile[key])}</td>
                    <td className={`py-1 text-right font-medium ${outside ? 'text-amber-700' : 'text-slate-900'}`}>
                      {Math.round(value)}
                    </td>
                    <td className="py-1 pl-3 text-xs text-slate-500">
                      {range[0]}–{range[1]}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {result.sulfate + result.chloride > 0 && (
            <p className="mt-2 text-sm font-medium text-indigo-600">
              Rapport sulfates/chlorures :{' '}
              {Number.isFinite(ratio!) ? ratio!.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '—'} ({ratioVerdict(ratio!)})
            </p>
          )}
        </div>
      )}
    </div>
  )
}
