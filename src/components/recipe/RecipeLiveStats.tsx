import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
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

export interface StyleRanges {
  name: string
  og: [number, number]
  fg: [number, number]
  ibu: [number, number]
  srm: [number, number]
  abv: [number, number]
}

interface LiveStatsProps {
  stats: RecipeStats
  styleMatch: StyleMatchResult | null
  style: StyleRanges | null
  buGu: number | null
}

function statTone(ok: boolean | undefined): string {
  return ok === undefined ? 'text-slate-900' : ok ? 'text-green-700' : 'text-red-600'
}

/**
 * Écrans larges : colonne de droite collée en haut de l'écran, toujours visible pendant la
 * saisie — chiffres clés, position de chacun dans la plage du style et BU:GU.
 */
export function RecipeStatsPanel({ stats, styleMatch, style, buGu }: LiveStatsProps) {
  return (
    <aside className="hidden xl:sticky xl:top-6 xl:block">
      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-3">
          <BeerGlass srm={Number.isFinite(stats.srm) ? stats.srm : null} size={48} />
          <div className="min-w-0">
            <p className="section-title">Votre bière</p>
            <p className="truncate text-sm text-slate-500">{style ? style.name : 'Aucun style choisi'}</p>
          </div>
        </div>
        {style ? (
          <StyleRangeList stats={stats} style={style} />
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            {STATS.map(({ key, label, format }) => (
              <div key={key}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                <dd className="text-lg font-bold tabular-nums text-slate-900">{display(stats[key], format)}</dd>
              </div>
            ))}
          </dl>
        )}
        <BuGu buGu={buGu} />
        {!style && <p className="text-xs text-slate-500">Choisissez un style BJCP pour voir où se situe votre recette.</p>}
        {styleMatch && (
          <p className={`text-sm font-medium ${styleMatch.allMatch ? 'text-green-700' : 'text-orange-600'}`}>
            {styleMatch.allMatch ? '✓ Dans toutes les plages du style' : '⚠ Hors plage sur certains critères'}
          </p>
        )}
      </div>
    </aside>
  )
}

/**
 * Écrans plus étroits : barre des chiffres clés, fixée au-dessus des onglets sur mobile et
 * collée en haut sur PC ; elle se déplie pour montrer la position dans le style.
 */
export function RecipeStatsBar({ stats, styleMatch, style, buGu }: LiveStatsProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 flex flex-col border-t border-slate-200 bg-white/95 px-3 py-2 shadow-[0_-4px_12px_-6px_rgba(15,23,42,0.15)] backdrop-blur lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-0 lg:rounded-2xl lg:border lg:px-4 lg:py-3 lg:shadow-sm xl:hidden">
      {open && style && (
        // Barre en bas (mobile) : le détail s'ouvre au-dessus ; barre en haut (PC) : en dessous.
        <div className="mb-3 max-h-[50vh] w-full space-y-2 overflow-y-auto border-b border-slate-100 pb-3 lg:order-last lg:mb-0 lg:mt-3 lg:border-b-0 lg:border-t lg:pb-0 lg:pt-3">
          <p className="text-sm font-semibold text-slate-700">{style.name}</p>
          <StyleRangeList stats={stats} style={style} />
          <BuGu buGu={buGu} />
        </div>
      )}
      <div className="flex w-full items-center gap-2 sm:gap-4">
        <BeerGlass srm={Number.isFinite(stats.srm) ? stats.srm : null} size={36} />
        <dl className="grid flex-1 grid-cols-5 gap-1 sm:gap-3">
          {STATS.map(({ key, label, format }) => (
            <div key={key} className="min-w-0 text-center sm:text-left">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{label}</dt>
              <dd className={`truncate text-sm font-bold tabular-nums sm:text-base ${statTone(styleMatch?.[key])}`}>
                {display(stats[key], format)}
              </dd>
            </div>
          ))}
        </dl>
        {style && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
            aria-expanded={open}
            aria-label={open ? 'Masquer la position dans le style' : 'Voir la position dans le style'}
          >
            {open ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        )}
      </div>
    </div>
  )
}

function BuGu({ buGu }: { buGu: number | null }) {
  if (buGu === null) return null
  return (
    <p className="flex items-center text-xs text-slate-500">
      BU:GU {buGu.toFixed(2)} —{' '}
      {buGu < 0.4 ? 'plutôt maltée' : buGu < 0.6 ? 'équilibrée' : buGu < 0.85 ? 'plutôt amère' : 'très amère'}
      <InfoTooltip text="Rapport amertume / densité (IBU ÷ points de densité) : autour de 0,5 la bière est équilibrée, en dessous de 0,4 maltée, au-dessus de 0,8 très amère." />
    </p>
  )
}

/** Position de chaque chiffre de la recette dans la plage du style, en barres. */
export function StyleRangeList({ stats, style }: { stats: RecipeStats; style: StyleRanges }) {
  return (
    <div className="space-y-2.5">
      {STATS.map(({ key, label, format, hint }) => (
        <RangeBar key={key} label={label} hint={hint} value={stats[key]} range={style[key]} format={format} />
      ))}
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
    <div className="grid grid-cols-[3.75rem_1fr_3.5rem] items-center gap-2 text-sm">
      <span className="flex items-center text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        <InfoTooltip text={`${hint} Plage du style : ${format(min)} – ${format(max)}.`} />
      </span>
      <div className="relative h-2 rounded-full bg-slate-100" title={`${format(min)} – ${format(max)}`}>
        <div className="absolute inset-y-0 rounded-full bg-green-200" style={{ left: `${position(min)}%`, right: `${100 - position(max)}%` }} />
        {known && (
          <div
            className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow transition-[left] duration-300 ${
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
