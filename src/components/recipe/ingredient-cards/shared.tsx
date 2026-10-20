import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, BookOpen, Plus, Trash2 } from 'lucide-react'
import { findByName } from '@/data/ingredients'
import { MAX_NAME_SUGGESTIONS } from './helpers'
import { InfoTooltip } from '@/components/InfoTooltip'

// ——— Briques communes ———

/** Couleur de la pastille d'icône et du liseré de chaque type de section. */
export type SectionAccent = 'amber' | 'green' | 'violet' | 'orange' | 'sky' | 'slate'

const SECTION_ACCENTS: Record<SectionAccent, string> = {
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
  violet: 'bg-violet-100 text-violet-700',
  orange: 'bg-orange-100 text-orange-700',
  sky: 'bg-sky-100 text-sky-700',
  slate: 'bg-slate-200 text-slate-600',
}

/** Section d'ingrédients : en-tête (icône + titre + résumé), liste de cartes, bouton d'ajout. */
export function IngredientSection({
  title,
  hint,
  summary,
  icon,
  accent = 'slate',
  addLabel,
  onAdd,
  empty,
  emptyTone = 'muted',
  tools,
  children,
}: {
  title: string
  hint: string
  summary?: string
  /** Icône de la section (blé, houblon…), affichée dans une pastille colorée. */
  icon?: ReactNode
  accent?: SectionAccent
  addLabel: string
  onAdd: () => void
  empty: string
  /** Ton du message « vide » : 'warn' (ambre) quand l'absence est un problème (ex. pas de levure). */
  emptyTone?: 'muted' | 'warn'
  /** Outil affiché sous le titre (ex. viser une DI). */
  tools?: ReactNode
  children: ReactNode[]
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${SECTION_ACCENTS[accent]}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="section-title flex items-center">
            {title}
            <InfoTooltip text={hint} />
          </h2>
          {summary && <p className="text-sm text-slate-500">{summary}</p>}
        </div>
      </div>
      {tools && <div>{tools}</div>}
      {children.length > 0 ? (
        <ul className="space-y-3">{children}</ul>
      ) : (
        <p
          className={`rounded-2xl border border-dashed px-4 py-5 text-center text-sm ${
            emptyTone === 'warn' ? 'border-amber-300 bg-amber-50 font-medium text-amber-800' : 'border-slate-300 bg-white text-slate-400'
          }`}
        >
          {emptyTone === 'warn' && <span aria-hidden>⚠ </span>}
          {empty}
        </p>
      )}
      <button type="button" onClick={onAdd} className="btn-secondary w-full border-dashed">
        <Plus size={16} />
        {addLabel}
      </button>
    </section>
  )
}

export function Card({ children }: { children: ReactNode }) {
  return <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5">{children}</li>
}

/** Nom de l'ingrédient, avec les suggestions (vos ingrédients puis la bibliothèque), le déplacement et la suppression. */
export function NameRow<T extends { name: string }>({
  value,
  placeholder,
  suggestions,
  onChange,
  onPick,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  value: string
  placeholder: string
  suggestions: T[]
  onChange: (name: string) => void
  /** Nom choisi parmi les suggestions : reprend ses caractéristiques. */
  onPick: (item: T) => void
  /** Absent : l'élément ne peut pas être retiré (ex. dernier palier d'empâtage). */
  onRemove?: () => void
  /** Absents en tête (ou en fin) de liste. */
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  const listId = useId()
  // Datalist courte et filtrée par la saisie : sur mobile, la liste complète recouvre le clavier.
  const query = value.trim().toLowerCase()
  const shownSuggestions = (query ? suggestions.filter((s) => s.name.toLowerCase().includes(query)) : suggestions).slice(
    0,
    MAX_NAME_SUGGESTIONS,
  )
  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => {
          const picked = findByName(suggestions, e.target.value)
          if (picked && picked.name.toLowerCase() !== value.trim().toLowerCase()) onPick(picked)
          else onChange(e.target.value)
        }}
        list={listId}
        placeholder={placeholder}
        aria-label="Nom"
        className="field-input min-w-0 flex-1 font-semibold"
      />
      <datalist id={listId}>
        {shownSuggestions.map((s) => (
          <option key={s.name} value={s.name} />
        ))}
      </datalist>
      {(onMoveUp || onMoveDown) && (
        <div className="flex shrink-0">
          <MoveButton onClick={onMoveUp} label="Monter">
            <ArrowUp size={16} />
          </MoveButton>
          <MoveButton onClick={onMoveDown} label="Descendre">
            <ArrowDown size={16} />
          </MoveButton>
        </div>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          aria-label="Retirer"
        >
          <Trash2 size={18} />
        </button>
      )}
    </div>
  )
}

export function MoveButton({ onClick, label, children }: { onClick?: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={label}
      title={label}
      className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 flex items-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {hint && <InfoTooltip text={hint} />}
      </span>
      {children}
    </label>
  )
}

/** Champ numérique : un champ vidé pendant la saisie vaut NaN (affiché vide, compté 0 dans les calculs). */
export function NumberInput({
  value,
  onChange,
  step,
  integer = false,
  placeholder,
}: {
  value: number | undefined
  onChange: (value: number) => void
  step: string
  integer?: boolean
  placeholder?: string
}) {
  return (
    <input
      type="number"
      inputMode={integer ? 'numeric' : 'decimal'}
      step={step}
      value={value !== undefined && Number.isFinite(value) ? value : ''}
      placeholder={placeholder}
      onChange={(e) => onChange(integer ? Number.parseInt(e.target.value, 10) : Number.parseFloat(e.target.value))}
      className="field-input tabular-nums"
    />
  )
}

/** Poids saisi en kg ou en g au choix (toujours enregistré en kg) ; en grammes d'office sous 1 kg. */
export function WeightInput({ valueKg, onChange }: { valueKg: number; onChange: (kg: number) => void }) {
  const [unit, setUnit] = useState<'kg' | 'g'>(() => (valueKg > 0 && valueKg < 1 ? 'g' : 'kg'))
  // Arrondi au dixième de gramme pour ne pas afficher 299,99999 g.
  const shown = unit === 'g' && Number.isFinite(valueKg) ? Math.round(valueKg * 10000) / 10 : valueKg
  return (
    <div className="flex gap-1">
      <div className="min-w-0 flex-1">
        <NumberInput value={shown} step={unit === 'g' ? '1' : '0.01'} onChange={(value) => onChange(unit === 'g' ? value / 1000 : value)} />
      </div>
      <select
        aria-label="Unité de poids"
        value={unit}
        onChange={(e) => setUnit(e.target.value as 'kg' | 'g')}
        className="field-input w-auto shrink-0 px-2"
      >
        <option value="kg">kg</option>
        <option value="g">g</option>
      </select>
    </div>
  )
}

export function Chips({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex flex-wrap gap-1.5">{children}</div>
}

export function Chip({ children, tone = 'indigo' }: { children: ReactNode; tone?: 'indigo' | 'amber' | 'slate' }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-700',
    amber: 'bg-amber-50 text-amber-800',
    slate: 'bg-slate-100 text-slate-600',
  }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${tones[tone]}`}>{children}</span>
}

/** Fiche de la bibliothèque : ce qu'apporte l'ingrédient et comment le doser, avec un lien vers le guide. */
export function LibraryNote({ note, guide }: { note: string | undefined; guide?: { tab: 'malts' | 'hops' | 'yeasts'; name: string } }) {
  if (!note) return null
  const params = new URLSearchParams(guide && guide.tab !== 'malts' ? { tab: guide.tab, q: guide.name } : guide ? { q: guide.name } : {})
  return (
    <p className="mt-2 text-xs leading-relaxed text-slate-500">
      {note}
      {guide && (
        <>
          {' '}
          <Link
            to={`/ingredients?${params}`}
            className="inline-flex items-center gap-0.5 whitespace-nowrap font-medium text-indigo-600 hover:underline"
          >
            <BookOpen size={12} aria-hidden />
            Fiche et remplaçants
          </Link>
        </>
      )}
    </p>
  )
}

// ——— Fermentescibles ———
