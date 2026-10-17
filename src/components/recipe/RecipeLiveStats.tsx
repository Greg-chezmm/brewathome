import type { StyleMatchResult } from '@/lib/brew-calc/style-matching'
import type { RecipeStats } from '@/lib/brew-calc/types'
import { BeerGlass } from '@/components/BeerGlass'
import { InfoTooltip } from '@/components/InfoTooltip'

type StatKey = keyof RecipeStats

const STATS: { key: StatKey; label: string; format: (v: number) => string; hint: string }[] = [
  { key: 'og', label: 'DI', format: (v) => v.toFixed(3), hint: 'Densité initiale : la quantité de sucres dissous avant fermentation.' },
  { key: 'fg', label: 'DF', format: (v) => v.toFixed(3), hint: 'Densité finale estimée, d’après l’atténuation de la levure et l’empâtage.' },
  { key: 'abv', label: 'Alcool', format: (v) => `${v.toFixed(1)} %`, hint: 'Alcool estimé, d’après la DI et la DF.' },
  { key: 'ibu', label: 'IBU', format: (v) => v.toFixed(0), hint: 'Amertume, selon la formule choisie.' },
  { key: 'srm', label: 'SRM', format: (v) => v.toFixed(1), hint: 'Couleur : 2–4 blonde, 10–17 ambrée, 20–30 brune, 35+ noire.' },
]

const display = (value: number, format: (v: number) => string) => (Number.isFinite(value) ? format(value) : '—')

/**
 * Chiffres clés recalculés à chaque saisie : barre fixée au-dessus des onglets sur mobile,
 * collée en haut de l'écran sur PC. Vert/rouge : dans la plage du style choisi ou non.
 */
export function RecipeStatsBar({
  stats,
  styleMatch,
  buGu,
}: {
  stats: RecipeStats
  styleMatch: StyleMatchResult | null
  buGu: number | null
}) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-[0_-4px_12px_-6px_rgba(15,23,42,0.15)] backdrop-blur lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-0 lg:rounded-2xl lg:border lg:px-4 lg:py-3 lg:shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center gap-2 sm:gap-4">
        <BeerGlass srm={Number.isFinite(stats.srm) ? stats.srm : null} size={36} />
        <dl className="grid flex-1 grid-cols-5 gap-1 sm:gap-3">
          {STATS.map(({ key, label, format }) => {
            const ok = styleMatch?.[key]
            return (
              <div key={key} className="min-w-0 text-center sm:text-left">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{label}</dt>
                <dd
                  className={`truncate text-sm font-bold tabular-nums sm:text-base ${
                    ok === undefined ? 'text-slate-900' : ok ? 'text-green-700' : 'text-red-600'
                  }`}
                >
                  {display(stats[key], format)}
                </dd>
              </div>
            )
          })}
        </dl>
        {buGu !== null && (
          <div className="hidden text-right sm:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">BU:GU</p>
            <p className="text-base font-bold tabular-nums text-slate-900">{buGu.toFixed(2)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export interface StyleRanges {
  name: string
  og: [number, number]
  fg: [number, number]
  ibu: [number, number]
  srm: [number, number]
  abv: [number, number]
}

/** Position de chaque chiffre de la recette dans la plage du style, en barres. */
export function StyleRangeBars({ stats, style, buGu }: { stats: RecipeStats; style: StyleRanges; buGu: number | null }) {
  return (
    <div className="card space-y-3">
      <div>
        <h2 className="section-title flex items-center">
          Face au style
          <InfoTooltip text="La bande colorée est la plage du style BJCP, le point votre recette. Hors plage n'est pas une faute : c'est un repère, pas une règle." />
        </h2>
        <p className="text-sm text-slate-500">{style.name}</p>
      </div>
      <div className="space-y-2.5">
        {STATS.map(({ key, label, format, hint }) => (
          <RangeBar key={key} label={label} hint={hint} value={stats[key]} range={style[key]} format={format} />
        ))}
      </div>
      {buGu !== null && (
        <p className="text-xs text-slate-500">
          BU:GU {buGu.toFixed(2)} —{' '}
          {buGu < 0.4 ? 'plutôt maltée' : buGu < 0.6 ? 'équilibrée' : buGu < 0.85 ? 'plutôt amère' : 'très amère'} (rapport
          IBU / densité).
        </p>
      )}
    </div>
  )
}

function RangeBar({
  label,
  hint,
  value,
  range: [min, max],
  format,
}: {
  label: string
  hint: string
  value: number
  range: [number, number]
  format: (v: number) => string
}) {
  // Échelle : la plage du style au milieu, avec une demi-plage de marge de chaque côté.
  const span = Math.max(max - min, Number.EPSILON)
  const lo = min - span / 2
  const hi = max + span / 2
  const position = (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))
  const known = Number.isFinite(value)
  const inRange = known && value >= min && value <= max

  return (
    <div className="grid grid-cols-[4.5rem_1fr_4rem] items-center gap-3 text-sm">
      <span className="flex items-center text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        <InfoTooltip text={hint} />
      </span>
      <div className="relative h-2 rounded-full bg-slate-100" title={`${format(min)} – ${format(max)}`}>
        <div className="absolute inset-y-0 rounded-full bg-green-200" style={{ left: `${position(min)}%`, right: `${100 - position(max)}%` }} />
        {known && (
          <div
            className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${
              inRange ? 'bg-green-600' : 'bg-red-500'
            }`}
            style={{ left: `${position(value)}%` }}
          />
        )}
      </div>
      <span className={`text-right font-semibold tabular-nums ${inRange ? 'text-green-700' : 'text-red-600'}`}>
        {known ? format(value) : '—'}
      </span>
    </div>
  )
}
