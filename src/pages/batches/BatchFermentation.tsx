import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { listBrewfatherBatchReadings } from '@/lib/brewfather/client'
import { brewfatherReadingsToImport } from '@/lib/brewfather/readings'
import { FermentationPlan } from '@/components/batches/FermentationPlan'
import { MeasurementsPanel } from '@/components/batches/MeasurementsPanel'
import { PrimingTool } from '@/components/tools/PrimingTool'
import { ConnectionBadge } from '@/components/devices/ConnectionBadge'
import { getBatchSteps, getBatchWithDetails } from '@/lib/db/queries/batches'
import { getBrewfatherAccount } from '@/lib/db/queries/brewfather'
import { listDevices, setDeviceActiveBatch } from '@/lib/db/queries/devices'
import {
  addFermentationReading,
  deleteFermentationReading,
  insertFermentationReadings,
  listFermentationReadings,
  type FermentationReading,
} from '@/lib/db/queries/fermentation'
import { seriesWithGaps } from '@/lib/fermentation/chart'
import { plannedMeasurements } from '@/lib/brew-day/measurements'
import { currentGravity, fermentationProgress } from '@/lib/fermentation/progress'
import { fermentationStartTime, primingTemperatureC } from '@/lib/fermentation/plan'
import { gravityStability } from '@/lib/fermentation/stability'

/** Relevés affichés avant « Tout afficher » : un iSpindel en envoie ~100 par jour. */
const LIST_PREVIEW = 20
/** Au-delà, la courbe est tracée sans points (plus lisible et plus rapide). */
const CHART_DOTS_MAX = 100
const GRAVITY_COLOR = '#4f46e5'
const TEMPERATURE_COLOR = '#f97316'

const formatDateTime = (t: number) =>
  new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const fmtPercent = (value: number, digits: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits })
const formatDay = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })

export function BatchFermentation() {
  const { batchId } = useParams<{ batchId: string }>()
  const queryClient = useQueryClient()
  const { data: batch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => getBatchWithDetails(batchId!),
    enabled: !!batchId,
  })
  // Relu toutes les 30 s : le statut de l'iSpindel suit ses envois sans recharger la page.
  const { data: devices, dataUpdatedAt: devicesUpdatedAt } = useQuery({
    queryKey: ['devices'],
    queryFn: listDevices,
    refetchInterval: 30_000,
  })
  const linkedDevices = devices?.filter((d) => d.activeBatchId === batchId) ?? []
  const { data: readings } = useQuery({
    queryKey: ['fermentation-readings', batchId],
    queryFn: () => listFermentationReadings(batchId!),
    enabled: !!batchId,
    // Avec un iSpindel rattaché, les nouvelles mesures apparaissent d'elles-mêmes.
    refetchInterval: linkedDevices.length > 0 ? 60_000 : false,
  })
  const { data: batchSteps } = useQuery({
    queryKey: ['batch-steps', batchId],
    queryFn: () => getBatchSteps(batchId!),
    enabled: !!batchId,
  })
  const { data: brewfatherAccount } = useQuery({
    queryKey: ['brewfather-account'],
    queryFn: getBrewfatherAccount,
    enabled: !!batch?.brewfatherId,
  })

  const [gravity, setGravity] = useState('')
  const [temperature, setTemperature] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [openedAt] = useState(() => Date.now())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!batchId) return
    setSaving(true)
    try {
      await addFermentationReading(batchId, {
        gravity: gravity ? Number.parseFloat(gravity) : undefined,
        temperatureC: temperature ? Number.parseFloat(temperature) : undefined,
        comment: comment || undefined,
      })
      setGravity('')
      setTemperature('')
      setComment('')
      queryClient.invalidateQueries({ queryKey: ['fermentation-readings', batchId] })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteFermentationReading(id)
    queryClient.invalidateQueries({ queryKey: ['fermentation-readings', batchId] })
  }

  async function handleBrewfatherImport() {
    if (!batchId || !batch?.brewfatherId || !brewfatherAccount) return
    setImporting(true)
    setImportMessage(null)
    try {
      const source = await listBrewfatherBatchReadings(brewfatherAccount, batch.brewfatherId)
      const rows = brewfatherReadingsToImport(source, (readings ?? []).map((r) => r.recordedAt))
      const added = await insertFermentationReadings(batchId, rows)
      setImportMessage(
        added === 0
          ? 'Aucun nouveau relevé : tout est déjà importé.'
          : `${added.toLocaleString('fr-FR')} relevé${added > 1 ? 's' : ''} importé${added > 1 ? 's' : ''} depuis Brewfather.`,
      )
      queryClient.invalidateQueries({ queryKey: ['fermentation-readings', batchId] })
    } catch (err) {
      setImportMessage((err as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const all = readings ?? []
  // Axe de temps réel : un trou dans les mesures (batterie vide…) reste visible, et la courbe y est coupée.
  const times = all.map((r) => new Date(r.recordedAt).getTime())
  const gravitySeries = seriesWithGaps(all.map((r, i) => ({ time: times[i], value: r.gravity })))
  const temperatureSeries = seriesWithGaps(all.map((r, i) => ({ time: times[i], value: r.temperatureC })))
  // Seulement pendant la fermentation : une fois le brassin conditionné, l'alerte n'a plus d'objet.
  const stability = batch?.status === 'fermentation' ? gravityStability(all.map((r, i) => ({ time: times[i], gravity: r.gravity }))) : null
  const apparentAttenuation =
    stability && batch?.ogMeasured ? ((batch.ogMeasured - stability.gravity) / (batch.ogMeasured - 1)) * 100 : null
  // Alcool déjà produit : depuis la DI mesurée, à défaut celle prévue par la recette.
  const og = batch?.measurements.og ?? batch?.recipeSnapshot.estOg ?? null
  const ogIsMeasured = batch?.measurements.og != null
  const gravityNow = currentGravity(all.map((r, i) => ({ time: times[i], gravity: r.gravity })))
  const plannedFg = batch?.recipeSnapshot.estFg ?? null
  const progress = og !== null && gravityNow !== null ? fermentationProgress(og, gravityNow, plannedFg) : null
  const dots = all.length <= CHART_DOTS_MAX ? { r: 2 } : false
  const newestFirst = all.slice().reverse()
  const fermentationStart = batch ? fermentationStartTime(batchSteps ?? [], batch.brewDate, times[0] ?? null) : null
  const lastTemperature = newestFirst.find((r) => r.temperatureC !== null)?.temperatureC ?? null
  const profile = batch?.recipeSnapshot.fermentationSteps ?? []
  const primingTempC = batch
    ? primingTemperatureC(
        batch.measurements.maxFermentationTempC,
        all.map((r) => r.temperatureC),
        profile.filter((s) => s.type !== 'cold-crash').map((s) => s.tempC),
      )
    : null
  const primingVolumeL = batch?.measurements.packagingVolumeL ?? batch?.measurements.fermenterVolumeL ?? batch?.recipeSnapshot.targetVolumeL
  // Relu toutes les 30 s avec les appareils : « aujourd'hui » reste juste sans horloge dédiée.
  const now = Math.max(devicesUpdatedAt, openedAt)
  const listed = showAll ? newestFirst : newestFirst.slice(0, LIST_PREVIEW)

  return (
    <div className="space-y-8">
      {linkedDevices.length === 0 && (
        <div className="flex justify-end">
          <Link to="/devices" className="btn-secondary btn-sm">
            📡 Associer un iSpindel
          </Link>
        </div>
      )}

      {stability?.stable && batch && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">
            Densité stable à {stability.gravity.toFixed(3)} depuis {Math.floor(stability.stableDays)} jours : la fermentation
            semble terminée.
          </p>
          <p className="mt-1">
            {apparentAttenuation !== null && (
              <>Atténuation apparente {apparentAttenuation.toFixed(0)} %. </>
            )}
            Confirmez par une mesure au densimètre (l'iSpindel peut dériver) et saisissez-la comme DF :
          </p>
          <div className="mt-3">
            <MeasurementsPanel
              batchId={batch.id}
              fields={['fg']}
              measured={batch.measurements}
              planned={plannedMeasurements(batch.recipeSnapshot, null)}
              recipe={batch.recipeSnapshot}
              equipment={null}
              title="Densité finale"
            />
          </div>
        </div>
      )}

      {batch && (
        <FermentationPlan
          batchId={batch.id}
          steps={profile}
          hops={batch.recipeSnapshot.hops}
          start={fermentationStart}
          now={now}
          currentTempC={lastTemperature}
        />
      )}

      {linkedDevices.map((device) => (
        <div key={device.id} className="card flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">📡 {device.name}</p>
            <ConnectionBadge device={device} now={devicesUpdatedAt} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={async () => {
                await setDeviceActiveBatch(device.id, null)
                queryClient.invalidateQueries({ queryKey: ['devices'] })
              }}
              className="btn-secondary btn-sm"
            >
              Détacher
            </button>
            <Link to="/devices" className="btn-secondary btn-sm">
              Gérer l'appareil
            </Link>
          </div>
        </div>
      ))}

      {batch?.brewfatherId && brewfatherAccount && (
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-semibold text-slate-900">Relevés Brewfather</p>
            <p className="text-slate-500">
              Reprend les relevés du brassin Brewfather d'origine (iSpindel, saisies). Un second import n'ajoute que
              les nouveaux.
            </p>
            {importMessage && <p className="mt-1 font-medium text-slate-700">{importMessage}</p>}
          </div>
          <button type="button" onClick={handleBrewfatherImport} disabled={importing} className="btn-secondary shrink-0">
            <Download size={16} /> {importing ? 'Import en cours…' : 'Importer les relevés'}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Densité</label>
          <input
            type="number"
            step="0.001"
            placeholder="1.020"
            value={gravity}
            onChange={(e) => setGravity(e.target.value)}
            className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Température (°C)</label>
          <input
            type="number"
            step="0.1"
            placeholder="19.0"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-700">Commentaire</label>
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          Ajouter
        </button>
      </form>

      {progress && og !== null && gravityNow !== null && (
        <div className="card">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-slate-500">Densité actuelle</dt>
              <dd className="text-xl font-bold" style={{ color: GRAVITY_COLOR }}>
                {gravityNow.toFixed(3)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Alcool actuel</dt>
              <dd className="text-xl font-bold text-slate-900">≈ {fmtPercent(progress.abv, 1)} %</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Atténuation</dt>
              <dd className="text-xl font-bold text-slate-900">{fmtPercent(progress.attenuation, 0)} %</dd>
            </div>
            {progress.progressPercent !== null && plannedFg !== null && (
              <div>
                <dt className="text-xs text-slate-500">Vers la DF prévue ({plannedFg.toFixed(3)})</dt>
                <dd className="text-xl font-bold text-slate-900">{fmtPercent(Math.min(progress.progressPercent, 100), 0)} %</dd>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${Math.min(progress.progressPercent, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Calculé depuis la DI {ogIsMeasured ? 'mesurée' : 'prévue par la recette (pas encore saisie)'} : {og.toFixed(3)}
            {progress.progressPercent !== null && progress.progressPercent > 100 && ' · plus sèche que prévu'}.
          </p>
        </div>
      )}

      {all.length > 1 && (
        <div className="card h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={formatDay}
                tick={{ fontSize: 11 }}
                minTickGap={40}
              />
              <YAxis
                yAxisId="gravity"
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => v.toFixed(3)}
                tick={{ fontSize: 11, fill: GRAVITY_COLOR }}
                stroke={GRAVITY_COLOR}
              />
              <YAxis
                yAxisId="temperature"
                orientation="right"
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => `${v} °C`}
                tick={{ fontSize: 11, fill: TEMPERATURE_COLOR }}
                stroke={TEMPERATURE_COLOR}
              />
              <Tooltip content={({ active, label }) => (active ? <ReadingTooltip reading={nearestReading(all, times, Number(label))} og={og} /> : null)} />
              <Legend />
              <Line yAxisId="gravity" type="monotone" data={gravitySeries} dataKey="value" name="Densité" stroke={GRAVITY_COLOR} strokeWidth={2} dot={dots} isAnimationActive={false} />
              <Line yAxisId="temperature" type="monotone" data={temperatureSeries} dataKey="value" name="Température" stroke={TEMPERATURE_COLOR} dot={dots} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {all.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">
            {all.length.toLocaleString('fr-FR')} relevé{all.length > 1 ? 's' : ''}
            {all.length > 1 &&
              ` · du ${new Date(all[0].recordedAt).toLocaleDateString('fr-FR')} au ${new Date(all[all.length - 1].recordedAt).toLocaleDateString('fr-FR')}`}
          </p>
          <ul className={`space-y-1 ${showAll ? 'max-h-[60vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1' : ''}`}>
            {listed.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  {r.source === 'ispindel' && <span title="iSpindel">📡</span>}
                  {new Date(r.recordedAt).toLocaleString('fr-FR')} — {r.gravity && `SG ${r.gravity.toFixed(3)}`}{' '}
                  {r.temperatureC && `· ${r.temperatureC}°C`} {r.comment && `· ${r.comment}`}
                  {r.rawAngle !== null && (
                    <span className="text-slate-500" title="Angle d'inclinaison de l'iSpindel (≈ 23° dans l'eau pure avec la calibration actuelle)">
                      · {r.rawAngle.toFixed(1).replace('.', ',')}°
                    </span>
                  )}
                  {r.battery !== null && (
                    <span className={r.battery < 3.5 ? 'font-medium text-red-600' : 'text-slate-500'} title="Tension de la batterie (pleine ≈ 4,1 V, à recharger sous 3,5 V)">
                      · 🔋 {r.battery.toFixed(2).replace('.', ',')} V
                    </span>
                  )}
                </span>
                <button onClick={() => handleDelete(r.id)} className="text-xs text-red-600 hover:underline">
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
          {all.length > LIST_PREVIEW && (
            <button type="button" onClick={() => setShowAll(!showAll)} className="btn-secondary btn-sm">
              {showAll ? `Ne garder que les ${LIST_PREVIEW} derniers` : `Tout afficher (${all.length.toLocaleString('fr-FR')} relevés)`}
            </button>
          )}
        </div>
      )}

      {batch && (batch.status === 'fermentation' || batch.status === 'conditioning') && (
        <PrimingTool
          // Les valeurs du brassin arrivent après le premier rendu : la clé réinitialise l'outil quand elles changent.
          key={`${primingVolumeL}-${primingTempC}-${batch.recipeSnapshot.carbonationVols}`}
          defaultVolumeL={primingVolumeL}
          defaultCo2={batch.recipeSnapshot.carbonationVols ?? undefined}
          defaultTempC={primingTempC ?? undefined}
          note={[
            batch.recipeSnapshot.carbonationVols ? `CO₂ visé par la recette : ${batch.recipeSnapshot.carbonationVols.toLocaleString('fr-FR')} vol.` : null,
            primingTempC !== null
              ? batch.measurements.maxFermentationTempC !== null
                ? 'Température : maximum saisi dans les mesures.'
                : all.some((r) => r.temperatureC !== null)
                  ? 'Température : la plus haute des relevés.'
                  : 'Température : la plus haute du profil de fermentation.'
              : null,
          ]
            .filter(Boolean)
            .join(' ')}
        />
      )}
    </div>
  )
}

/** Relevé le plus proche de l'instant survolé (les relevés sont triés par date). */
function nearestReading(readings: FermentationReading[], times: number[], time: number): FermentationReading | undefined {
  if (!Number.isFinite(time) || readings.length === 0) return undefined
  let lo = 0
  let hi = times.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (times[mid] < time) lo = mid + 1
    else hi = mid
  }
  return lo > 0 && time - times[lo - 1] < times[lo] - time ? readings[lo - 1] : readings[lo]
}

function ReadingTooltip({ reading, og }: { reading: FermentationReading | undefined; og: number | null }) {
  if (!reading) return null
  const abv = og !== null && reading.gravity !== null ? fermentationProgress(og, reading.gravity, null).abv : null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-slate-700">{formatDateTime(new Date(reading.recordedAt).getTime())}</p>
      {reading.gravity !== null && <p style={{ color: GRAVITY_COLOR }}>Densité : {reading.gravity.toFixed(3)}</p>}
      {reading.temperatureC !== null && (
        <p style={{ color: TEMPERATURE_COLOR }}>Température : {reading.temperatureC} °C</p>
      )}
      {abv !== null && <p className="text-slate-700">Alcool : ≈ {fmtPercent(abv, 1)} %</p>}
    </div>
  )
}
