import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BREWING_SALT_LABELS,
  WATER_TARGETS,
  applySalts,
  ionsAboveTarget,
  residualAlkalinity,
  suggestSalts,
  sulfateToChlorideRatio,
  type BrewingSalt,
  type WaterProfile,
} from '@/lib/brew-calc/water'
import { SOURCE_WATER_STORAGE_KEY } from '@/lib/water-storage'
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

/** Les deux sels qui suffisent presque toujours : calcium + sulfates (gypse) ou + chlorures (CaCl2). */
const SUGGESTED_SALTS: BrewingSalt[] = ['gypsum', 'calciumChloride']

const STORAGE_KEY = SOURCE_WATER_STORAGE_KEY

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

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

/** Alcalinité résiduelle : plus elle est haute, plus le pH d'empâtage monte (compensé par les malts sombres, acides). */
function alkalinityVerdict(ra: number): string {
  if (ra < 0) return 'pH d’empâtage bas : idéal pour les bières claires'
  if (ra < 50) return 'convient aux blondes et ambrées'
  if (ra < 120) return 'convient aux ambrées foncées et brunes'
  return 'réservée aux bières très sombres, sinon acide lactique'
}

export function WaterSaltsTool({ defaultVolumeL }: { defaultVolumeL?: number }) {
  const [source, setSource] = useState(loadSourceWater)
  const [volume, setVolume] = useState(defaultVolumeL ? String(defaultVolumeL) : '25')
  const [salts, setSalts] = useState<Record<BrewingSalt, string>>(
    () => Object.fromEntries(SALTS.map((salt) => [salt, ''])) as Record<BrewingSalt, string>,
  )
  const [targetId, setTargetId] = useState('')
  const target = WATER_TARGETS.find((t) => t.id === targetId) ?? null

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
  const excess = target ? ionsAboveTarget(sourceProfile, target.profile) : []

  function proposeSalts() {
    if (!target || !(volumeL > 0)) return
    const grams = suggestSalts(sourceProfile, target.profile, volumeL, SUGGESTED_SALTS)
    setSalts(Object.fromEntries(SALTS.map((salt) => [salt, grams[salt] ? String(grams[salt]) : ''])) as Record<BrewingSalt, string>)
  }

  return (
    <div className="card">
      <h2 className="section-title mb-1">Sels minéraux</h2>
      <p className="mb-3 text-sm text-slate-500">
        Profil de l'eau après ajout de sels. Partez de l'analyse de votre eau (fiche qualité de la commune, ou 0 partout
        pour une eau osmosée) ; elle est mémorisée dans ce navigateur.{' '}
        <Link to="/ingredients?tab=mash-water" className="font-medium text-indigo-600 hover:underline">
          Rôle de chaque ion
        </Link>
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

      <h3 className="mb-1 mt-4 text-sm font-semibold text-slate-700">Profil visé</h3>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 sm:w-96">
          <label className="sr-only" htmlFor="water-target">
            Profil visé
          </label>
          <select id="water-target" value={targetId} onChange={(e) => setTargetId(e.target.value)} className="field-input">
            <option value="">Aucun (dosage libre)</option>
            {WATER_TARGETS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} — {t.examples}
              </option>
            ))}
          </select>
        </div>
        {target && (
          <button type="button" onClick={proposeSalts} className="btn-primary">
            Proposer les sels
          </button>
        )}
      </div>
      {target && (
        <p className="mt-1 text-xs text-slate-500">
          Gypse et chlorure de calcium suffisent presque toujours ; les quantités restent modifiables ci-dessous. Une balance
          au 0,1 g est utile pour les petits volumes.
        </p>
      )}
      {excess.length > 0 && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Ton eau apporte déjà trop de {excess.map((ion) => lowerFirst(IONS.find((i) => i.key === ion)!.label)).join(', ')} pour ce
          profil : les sels ne peuvent qu'ajouter.{' '}
          {excess.includes('bicarbonate')
            ? "Coupe-la avec de l'eau déminéralisée, ou neutralise les bicarbonates avec un peu d'acide lactique."
            : "Coupe-la avec de l'eau déminéralisée (ou une eau en bouteille peu minéralisée)."}
        </p>
      )}

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
                <th className="py-1 pl-3 font-medium">{target ? 'Cible' : 'Repère'}</th>
              </tr>
            </thead>
            <tbody>
              {IONS.map(({ key, label, range }) => {
                const value = result[key]
                // Avec un profil visé : à plus de 20 % (et 10 ppm) de la cible ; sinon hors de la plage usuelle.
                const outside = target
                  ? Math.abs(value - target.profile[key]) > Math.max(10, target.profile[key] * 0.2)
                  : value < range[0] || value > range[1]
                return (
                  <tr key={key} className="border-t border-slate-100">
                    <td className="py-1 text-slate-700">{label}</td>
                    <td className="py-1 text-right text-slate-500">{Math.round(sourceProfile[key])}</td>
                    <td className={`py-1 text-right font-medium ${outside ? 'text-amber-700' : 'text-slate-900'}`}>
                      {Math.round(value)}
                    </td>
                    <td className="py-1 pl-3 text-xs text-slate-500">
                      {target ? target.profile[key] : `${range[0]}–${range[1]}`}
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
          <p className="mt-1 text-sm text-slate-600">
            Alcalinité résiduelle : {Math.round(residualAlkalinity(result))} ppm CaCO3{' '}
            <span className="text-slate-500">({alkalinityVerdict(residualAlkalinity(result))})</span>
          </p>
        </div>
      )}
    </div>
  )
}
