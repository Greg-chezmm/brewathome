import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
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
import {
  addFermentationReading,
  deleteFermentationReading,
  listFermentationReadings,
} from '@/lib/db/queries/fermentation'

export function BatchFermentation() {
  const { batchId } = useParams<{ batchId: string }>()
  const queryClient = useQueryClient()
  const { data: readings } = useQuery({
    queryKey: ['fermentation-readings', batchId],
    queryFn: () => listFermentationReadings(batchId!),
    enabled: !!batchId,
  })

  const [gravity, setGravity] = useState('')
  const [temperature, setTemperature] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

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

  const chartData = (readings ?? []).map((r) => ({
    date: new Date(r.recordedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    gravity: r.gravity,
    temperature: r.temperatureC,
  }))

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Suivi de fermentation</h1>
        <Link to="/devices" className="btn-secondary btn-sm">
          📡 Associer un iSpindel
        </Link>
      </div>

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

      {chartData.length > 1 && (
        <div className="card h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="gravity" domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="temperature" orientation="right" domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="gravity" type="monotone" dataKey="gravity" name="Densité" stroke="#4f46e5" dot={{ r: 2 }} connectNulls />
              <Line yAxisId="temperature" type="monotone" dataKey="temperature" name="Température (°C)" stroke="#2563eb" dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <ul className="space-y-1">
        {readings
          ?.slice()
          .reverse()
          .map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                {r.source === 'ispindel' && <span title="iSpindel">📡</span>}
                {new Date(r.recordedAt).toLocaleString('fr-FR')} — {r.gravity && `SG ${r.gravity.toFixed(3)}`}{' '}
                {r.temperatureC && `· ${r.temperatureC}°C`} {r.comment && `· ${r.comment}`}
              </span>
              <button onClick={() => handleDelete(r.id)} className="text-xs text-red-600 hover:underline">
                Supprimer
              </button>
            </li>
          ))}
      </ul>
    </div>
  )
}
