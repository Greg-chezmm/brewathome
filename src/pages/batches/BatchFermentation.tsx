import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Download } from 'lucide-react'
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
import { ConnectionBadge } from '@/components/devices/ConnectionBadge'
import { BATCH_STATUS_LABELS, getBatchWithDetails } from '@/lib/db/queries/batches'
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

/** Relevés affichés avant « Tout afficher » : un iSpindel en envoie ~100 par jour. */
const LIST_PREVIEW = 20
/** Au-delà, la courbe est tracée sans points (plus lisible et plus rapide). */
const CHART_DOTS_MAX = 100
const GRAVITY_COLOR = '#4f46e5'
const TEMPERATURE_COLOR = '#f97316'

const formatDateTime = (t: number) =>
  new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
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
  const dots = all.length <= CHART_DOTS_MAX ? { r: 2 } : false
  const newestFirst = all.slice().reverse()
  const listed = showAll ? newestFirst : newestFirst.slice(0, LIST_PREVIEW)

  return (
    <div className="space-y-8">
      <div>
        <Link
          to={`/batches/${batchId}`}
          className="-ml-1 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
        >
          <ChevronLeft size={16} /> {batch?.name ?? 'Retour au brassin'}
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Suivi de fermentation</h1>
            {batch && (
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="font-medium text-slate-700">{batch.name}</span>
                <span className="badge">{BATCH_STATUS_LABELS[batch.status]}</span>
                {batch.brewDate && <span>brassé le {new Date(batch.brewDate).toLocaleDateString('fr-FR')}</span>}
              </p>
            )}
          </div>
          {linkedDevices.length === 0 && (
            <Link to="/devices" className="btn-secondary btn-sm">
              📡 Associer un iSpindel
            </Link>
          )}
        </div>
      </div>

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
              <Tooltip content={({ active, label }) => (active ? <ReadingTooltip reading={nearestReading(all, times, Number(label))} /> : null)} />
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

function ReadingTooltip({ reading }: { reading: FermentationReading | undefined }) {
  if (!reading) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-slate-700">{formatDateTime(new Date(reading.recordedAt).getTime())}</p>
      {reading.gravity !== null && <p style={{ color: GRAVITY_COLOR }}>Densité : {reading.gravity.toFixed(3)}</p>}
      {reading.temperatureC !== null && (
        <p style={{ color: TEMPERATURE_COLOR }}>Température : {reading.temperatureC} °C</p>
      )}
    </div>
  )
}
