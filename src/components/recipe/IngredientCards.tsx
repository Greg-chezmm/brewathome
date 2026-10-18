import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, BookOpen, FlaskConical, FlaskRound, Hop as HopIcon, Plus, Snowflake, Thermometer, Trash2, Wheat } from 'lucide-react'
import {
  FERMENTABLE_LIBRARY,
  findByName,
  HOP_LIBRARY,
  YEAST_LIBRARY,
  type LibraryFermentable,
  type LibraryHop,
  type LibraryYeast,
} from '@/data/ingredients'
import type { FermentableContribution } from '@/lib/brew-calc/contributions'
import {
  dryHopEvents,
  FERMENTATION_STEP_LABELS,
  FERMENTATION_STEP_TIPS,
  FERMENTATION_STEP_TYPES,
  fermentationSchedule,
  nextFermentationStep,
  totalFermentationDays,
  type FermentationStep,
  type FermentationStepType,
} from '@/lib/brew-calc/fermentation-profile'
import { fermentableUse } from '@/lib/brew-calc/gravity'
import {
  isMashOut,
  MASH_STEP_LIBRARY,
  MASH_STEP_ROLE_LABELS,
  mainMashStep,
  mashStepRole,
  mashStepTip,
  totalMashTimeMin,
  type MashStep,
} from '@/lib/brew-calc/mash'
import type { Fermentable, FermentableUse, Hop, HopForm, HopUse, OtherIngredient, Yeast, YeastAmountUnit } from '@/lib/brew-calc/types'
import type { IngredientHistory } from '@/lib/db/queries/ingredientHistory'
import { InfoTooltip } from '@/components/InfoTooltip'
import { formatWeightKg } from '@/lib/brew-calc/units'
import { checkYeastPitch, dryYeastSachetGrams } from '@/lib/brew-calc/yeast'
import { yeastPitchMessage } from './yeastPitch'

const HOP_USES: HopUse[] = ['first-wort', 'boil', 'whirlpool', 'dry-hop', 'mash']
const HOP_USE_LABELS: Record<HopUse, string> = {
  'first-wort': 'Premier moût',
  boil: 'Ébullition',
  whirlpool: 'Whirlpool',
  'dry-hop': 'Dry hop',
  mash: 'Empâtage',
}

const FERMENTABLE_USE_LABELS: Record<FermentableUse, string> = {
  mash: 'Empâtage',
  boil: 'Ébullition',
  fermentation: 'Fermentation',
}

const YEAST_UNIT_LABELS: Record<YeastAmountUnit, string> = { pkg: 'sachet(s)', g: 'g', ml: 'ml' }

const EMPTY_FERMENTABLE: Fermentable = { name: '', type: 'grain', amountKg: 1, colorLovibond: 3, yieldPercent: 80 }
const EMPTY_HOP: Hop = { name: '', amountG: 10, alphaAcidPercent: 10, timeMin: 60, use: 'boil', form: 'pellet' }
const EMPTY_YEAST: Yeast = { name: '', type: 'dry', style: 'ale', attenuationPercent: 75 }
const EMPTY_OTHER: OtherIngredient = { name: '', amount: '', timeMin: 10 }

const fmt = (value: number, digits = 0) => value.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits })

/** Nombre max de suggestions dans la datalist du nom : liste courte pour ne pas masquer le clavier (mobile). */
const MAX_NAME_SUGGESTIONS = 8

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
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-slate-400">{empty}</p>
      )}
      <button type="button" onClick={onAdd} className="btn-secondary w-full border-dashed">
        <Plus size={16} />
        {addLabel}
      </button>
    </section>
  )
}

function Card({ children }: { children: ReactNode }) {
  return <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5">{children}</li>
}

/** Boutons ↑/↓ d'une carte : déplace l'élément d'un cran (l'ordre est celui enregistré). */
function reorder<T>(list: T[], index: number, onChange: (list: T[]) => void) {
  const moveTo = (to: number) => () => {
    const next = [...list]
    const [item] = next.splice(index, 1)
    next.splice(to, 0, item)
    onChange(next)
  }
  return {
    onMoveUp: index > 0 ? moveTo(index - 1) : undefined,
    onMoveDown: index < list.length - 1 ? moveTo(index + 1) : undefined,
  }
}

/** Nom de l'ingrédient, avec les suggestions (vos ingrédients puis la bibliothèque), le déplacement et la suppression. */
function NameRow<T extends { name: string }>({
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

function MoveButton({ onClick, label, children }: { onClick?: () => void; label: string; children: ReactNode }) {
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

function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
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
function NumberInput({
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
function WeightInput({ valueKg, onChange }: { valueKg: number; onChange: (kg: number) => void }) {
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

function Chips({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex flex-wrap gap-1.5">{children}</div>
}

function Chip({ children, tone = 'indigo' }: { children: ReactNode; tone?: 'indigo' | 'amber' | 'slate' }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-700',
    amber: 'bg-amber-50 text-amber-800',
    slate: 'bg-slate-100 text-slate-600',
  }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${tones[tone]}`}>{children}</span>
}

/** Fiche de la bibliothèque : ce qu'apporte l'ingrédient et comment le doser, avec un lien vers le guide. */
function LibraryNote({ note, guide }: { note: string | undefined; guide?: { tab: 'malts' | 'hops' | 'yeasts'; name: string } }) {
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

/** Vos ingrédients d'abord (avec vos valeurs), puis la bibliothèque. */
function mergeSuggestions<T extends { name: string }>(history: T[] | undefined, library: T[]): T[] {
  const names = new Set((history ?? []).map((h) => h.name.toLowerCase()))
  return [...(history ?? []), ...library.filter((l) => !names.has(l.name.toLowerCase()))]
}

// ——— Fermentescibles ———

export function FermentableCards({
  fermentables,
  contributions,
  history,
  tools,
  onChange,
}: {
  fermentables: Fermentable[]
  contributions: FermentableContribution[]
  history: IngredientHistory | undefined
  tools?: ReactNode
  onChange: (fermentables: Fermentable[]) => void
}) {
  const suggestions = mergeSuggestions<LibraryFermentable>(history?.fermentables, FERMENTABLE_LIBRARY)
  const update = (index: number, patch: Partial<Fermentable>) =>
    onChange(fermentables.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  const totalKg = fermentables.reduce((sum, f) => sum + (Number.isFinite(f.amountKg) ? f.amountKg : 0), 0)

  return (
    <IngredientSection
      title="Fermentescibles"
      icon={<Wheat size={20} />}
      accent="amber"
      hint="Les ingrédients qui apportent les sucres (malts, extraits, sucres). Leur poids, leur couleur (°L) et leur rendement font la densité initiale et la couleur de la bière."
      summary={fermentables.length > 0 ? `${formatWeightKg(totalKg)} au total` : undefined}
      addLabel="Ajouter un fermentescible"
      onAdd={() => onChange([...fermentables, { ...EMPTY_FERMENTABLE }])}
      empty="Aucun fermentescible : commencez par un malt de base (Pilsner, Pale Ale…)."
      tools={tools}
    >
      {fermentables.map((f, i) => {
        const c = contributions[i]
        return (
          <Card key={i}>
            <NameRow
              value={f.name}
              placeholder="Malt, sucre, extrait…"
              suggestions={suggestions}
              onChange={(name) => update(i, { name })}
              onPick={({ name, type, colorLovibond, yieldPercent }) => update(i, { name, type, colorLovibond, yieldPercent })}
              onRemove={() => onChange(fermentables.filter((_, idx) => idx !== i))}
              {...reorder(fermentables, i, onChange)}
            />
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Field label="Poids">
                <WeightInput valueKg={f.amountKg} onChange={(amountKg) => update(i, { amountKg })} />
              </Field>
              <Field label="Type" hint="Grain : à empâter (l'efficacité s'applique). Extrait et sucre : dissous directement, sans perte d'empâtage.">
                <select value={f.type} onChange={(e) => update(i, { type: e.target.value as Fermentable['type'] })} className="field-input">
                  <option value="grain">Grain</option>
                  <option value="extract">Extrait</option>
                  <option value="sugar">Sucre</option>
                </select>
              </Field>
              <Field label="Couleur (°L)" hint="Couleur en degrés Lovibond, donnée par le malteur. Plus elle est haute, plus la bière fonce.">
                <NumberInput value={f.colorLovibond} step="0.1" onChange={(colorLovibond) => update(i, { colorLovibond })} />
              </Field>
              <Field label="Rendement (%)" hint="Part du sucre extractible, relative au sucre pur (100 %). Typique : 80 % pour un malt de base, 55–75 % pour les malts spéciaux.">
                <NumberInput value={f.yieldPercent} step="0.1" onChange={(yieldPercent) => update(i, { yieldPercent })} />
              </Field>
              <Field
                label="Ajout"
                hint="Empâtage : le sucre est extrait par la maische (l'efficacité s'applique). Ébullition : dissous dans le moût (extrait, sucre candi). Fermentation : versé dans le fermenteur, il compte dans l'alcool mais pas dans la DI mesurée."
                className="col-span-2 sm:col-span-1"
              >
                <select
                  value={fermentableUse(f)}
                  onChange={(e) => update(i, { use: e.target.value as FermentableUse })}
                  className="field-input"
                >
                  {(Object.keys(FERMENTABLE_USE_LABELS) as FermentableUse[]).map((u) => (
                    <option key={u} value={u}>
                      {FERMENTABLE_USE_LABELS[u]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {c && (
              <Chips>
                <Chip>{fmt(c.percentOfGrist)} % du grain</Chip>
                <Chip>+{fmt(c.gravityPoints)} pts de densité</Chip>
                {c.colorPercent >= 1 && <Chip tone="amber">{fmt(c.colorPercent)} % de la couleur</Chip>}
                {fermentableUse(f) === 'fermentation' && <Chip tone="slate">Hors DI mesurée</Chip>}
                {fermentableUse(f) === 'mash' && f.type !== 'grain' && <Chip tone="amber">Efficacité appliquée</Chip>}
              </Chips>
            )}
            <LibraryNote note={findByName(FERMENTABLE_LIBRARY, f.name)?.note} guide={{ tab: 'malts', name: f.name }} />
          </Card>
        )
      })}
    </IngredientSection>
  )
}

// ——— Houblons ———

export function HopCards({
  hops,
  ibuByHop,
  fermentationSteps,
  history,
  tools,
  onChange,
}: {
  hops: Hop[]
  /** IBU de chaque houblon (vide si la formule ne donne pas le détail). */
  ibuByHop: number[]
  /** Profil de fermentation : jour proposé d'office pour les dry hops. */
  fermentationSteps: FermentationStep[]
  history: IngredientHistory | undefined
  tools?: ReactNode
  onChange: (hops: Hop[]) => void
}) {
  const suggestions = mergeSuggestions<LibraryHop>(history?.hops, HOP_LIBRARY)
  const update = (index: number, patch: Partial<Hop>) => onChange(hops.map((h, i) => (i === index ? { ...h, ...patch } : h)))
  const totalG = hops.reduce((sum, h) => sum + (Number.isFinite(h.amountG) ? h.amountG : 0), 0)

  return (
    <IngredientSection
      title="Houblons"
      icon={<HopIcon size={20} />}
      accent="green"
      hint="Amertume (IBU), saveur et arôme. Un ajout long en ébullition donne surtout de l'amertume ; un ajout court, un whirlpool ou un dry hop donnent surtout des arômes."
      summary={hops.length > 0 ? `${fmt(totalG)} g au total` : undefined}
      addLabel="Ajouter un houblon"
      onAdd={() => onChange([...hops, { ...EMPTY_HOP }])}
      empty="Aucun houblon."
      tools={tools}
    >
      {hops.map((h, i) => {
        const ibu = ibuByHop[i]
        return (
          <Card key={i}>
            <NameRow
              value={h.name}
              placeholder="Variété de houblon"
              suggestions={suggestions}
              onChange={(name) => update(i, { name })}
              onPick={({ name, alphaAcidPercent }) => update(i, { name, alphaAcidPercent })}
              onRemove={() => onChange(hops.filter((_, idx) => idx !== i))}
              {...reorder(hops, i, onChange)}
            />
            <div className={`mt-3 grid grid-cols-2 gap-3 ${h.use === 'dry-hop' ? 'sm:grid-cols-4' : 'sm:grid-cols-6'}`}>
              <Field label="Poids (g)">
                <NumberInput value={h.amountG} step="1" onChange={(amountG) => update(i, { amountG })} />
              </Field>
              <Field label="Alpha (%)" hint="Teneur en acides alpha, indiquée sur le sachet : elle varie d'une récolte à l'autre.">
                <NumberInput value={h.alphaAcidPercent} step="0.1" onChange={(alphaAcidPercent) => update(i, { alphaAcidPercent })} />
              </Field>
              <Field
                label="Usage"
                hint="Premier moût : dès le remplissage de la cuve. Ébullition : compté en minutes avant la fin. Whirlpool : après l'arrêt du feu. Dry hop : dans le fermenteur."
                className="col-span-2 sm:col-span-1"
              >
                <select value={h.use} onChange={(e) => update(i, { use: e.target.value as HopUse })} className="field-input">
                  {HOP_USES.map((u) => (
                    <option key={u} value={u}>
                      {HOP_USE_LABELS[u]}
                    </option>
                  ))}
                </select>
              </Field>
              {h.use === 'dry-hop' ? (
                <>
                  <Field label="Jour d'ajout" hint="Jour de fermentation où ajouter le houblon (jour 0 = ensemencement). Vide : pour finir avec la fermentation primaire.">
                    <NumberInput
                      value={h.dryHopDay}
                      step="1"
                      integer
                      placeholder={String(dryHopEvents([{ ...h, dryHopDay: undefined }], fermentationSteps)[0]?.day ?? '')}
                      onChange={(day) => update(i, { dryHopDay: Number.isFinite(day) ? day : undefined })}
                    />
                  </Field>
                  <Field label="Durée (jours)" hint="Temps de contact avec la bière : 3 à 5 jours suffisent en général.">
                    <NumberInput
                      value={h.dryHopDays}
                      step="1"
                      integer
                      placeholder="4"
                      onChange={(days) => update(i, { dryHopDays: Number.isFinite(days) ? days : undefined })}
                    />
                  </Field>
                  <Field label="Temp. (°C)" hint="Température de la bière pendant le dry hop.">
                    <NumberInput
                      value={h.dryHopTempC}
                      step="0.5"
                      placeholder="18"
                      onChange={(temp) => update(i, { dryHopTempC: Number.isFinite(temp) ? temp : undefined })}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field
                    label={h.use === 'whirlpool' ? 'Infusion (min)' : 'Temps (min)'}
                    hint={
                      h.use === 'whirlpool'
                        ? "Durée de l'infusion après l'arrêt du feu."
                        : "Minutes avant la fin de l'ébullition : 60 = début d'une ébullition d'une heure (amertume), 5 = fin (arômes)."
                    }
                  >
                    <NumberInput value={h.timeMin} step="1" integer onChange={(timeMin) => update(i, { timeMin })} />
                  </Field>
                  {h.use === 'whirlpool' && (
                    <Field label="Temp. (°C)" hint="Température du moût pendant l'infusion : 80 °C par défaut. Plus chaud, plus d'amertume.">
                      <NumberInput
                        value={h.temperatureC}
                        step="0.5"
                        placeholder="80"
                        onChange={(temp) => update(i, { temperatureC: Number.isFinite(temp) ? temp : undefined })}
                      />
                    </Field>
                  )}
                </>
              )}
              <Field label="Forme" hint="Les pellets libèrent leurs acides alpha plus vite que les cônes : +10 % d'amertume.">
                <select value={h.form ?? 'pellet'} onChange={(e) => update(i, { form: e.target.value as HopForm })} className="field-input">
                  <option value="pellet">Pellets</option>
                  <option value="leaf">Cônes</option>
                </select>
              </Field>
            </div>
            <Chips>
              {ibu !== undefined && (h.use === 'dry-hop' || h.use === 'mash' ? (
                <Chip tone="slate">Arômes, pas d’amertume</Chip>
              ) : (
                <Chip>{fmt(ibu, 1)} IBU</Chip>
              ))}
              {h.use === 'dry-hop' && h.dryHopDay !== undefined && Number.isFinite(h.dryHopDay) && <Chip tone="slate">Jour {h.dryHopDay}</Chip>}
              {h.use === 'dry-hop' && h.dryHopDays !== undefined && <Chip tone="slate">{h.dryHopDays} j en fermenteur</Chip>}
            </Chips>
            <LibraryNote note={findByName(HOP_LIBRARY, h.name)?.note} guide={{ tab: 'hops', name: h.name }} />
          </Card>
        )
      })}
    </IngredientSection>
  )
}

// ——— Levures ———

export function YeastCards({
  yeasts,
  attenuationPercent,
  fg,
  og,
  volumeL,
  mashTempC,
  history,
  onChange,
}: {
  yeasts: Yeast[]
  /** Atténuation retenue par le calcul (levure principale, ajustée par l'empâtage). */
  attenuationPercent: number
  fg: number
  /** DI et volume en fermenteur : base de la quantité de levure à ensemencer. */
  og: number
  volumeL: number
  mashTempC: number
  history: IngredientHistory | undefined
  onChange: (yeasts: Yeast[]) => void
}) {
  const suggestions = mergeSuggestions<LibraryYeast>(history?.yeasts, YEAST_LIBRARY)
  const update = (index: number, patch: Partial<Yeast>) => onChange(yeasts.map((y, i) => (i === index ? { ...y, ...patch } : y)))

  return (
    <IngredientSection
      title="Levures"
      icon={<FlaskConical size={20} />}
      accent="violet"
      hint="La levure transforme les sucres en alcool et CO₂. Son atténuation (part des sucres consommés) fixe la densité finale, donc l'alcool et la sécheresse."
      addLabel="Ajouter une levure"
      onAdd={() => onChange([...yeasts, { ...EMPTY_YEAST }])}
      empty="Aucune levure : ajoutez celle que vous ensemencerez (sinon le calcul suppose 75 % d'atténuation)."
    >
      {yeasts.map((y, i) => {
        const pitch = i === 0 && og > 1 && volumeL > 0 ? yeastPitchMessage(checkYeastPitch(y, volumeL, og)) : null
        return (
        <Card key={i}>
          <NameRow
            value={y.name}
            placeholder="Souche de levure"
            suggestions={suggestions}
            onChange={(name) => update(i, { name })}
            onPick={({ name, type, style, attenuationPercent: attenuation }) => update(i, { name, type, style, attenuationPercent: attenuation })}
            onRemove={() => onChange(yeasts.filter((_, idx) => idx !== i))}
            {...reorder(yeasts, i, onChange)}
          />
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Quantité" hint="La quantité conseillée dépend du volume et de la DI : plus la bière est forte, plus il faut de levure (le double en lager). Repère : 1 sachet sec pour 20 L d'ale à moins de 1.060. Liquide : un sachet/tube neuf ≈ 100 milliards de cellules.">
              <div className="flex gap-1">
                <div className="min-w-0 flex-1">
                  <NumberInput
                    value={y.amount}
                    step={y.amountUnit === 'pkg' || !y.amountUnit ? '0.5' : '1'}
                    placeholder="1"
                    onChange={(amount) =>
                      update(i, { amount: Number.isFinite(amount) ? amount : undefined, amountUnit: y.amountUnit ?? 'pkg' })
                    }
                  />
                </div>
                <select
                  aria-label="Unité de levure"
                  value={y.amountUnit ?? 'pkg'}
                  onChange={(e) => update(i, { amountUnit: e.target.value as YeastAmountUnit })}
                  className="field-input w-auto shrink-0 px-2"
                >
                  {(Object.keys(YEAST_UNIT_LABELS) as YeastAmountUnit[]).map((u) => (
                    <option key={u} value={u}>
                      {YEAST_UNIT_LABELS[u]}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
            {y.type === 'dry' && (y.amountUnit ?? 'pkg') === 'pkg' && (
              <Field label="Poids d'un sachet (g)" hint="Indiqué sur le sachet : 11,5 g chez Fermentis (SafAle, SafLager), 11 g chez Lallemand (LalBrew), 10 g chez Mangrove Jack's. Laissé vide, il est déduit du nom de la levure.">
                <NumberInput
                  value={y.sachetG}
                  step="0.5"
                  placeholder={fmt(dryYeastSachetGrams(y.name), 1)}
                  onChange={(sachetG) => update(i, { sachetG: Number.isFinite(sachetG) && sachetG > 0 ? sachetG : undefined })}
                />
              </Field>
            )}
            <Field label="Type">
              <select value={y.type} onChange={(e) => update(i, { type: e.target.value as Yeast['type'] })} className="field-input">
                <option value="dry">Sèche</option>
                <option value="liquid">Liquide</option>
              </select>
            </Field>
            <Field label="Style" hint="Ale : fermentation haute, 16–22 °C. Lager : fermentation basse, 8–14 °C, demande plus de levure.">
              <select value={y.style} onChange={(e) => update(i, { style: e.target.value as Yeast['style'] })} className="field-input">
                <option value="ale">Ale</option>
                <option value="lager">Lager</option>
              </select>
            </Field>
            <Field label="Atténuation (%)" hint="Donnée par le fabricant. Elle est ajustée selon la température d'empâtage dans le calcul.">
              <NumberInput value={y.attenuationPercent} step="0.5" onChange={(attenuationPercent) => update(i, { attenuationPercent })} />
            </Field>
          </div>
          <Chips>
            {i === 0 ? (
              <>
                <Chip>DF estimée {Number.isFinite(fg) ? fg.toFixed(3) : '—'}</Chip>
                {pitch && <Chip tone={pitch.warning ? 'amber' : 'slate'}>{pitch.text}</Chip>}
                {Number.isFinite(attenuationPercent) && Math.abs(attenuationPercent - y.attenuationPercent) >= 0.05 && (
                  <Chip tone="amber">
                    {fmt(attenuationPercent, 1)} % retenus avec un empâtage à {fmt(mashTempC, 1)} °C
                  </Chip>
                )}
              </>
            ) : (
              <Chip tone="slate">Seule la première levure compte dans le calcul (↑ pour la choisir)</Chip>
            )}
          </Chips>
          <LibraryNote note={findByName(YEAST_LIBRARY, y.name)?.note} guide={{ tab: 'yeasts', name: y.name }} />
        </Card>
        )
      })}
    </IngredientSection>
  )
}

// ——— Empâtage ———

/** Nouveau palier : avant le mash-out s'il y en a un, 5 °C au-dessus du précédent (72 °C au plus). */
function withNewMashStep(steps: MashStep[]): MashStep[] {
  const mashOutIndex = steps.findIndex((_, i) => isMashOut(steps, i))
  const at = mashOutIndex === -1 ? steps.length : mashOutIndex
  const previous = steps[at - 1]
  const tempC = previous && Number.isFinite(previous.tempC) ? Math.min(72, previous.tempC + 5) : 67
  return [...steps.slice(0, at), { name: 'Palier', tempC, timeMin: 15 }, ...steps.slice(at)]
}

export function MashStepCards({ steps, onChange }: { steps: MashStep[]; onChange: (steps: MashStep[]) => void }) {
  const update = (index: number, patch: Partial<MashStep>) => onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  const main = mainMashStep(steps)

  return (
    <IngredientSection
      title="Empâtage"
      icon={<Thermometer size={20} />}
      accent="orange"
      hint="Les paliers de température de la maische, dans l'ordre. Le palier principal (le plus long, hors mash-out) décide de la fermentescibilité du moût : c'est lui qui ajuste l'atténuation estimée. Au Brew Day, chaque palier devient une étape minutée."
      summary={`${steps.length} palier${steps.length > 1 ? 's' : ''} · ${fmt(totalMashTimeMin(steps))} min au total`}
      tools={
        <Link to="/ingredients?tab=mash-water" className="text-sm font-medium text-indigo-600 hover:underline">
          Guide : températures et profils d’empâtage
        </Link>
      }
      addLabel="Ajouter un palier"
      onAdd={() => onChange(withNewMashStep(steps))}
      empty="Aucun palier."
    >
      {steps.map((s, i) => {
        const known = Number.isFinite(s.tempC)
        const role = known ? mashStepRole(s.tempC) : null
        return (
          <Card key={i}>
            <NameRow
              value={s.name}
              placeholder="Nom du palier"
              suggestions={MASH_STEP_LIBRARY}
              onChange={(name) => update(i, { name })}
              onPick={({ name, tempC, timeMin }) => update(i, { name, tempC, timeMin })}
              onRemove={steps.length > 1 ? () => onChange(steps.filter((_, idx) => idx !== i)) : undefined}
              {...reorder(steps, i, onChange)}
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Température (°C)" hint="Température à atteindre et à maintenir au cœur de la maische.">
                <NumberInput value={s.tempC} step="0.5" onChange={(tempC) => update(i, { tempC })} />
              </Field>
              <Field label="Durée (min)" hint="Temps de maintien une fois la température atteinte.">
                <NumberInput value={s.timeMin} step="1" integer onChange={(timeMin) => update(i, { timeMin })} />
              </Field>
            </div>
            {role && (
              <Chips>
                <Chip tone={role === 'mash-out' ? 'slate' : 'indigo'}>{MASH_STEP_ROLE_LABELS[role]}</Chip>
                {s === main && steps.length > 1 && <Chip tone="amber">Palier principal : règle l’atténuation</Chip>}
              </Chips>
            )}
            {known && <LibraryNote note={mashStepTip(s.tempC)} />}
          </Card>
        )
      })}
    </IngredientSection>
  )
}

// ——— Fermentation ———

/** Volumes de CO₂ usuels, pour choisir la carbonatation. */
const CARBONATION_HINT =
  'Volumes de CO₂ dissous dans la bière en bouteille. Ales anglaises et stouts : 1,8–2,2 ; pale ales et IPA : 2,2–2,6 ; lagers : 2,4–2,7 ; belges : 2,6–3,2 ; blanches et weizen : 3–4 (bouteilles épaisses). Repris par le calcul de resucrage.'

export function FermentationStepCards({
  steps,
  hops,
  carbonationVols,
  onChange,
  onCarbonationChange,
}: {
  steps: FermentationStep[]
  hops: Hop[]
  carbonationVols: number | null
  onChange: (steps: FermentationStep[]) => void
  onCarbonationChange: (vols: number | null) => void
}) {
  const update = (index: number, patch: Partial<FermentationStep>) => onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  const schedule = fermentationSchedule(steps)
  const dryHops = dryHopEvents(hops, steps)
  const total = totalFermentationDays(steps)

  return (
    <IngredientSection
      title="Fermentation"
      icon={<Snowflake size={20} />}
      accent="sky"
      hint="Le profil de température après l'ensemencement : fermentation primaire, éventuellement secondaire, garde et cold crash. Il est repris dans le suivi de fermentation du brassin, avec les jours de dry hop."
      summary={steps.length > 0 ? `${steps.length} étape${steps.length > 1 ? 's' : ''} · ${fmt(total)} jours avant l'embouteillage` : undefined}
      addLabel="Ajouter une étape"
      onAdd={() => onChange([...steps, nextFermentationStep(steps)])}
      empty="Aucun profil : ajoutez au moins la fermentation primaire (18 °C pendant 14 jours pour une ale)."
      tools={
        <div className="max-w-56">
          <Field label="Carbonatation (vol. CO₂)" hint={CARBONATION_HINT}>
            <NumberInput
              value={carbonationVols ?? undefined}
              step="0.1"
              placeholder="2,4"
              onChange={(vols) => onCarbonationChange(Number.isFinite(vols) ? vols : null)}
            />
          </Field>
        </div>
      }
    >
      {steps.map((s, i) => {
        const at = schedule[i]
        const hopsHere = dryHops.filter((d) => d.day >= at.startDay && (d.day < at.endDay || (i === steps.length - 1 && d.day === at.endDay)))
        return (
          <Card key={i}>
            <div className="flex items-center gap-2">
              <select
                value={s.type}
                aria-label="Étape"
                onChange={(e) => update(i, { type: e.target.value as FermentationStepType })}
                className="field-input min-w-0 flex-1 font-semibold"
              >
                {FERMENTATION_STEP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FERMENTATION_STEP_LABELS[t]}
                  </option>
                ))}
              </select>
              {steps.length > 1 && (
                <div className="flex shrink-0">
                  <MoveButton onClick={reorder(steps, i, onChange).onMoveUp} label="Monter">
                    <ArrowUp size={16} />
                  </MoveButton>
                  <MoveButton onClick={reorder(steps, i, onChange).onMoveDown} label="Descendre">
                    <ArrowDown size={16} />
                  </MoveButton>
                </div>
              )}
              <button
                type="button"
                onClick={() => onChange(steps.filter((_, idx) => idx !== i))}
                className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label="Retirer"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Température (°C)">
                <NumberInput value={s.tempC} step="0.5" onChange={(tempC) => update(i, { tempC })} />
              </Field>
              <Field label="Durée (jours)">
                <NumberInput value={s.days} step="1" integer onChange={(days) => update(i, { days })} />
              </Field>
            </div>
            <Chips>
              <Chip tone="slate">
                Jour {fmt(at.startDay)} → {fmt(at.endDay)}
              </Chip>
              {hopsHere.map((d, k) => (
                <Chip key={k}>
                  Dry hop jour {d.day} : {d.name || 'houblon'} ({fmt(d.amountG)} g)
                </Chip>
              ))}
            </Chips>
            <LibraryNote note={FERMENTATION_STEP_TIPS[s.type]} />
          </Card>
        )
      })}
    </IngredientSection>
  )
}

// ——— Autres ajouts ———

export function OtherIngredientCards({
  items,
  onChange,
}: {
  items: OtherIngredient[]
  onChange: (items: OtherIngredient[]) => void
}) {
  const update = (index: number, patch: Partial<OtherIngredient>) =>
    onChange(items.map((o, i) => (i === index ? { ...o, ...patch } : o)))

  return (
    <IngredientSection
      title="Autres ajouts (ébullition)"
      icon={<FlaskRound size={20} />}
      accent="slate"
      hint="Clarifiant (Whirlfloc, Irish moss), nutriment de levure, épices… La quantité est libre (« 1 pastille », « 5 g »). Le temps se compte comme pour les houblons."
      addLabel="Ajouter un ajout"
      onAdd={() => onChange([...items, { ...EMPTY_OTHER }])}
      empty="Aucun autre ajout. Un clarifiant (Whirlfloc) à 10 min de la fin aide à avoir une bière limpide."
    >
      {items.map((o, i) => (
        <Card key={i}>
          <NameRow
            value={o.name}
            placeholder="Whirlfloc, nutriment…"
            suggestions={[]}
            onChange={(name) => update(i, { name })}
            onPick={() => undefined}
            onRemove={() => onChange(items.filter((_, idx) => idx !== i))}
            {...reorder(items, i, onChange)}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Quantité">
              <input value={o.amount} onChange={(e) => update(i, { amount: e.target.value })} placeholder="1 pastille" className="field-input" />
            </Field>
            <Field label="Temps (min)" hint="Minutes avant la fin de l'ébullition.">
              <NumberInput value={o.timeMin} step="1" integer onChange={(timeMin) => update(i, { timeMin })} />
            </Field>
          </div>
        </Card>
      ))}
    </IngredientSection>
  )
}
