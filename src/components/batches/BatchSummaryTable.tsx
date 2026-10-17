import type { SummaryRow } from '@/lib/brew-day/measurements'

const fmt = (value: number, decimals: number) =>
  decimals === 3 ? value.toFixed(3) : value.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

const withUnit = (value: number, row: SummaryRow) => `${fmt(value, row.decimals)}${row.unit ? ` ${row.unit}` : ''}`

/** Écart lisible : densités en points (0,001), le reste dans son unité. */
function formatDelta(row: SummaryRow, delta: number): string {
  const sign = delta > 0 ? '+' : '−'
  if (row.decimals === 3) return `${sign}${Math.round(Math.abs(delta) * 1000)}`
  return `${sign}${fmt(Math.abs(delta), row.decimals)}`
}

/** Résumé « Recette / Brassin » : ce qui était prévu, ce qui a été mesuré, et l'écart. */
export function BatchSummaryTable({ rows }: { rows: SummaryRow[] }) {
  const shown = rows.filter((row) => row.planned !== null || row.actual !== null)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500">
            <th className="py-1.5 font-medium">Mesure</th>
            <th className="py-1.5 text-right font-medium">Recette</th>
            <th className="py-1.5 text-right font-medium">Brassin</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => {
            const delta = row.planned !== null && row.actual !== null ? row.actual - row.planned : null
            const visibleDelta = delta !== null && Math.abs(delta) >= (row.decimals === 3 ? 0.0005 : 0.5 * 10 ** -row.decimals)
            return (
              <tr key={row.label} className="border-t border-slate-100">
                <td className="py-1.5 pr-2 text-slate-700">
                  {row.label}
                  {row.note && <span className="block text-xs text-slate-400">{row.note}</span>}
                </td>
                <td className="py-1.5 text-right text-slate-500">{row.planned !== null ? withUnit(row.planned, row) : '—'}</td>
                <td className="py-1.5 text-right font-medium text-slate-900">
                  {row.actual !== null ? withUnit(row.actual, row) : <span className="font-normal text-slate-400">—</span>}
                  {visibleDelta && (
                    <span className={`ml-1.5 text-xs ${delta! < 0 ? 'text-sky-600' : 'text-rose-600'}`}>
                      {formatDelta(row, delta!)}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
