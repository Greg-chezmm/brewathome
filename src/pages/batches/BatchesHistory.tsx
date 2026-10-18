import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { batchHistoryRow, historyInsights, historyStats, type BatchHistoryRow } from '@/lib/batches/history'
import { BATCH_STATUS_LABELS, listBatchesWithDetails } from '@/lib/db/queries/batches'
import { listEquipmentProfiles } from '@/lib/db/queries/equipmentProfiles'

const fmt = (value: number | null, digits: number, suffix = '') =>
  value === null || !Number.isFinite(value)
    ? '—'
    : `${value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })

/** Brassin ayant au moins une mesure utile à l'historique. */
const hasData = (r: BatchHistoryRow) => r.og !== null || r.mashEfficiency !== null || r.fermenterVolumeL !== null

/** « mesuré (prévu) », la valeur mesurée en gras quand elle existe. */
function Measured({ value, planned, digits, suffix = '' }: { value: number | null; planned: number | null; digits: number; suffix?: string }) {
  return (
    <>
      <span className={value === null ? 'text-slate-400' : 'font-medium text-slate-900'}>{fmt(value, digits, suffix)}</span>
      {planned !== null && <span className="block text-xs text-slate-400">prévu {fmt(planned, digits, suffix)}</span>}
    </>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-bold tabular-nums text-slate-900">{value}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  )
}

const signed = (value: number | null, digits: number, suffix: string) =>
  value === null ? '—' : `${value > 0 ? '+' : ''}${fmt(value, digits, suffix)}`

export function BatchesHistory() {
  const { data: batches, isLoading, error } = useQuery({ queryKey: ['batches', 'history'], queryFn: listBatchesWithDetails })

  const { data: equipmentProfiles } = useQuery({ queryKey: ['equipment-profiles'], queryFn: listEquipmentProfiles })

  // Efficacité calculée avec le retrait thermique du profil du brassin, comme sur sa fiche.
  const shrinkage = (id: string | null | undefined) => equipmentProfiles?.find((p) => p.id === id)?.thermalShrinkagePercent
  const rows = (batches ?? []).map((b) => batchHistoryRow(b, shrinkage(b.recipeSnapshot.equipmentProfileId)))
  const measured = rows.filter(hasData)
  const stats = historyStats(measured)
  const insights = historyInsights(stats, measured.length)
  const chartData = measured
    .filter((r) => r.mashEfficiency !== null || r.brewhouseEfficiency !== null)
    .map((r) => ({
      name: r.name,
      date: formatDate(r.date),
      mash: r.mashEfficiency === null ? null : Math.round(r.mashEfficiency),
      brewhouse: r.brewhouseEfficiency === null ? null : Math.round(r.brewhouseEfficiency),
      planned: r.plannedMashEfficiency,
    }))
  const chartValues = chartData.flatMap((d) => [d.mash, d.brewhouse, d.planned]).filter((v): v is number => v !== null)
  // Bornes rondes (multiples de 10) pour des graduations lisibles.
  const chartDomain: [number, number] = [Math.floor((Math.min(...chartValues) - 2) / 10) * 10, Math.ceil((Math.max(...chartValues) + 2) / 10) * 10]
  const chartTicks = Array.from({ length: (chartDomain[1] - chartDomain[0]) / 10 + 1 }, (_, i) => chartDomain[0] + i * 10)

  return (
    <div className="space-y-6">
      <div>
        <Link to="/batches" className="text-sm font-medium text-indigo-600 hover:underline">
          ← Mes brassins
        </Link>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Historique</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ce que vos brassins ont donné par rapport à leur recette : de quoi caler votre profil d’équipement et vos levures.
        </p>
      </div>
      {isLoading && <p className="text-slate-500">Chargement…</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}
      {batches && measured.length === 0 && (
        <p className="text-slate-500">
          Aucune mesure pour l’instant : notez densités et volumes pendant le Brew Day, ils apparaîtront ici.
        </p>
      )}

      {measured.length > 0 && (
        <>
          <section className="card" aria-label="Moyennes">
            <h2 className="section-title mb-3">En moyenne sur {measured.length} brassin{measured.length > 1 ? 's' : ''}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="Efficacité d’empâtage"
                value={fmt(stats.mashEfficiency, 0, ' %')}
                hint={stats.plannedMashEfficiency !== null ? `réglée ${fmt(stats.plannedMashEfficiency, 0, ' %')}` : undefined}
              />
              <Stat label="Rendement global" value={fmt(stats.brewhouseEfficiency, 0, ' %')} hint="grain → fermenteur" />
              <Stat label="Écart de DI" value={signed(stats.ogGapPoints, 0, ' pts')} hint="mesurée − prévue" />
              <Stat label="Écart d’atténuation" value={signed(stats.attenuationGap, 0, ' pts')} hint="mesurée − prévue" />
              <Stat label="Écart de volume" value={signed(stats.volumeGapL, 1, ' L')} hint="en fermenteur" />
              <Stat label="Alcool" value={fmt(stats.abv, 1, ' %')} hint="moyenne mesurée" />
            </div>
            {insights.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-700">
                {insights.map((insight) => (
                  <li key={insight} className="flex gap-2">
                    <span aria-hidden>💡</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {chartData.length >= 2 && (
            <section className="card" aria-label="Efficacité par brassin">
              <h2 className="section-title mb-3">Efficacité par brassin</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={chartDomain} ticks={chartTicks} tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v} %`} />
                    <Tooltip
                      formatter={(value) => `${value} %`}
                      labelFormatter={(_, payload) => (payload?.[0]?.payload as { name?: string } | undefined)?.name ?? ''}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="mash" name="Empâtage" stroke="#4f46e5" strokeWidth={2} connectNulls isAnimationActive={false} />
                    <Line type="monotone" dataKey="brewhouse" name="Global" stroke="#d97706" strokeWidth={2} connectNulls isAnimationActive={false} />
                    <Line type="stepAfter" dataKey="planned" name="Réglée" stroke="#94a3b8" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <section className="card p-0" aria-label="Brassins">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm tabular-nums">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Brassin</th>
                    <th className="px-3 py-3 font-semibold">DI</th>
                    <th className="px-3 py-3 font-semibold">DF</th>
                    <th className="px-3 py-3 font-semibold">Alcool</th>
                    <th className="px-3 py-3 font-semibold">Atténuation</th>
                    <th className="px-3 py-3 font-semibold">Eff. empâtage</th>
                    <th className="px-3 py-3 font-semibold">Fermenteur</th>
                    <th className="px-3 py-3 font-semibold">pH</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...measured].reverse().map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="min-w-36 px-4 py-3">
                        <Link to={`/batches/${r.id}`} className="font-semibold text-indigo-600 hover:underline">
                          {r.name}
                        </Link>
                        <span className="block text-xs text-slate-500">
                          {formatDate(r.date)} · {BATCH_STATUS_LABELS[r.status]}
                        </span>
                        {r.yeastName && <span className="block text-xs text-slate-400">{r.yeastName}</span>}
                        {(r.mashEfficiency !== null || r.attenuation !== null) && (
                          <Link to={`/batches/${r.id}`} className="mt-1 block text-xs text-indigo-600 hover:underline">
                            Reporter les résultats →
                          </Link>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <Measured value={r.og} planned={r.plannedOg} digits={3} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <Measured value={r.fg} planned={r.plannedFg} digits={3} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <Measured value={r.abv} planned={r.plannedAbv} digits={1} suffix=" %" />
                        {r.fermentationAbv !== null && (
                          <span className="block text-xs text-slate-400" title="Sucre ajouté en fermentation : absent de la DI mesurée, mais fermenté">
                            dont {fmt(r.fermentationAbv, 1, ' %')} de sucre
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <Measured value={r.attenuation} planned={r.plannedAttenuation} digits={0} suffix=" %" />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <Measured value={r.mashEfficiency} planned={r.plannedMashEfficiency} digits={0} suffix=" %" />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <Measured value={r.fermenterVolumeL} planned={r.plannedVolumeL} digits={1} suffix=" L" />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <Measured value={r.mashPh} planned={null} digits={2} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
