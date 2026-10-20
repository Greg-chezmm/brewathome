import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CalibrationChart } from '@/components/devices/CalibrationChart'
import { FieldLabel } from '@/components/InfoTooltip'
import { correctGravityForTemperature, HYDROMETER_CALIBRATION_C } from '@/lib/brew-calc/gravity-correction'
import { platoToSg } from '@/lib/brew-calc/gravity-input'
import { sgToPlato } from '@/lib/brew-calc/yeast'
import { listDevices, updateDeviceSettings } from '@/lib/db/queries/devices'
import {
  MAX_DEGREE,
  fitPolynomial,
  formatPolynomial,
  parseCalibrationPoints,
  serializeCalibrationPoints,
  type CalibrationPoint,
} from '@/lib/ispindel/polynomial'

type GravityUnit = 'plato' | 'sg'
type Instrument = 'hydrometer' | 'refractometer'

const STORAGE_KEY = 'brewathome:ispindel-calibration'
const RECOMMENDED_DEGREE = 2
const DEFAULT_WORT_CORRECTION = '1.04'

interface Saved {
  unit: GravityUnit
  points: CalibrationPoint[]
}

function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const data = raw ? (JSON.parse(raw) as { unit?: GravityUnit; points?: string }) : null
    const points = data?.points ? parseCalibrationPoints(data.points) : null
    if (data && points) return { unit: data.unit === 'sg' ? 'sg' : 'plato', points }
  } catch {
    // Stockage indisponible ou contenu illisible : on repart de zéro.
  }
  return { unit: 'plato', points: [] }
}

function saveLocally(unit: GravityUnit, points: CalibrationPoint[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ unit, points: serializeCalibrationPoints(points) }))
  } catch {
    // Pas de stockage local : la calibration reste utilisable, sans reprise au rechargement.
  }
}

const convert = (value: number, from: GravityUnit, to: GravityUnit) =>
  from === to ? value : to === 'plato' ? sgToPlato(value) : platoToSg(value)

/** Outil de calibration d'un iSpindel : couples (angle ; densité) → polynôme à recopier dans le portail. */
export function IspindelCalibration() {
  const queryClient = useQueryClient()
  const { data: devices } = useQuery({ queryKey: ['devices'], queryFn: listDevices })
  const [initial] = useState(loadSaved)
  const [unit, setUnit] = useState<GravityUnit>(initial.unit)
  const [points, setPoints] = useState<CalibrationPoint[]>(initial.points)
  const [instrument, setInstrument] = useState<Instrument>('hydrometer')
  const [reading, setReading] = useState('')
  const [sampleTemp, setSampleTemp] = useState(String(HYDROMETER_CALIBRATION_C))
  const [wortCorrection, setWortCorrection] = useState(DEFAULT_WORT_CORRECTION)
  const [tilt, setTilt] = useState('')
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [deviceId, setDeviceId] = useState('')
  const [degree, setDegree] = useState(RECOMMENDED_DEGREE)
  const fileInput = useRef<HTMLInputElement>(null)

  const number = (text: string) => Number.parseFloat(text.replace(',', '.'))
  const rawReading = number(reading)
  // Densimètre : lecture ramenée à 20 °C ; réfractomètre : Brix/Plato divisé par la correction du moût.
  const gravityInUnit = (() => {
    if (!Number.isFinite(rawReading)) return null
    if (instrument === 'refractometer') {
      const plato = rawReading / (number(wortCorrection) || 1)
      return convert(plato, 'plato', unit)
    }
    const sg = unit === 'sg' ? rawReading : platoToSg(rawReading)
    const temperature = number(sampleTemp)
    const corrected = Number.isFinite(temperature) ? correctGravityForTemperature(sg, temperature) : sg
    return convert(corrected, 'sg', unit)
  })()
  const tiltValue = number(tilt)
  const canAdd = gravityInUnit !== null && Number.isFinite(tiltValue)
  const precision = unit === 'plato' ? 2 : 4
  const gravityLabel = unit === 'plato' ? 'densité (°P)' : 'densité (SG)'

  const fits = Array.from({ length: MAX_DEGREE }, (_, i) => fitPolynomial(points, i + 1)).filter((f) => f !== null)
  const chosen = fits.find((f) => f.degree === degree) ?? fits[fits.length - 1] ?? null
  const polynomial = chosen ? formatPolynomial(chosen.coefficients) : ''

  function update(next: CalibrationPoint[], nextUnit = unit) {
    const sorted = [...next].sort((a, b) => a.tilt - b.tilt)
    setPoints(sorted)
    saveLocally(nextUnit, sorted)
  }

  function addPoint() {
    if (!canAdd || gravityInUnit === null) return
    update([...points, { tilt: tiltValue, gravity: gravityInUnit }])
    setTilt('')
    setReading('')
  }

  function changeUnit(next: GravityUnit) {
    setUnit(next)
    update(points.map((p) => ({ ...p, gravity: convert(p.gravity, unit, next) })), next)
    setReading('')
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(polynomial)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setMessage({ kind: 'error', text: 'Copie impossible : sélectionnez le polynôme et copiez-le à la main.' })
    }
  }

  function exportFile() {
    const url = URL.createObjectURL(new Blob([serializeCalibrationPoints(points)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'calibration-ispindel.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importFile(file: File | undefined) {
    if (!file) return
    const loaded = parseCalibrationPoints(await file.text())
    if (!loaded) {
      setMessage({ kind: 'error', text: 'Fichier non reconnu : attendu une liste de points (angle, densité).' })
      return
    }
    update(loaded)
    setMessage({ kind: 'ok', text: `${loaded.length} points chargés (densités lues en ${unit === 'plato' ? '°P' : 'SG'}).` })
  }

  async function saveToDevice() {
    const device = devices?.find((d) => d.id === deviceId)
    if (!device || !polynomial) return
    try {
      await updateDeviceSettings(device.id, { ...device.settings, polynomial })
      await queryClient.invalidateQueries({ queryKey: ['devices'] })
      setMessage({ kind: 'ok', text: `Polynôme enregistré dans le mémo de « ${device.name} ».` })
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/devices" className="text-sm font-medium text-indigo-600 hover:underline">
          ← Appareils connectés
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Calibration de l'iSpindel</h1>
        <p className="text-slate-600">
          Relevez l'angle de l'iSpindel dans des solutions sucrées de densité connue : l'outil calcule le polynôme à
          recopier dans le portail (page Configuration). Le protocole complet est sur la page Appareils.
        </p>
      </div>

      <section className="card space-y-4">
        <h2 className="section-title">Ajouter un point</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <FieldLabel hint="Le polynôme donnera la densité dans cette unité : choisissez celle réglée dans le portail de l'iSpindel (Plato par défaut). L'application accepte les deux.">
              Unité de densité
            </FieldLabel>
            <select aria-label="Unité de densité" value={unit} onChange={(e) => changeUnit(e.target.value as GravityUnit)} className="field-input">
              <option value="plato">Plato (°P)</option>
              <option value="sg">Densité (ex. 1,050)</option>
            </select>
          </div>
          <div>
            <FieldLabel hint="Le réfractomètre n'est fiable que sur une solution sucrée sans alcool, ce qui est le cas ici.">
              Instrument
            </FieldLabel>
            <select aria-label="Instrument" value={instrument} onChange={(e) => setInstrument(e.target.value as Instrument)} className="field-input">
              <option value="hydrometer">Densimètre</option>
              <option value="refractometer">Réfractomètre</option>
            </select>
          </div>
          {instrument === 'hydrometer' ? (
            <div>
              <FieldLabel hint="Température de la solution au moment de la lecture : la lecture est ramenée à 20 °C.">
                Température (°C)
              </FieldLabel>
              <input aria-label="Température de l'échantillon" type="number" step="0.5" value={sampleTemp} onChange={(e) => setSampleTemp(e.target.value)} className="field-input" />
            </div>
          ) : (
            <div>
              <FieldLabel hint="Facteur de correction du réfractomètre pour le moût (souvent 1,04).">
                Correction du moût
              </FieldLabel>
              <input aria-label="Correction du moût" type="number" step="0.01" value={wortCorrection} onChange={(e) => setWortCorrection(e.target.value)} className="field-input" />
            </div>
          )}
          <div>
            <FieldLabel hint={instrument === 'hydrometer' ? 'La valeur lue au densimètre, dans l’unité choisie.' : 'La valeur lue au réfractomètre, en °Brix (assimilé au Plato).'}>
              {instrument === 'hydrometer' ? `Lecture (${unit === 'plato' ? '°P' : 'SG'})` : 'Lecture (°Brix)'}
            </FieldLabel>
            <input
              aria-label="Lecture de densité"
              type="number"
              step={unit === 'sg' && instrument === 'hydrometer' ? '0.001' : '0.1'}
              value={reading}
              onChange={(e) => setReading(e.target.value)}
              placeholder={unit === 'sg' ? '1.040' : '10.0'}
              className="field-input"
            />
          </div>
          <div>
            <FieldLabel hint="L'angle affiché sur la page Info du portail (192.168.4.1), moyenne de deux relevés.">
              Angle (tilt)
            </FieldLabel>
            <input
              aria-label="Angle (tilt)"
              type="number"
              step="0.01"
              value={tilt}
              onChange={(e) => setTilt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPoint()}
              placeholder="45.2"
              className="field-input"
            />
          </div>
          <div className="flex items-end">
            <button type="button" onClick={addPoint} disabled={!canAdd} className="btn-primary w-full">
              Ajouter{gravityInUnit !== null ? ` (${gravityInUnit.toFixed(precision)})` : ''}
            </button>
          </div>
        </div>
      </section>

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
          {message.text}
        </p>
      )}

      {points.length > 0 && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title">Points relevés ({points.length})</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportFile} className="btn-secondary btn-sm">
                Enregistrer dans un fichier
              </button>
              <button type="button" onClick={() => fileInput.current?.click()} className="btn-secondary btn-sm">
                Charger un fichier
              </button>
              <button
                type="button"
                onClick={() => confirm('Effacer tous les points ?') && update([])}
                className="btn-danger btn-sm"
              >
                Tout effacer
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-1 pr-3">Angle</th>
                  <th className="pr-3">{unit === 'plato' ? '°P' : 'SG'}</th>
                  {fits.map((f) => (
                    <th key={f.degree} className="pr-3 text-right">
                      Écart deg. {f.degree}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr key={`${p.tilt}-${p.gravity}`} className="border-t border-slate-100">
                    <td className="py-1 pr-3 tabular-nums">{p.tilt}</td>
                    <td className="pr-3 tabular-nums">{p.gravity.toFixed(precision)}</td>
                    {fits.map((f) => {
                      const error = f.coefficients.reduceRight((acc, c) => acc * p.tilt + c, 0) - p.gravity
                      return (
                        <td key={f.degree} className="pr-3 text-right tabular-nums text-slate-600">
                          {error >= 0 ? '+' : '−'}
                          {Math.abs(error).toFixed(precision)}
                        </td>
                      )
                    })}
                    <td className="text-right">
                      <button
                        type="button"
                        aria-label={`Supprimer le point ${i + 1}`}
                        onClick={() => update(points.filter((_, k) => k !== i))}
                        className="px-2 text-slate-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".json,.dat,application/json,text/plain"
            className="hidden"
            data-testid="calibration-file"
            onChange={(e) => {
              void importFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </section>
      )}

      {points.length > 0 && <CalibrationChart points={points} fits={fits} gravityLabel={gravityLabel} />}

      <section className="card space-y-3">
        <h2 className="section-title">Polynôme</h2>
        {!chosen ? (
          <p className="text-sm text-slate-500">Ajoutez au moins 2 points (5 conseillés, de 1,000 à 1,080) pour calculer le polynôme.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Degré du polynôme">
              {fits.map((f) => (
                <button
                  key={f.degree}
                  type="button"
                  aria-pressed={chosen.degree === f.degree}
                  onClick={() => setDegree(f.degree)}
                  className={chosen.degree === f.degree ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                >
                  Degré {f.degree} · R² {f.r2.toFixed(4)}
                </button>
              ))}
            </div>
            <p className="break-all rounded-xl bg-slate-100 p-3 font-mono text-sm" data-testid="polynomial">
              {polynomial}
            </p>
            <p className="text-xs text-slate-500">
              Écart maximal sur vos points : {chosen.maxError.toFixed(precision)} {unit === 'plato' ? '°P' : 'SG'}.
              {points.length < 5 && ' Avec moins de 5 points, la courbe colle aux mesures sans les vérifier : ajoutez-en.'}
              {points.length === chosen.degree + 1 && ' Autant de points que de coefficients : l’écart est nul par construction.'}
              {chosen.degree === 3 && ' Le degré 3 épouse le bruit de mesure : le degré 2 est le plus fiable.'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={copy} className="btn-secondary btn-sm">
                {copied ? 'Copié ✓' : 'Copier le polynôme'}
              </button>
              {devices && devices.length > 0 && (
                <>
                  <select
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    aria-label="Appareil à mettre à jour"
                    className="field-input w-auto py-1"
                  >
                    <option value="">Mémo de l'appareil…</option>
                    {devices
                      .filter((d) => d.type === 'ispindel')
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                  <button type="button" onClick={saveToDevice} disabled={!deviceId} className="btn-secondary btn-sm">
                    Enregistrer dans le mémo
                  </button>
                </>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Le polynôme est ensuite à saisir dans le portail de l'iSpindel (Configuration → Polynôme), avec la même unité
              de densité ({unit === 'plato' ? 'Plato' : 'SG'}).
            </p>
          </>
        )}
      </section>
    </div>
  )
}
