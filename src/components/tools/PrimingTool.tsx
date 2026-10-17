import { useState } from 'react'
import {
  PRIMING_SUGAR_LABELS,
  primingSugarGrams,
  residualCO2Volumes,
  type PrimingSugar,
} from '@/lib/brew-calc/carbonation'
import { FieldLabel } from '@/components/InfoTooltip'

/** Niveaux de CO2 usuels (volumes) : de quoi choisir sans connaître les chiffres. */
const CO2_PRESETS: { label: string; volumes: number }[] = [
  { label: 'Ale anglaise, bitter', volumes: 1.8 },
  { label: 'Stout, porter', volumes: 2.1 },
  { label: 'Pale ale, IPA, ambrée', volumes: 2.4 },
  { label: 'Lager, pils', volumes: 2.6 },
  { label: 'Saison, belge', volumes: 3.0 },
  { label: 'Blanche, weizen', volumes: 3.4 },
]

const BOTTLES_L = [0.33, 0.75]

/** Valeurs de départ : celles du brassin quand l'outil est ouvert depuis son suivi. */
export function PrimingTool({
  defaultVolumeL,
  defaultCo2,
  defaultTempC,
  note,
}: {
  defaultVolumeL?: number
  defaultCo2?: number
  defaultTempC?: number
  /** D'où viennent les valeurs pré-remplies. */
  note?: string
}) {
  const round = (value: number, digits: number) => String(Math.round(value * 10 ** digits) / 10 ** digits)
  const [volume, setVolume] = useState(defaultVolumeL ? round(defaultVolumeL, 1) : '20')
  const [temperature, setTemperature] = useState(defaultTempC !== undefined ? round(defaultTempC, 1) : '20')
  const [co2, setCo2] = useState(defaultCo2 ? round(defaultCo2, 2) : '2.4')
  const [sugar, setSugar] = useState<PrimingSugar>('sucrose')

  const volumeL = Number.parseFloat(volume)
  const tempC = Number.parseFloat(temperature)
  const target = Number.parseFloat(co2)
  const valid = volumeL > 0 && Number.isFinite(tempC) && target > 0
  const grams = valid ? primingSugarGrams(target, tempC, volumeL, sugar) : null
  const residual = Number.isFinite(tempC) ? residualCO2Volumes(tempC) : null

  return (
    <div className="card">
      <h2 className="section-title mb-1">Resucrage à la mise en bouteille</h2>
      <p className="mb-3 text-sm text-slate-500">
        Sucre à ajouter pour gazéifier en bouteille, compte tenu du CO2 déjà dissous dans la bière en fin de
        fermentation.
      </p>
      {note && <p className="-mt-2 mb-3 text-xs text-slate-500">{note}</p>}
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
        <div>
          <FieldLabel hint="Volume de bière réellement mis en bouteille (après soutirage, sans le dépôt).">
            Volume (L)
          </FieldLabel>
          <input type="number" step="0.1" value={volume} onChange={(e) => setVolume(e.target.value)} className="field-input" />
        </div>
        <div>
          <FieldLabel hint="La température la plus haute atteinte en fin de fermentation : plus la bière a été chaude, moins elle a gardé de CO2.">
            Temp. fin de ferm. (°C)
          </FieldLabel>
          <input
            type="number"
            step="0.5"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <FieldLabel hint="Volumes de CO2 visés : 2 pour une bière peu pétillante, 3 et plus pour une blanche.">
            CO2 visé (vol.)
          </FieldLabel>
          <input type="number" step="0.1" value={co2} onChange={(e) => setCo2(e.target.value)} className="field-input" />
        </div>
        <div>
          <FieldLabel hint="À CO2 égal, il faut 10 % de dextrose et 40 % d'extrait de malt sec en plus que de sucre blanc.">
            Sucre
          </FieldLabel>
          <select value={sugar} onChange={(e) => setSugar(e.target.value as PrimingSugar)} className="field-input">
            {(Object.keys(PRIMING_SUGAR_LABELS) as PrimingSugar[]).map((key) => (
              <option key={key} value={key}>
                {PRIMING_SUGAR_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {CO2_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setCo2(String(preset.volumes))}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${
              Number.parseFloat(co2) === preset.volumes
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {preset.label} · {preset.volumes.toLocaleString('fr-FR')}
          </button>
        ))}
      </div>
      {grams !== null && (
        <div className="mt-3 text-sm">
          {grams === 0 ? (
            <p className="font-medium text-amber-700">
              La bière contient déjà {residual!.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} volumes de CO2 :
              pas de sucre à ajouter.
            </p>
          ) : (
            <>
              <p className="font-medium text-indigo-600">
                <strong>{Math.round(grams)} g</strong> au total, soit {(grams / volumeL).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} g/L
                {BOTTLES_L.map((bottle) => (
                  <span key={bottle}>
                    {' · '}
                    {((grams / volumeL) * bottle).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} g par bouteille de{' '}
                    {bottle * 100} cl
                  </span>
                ))}
              </p>
              <p className="mt-1 text-slate-500">
                CO2 déjà dissous : {residual!.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} vol. Dissoudre le sucre
                dans un peu d'eau bouillante, laisser refroidir, puis le mélanger doucement à toute la bière.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
