import { useId, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
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
import type { Fermentable, Hop, HopForm, HopUse, OtherIngredient, Yeast } from '@/lib/brew-calc/types'
import type { IngredientHistory } from '@/lib/db/queries/ingredientHistory'
import { InfoTooltip } from '@/components/InfoTooltip'

const HOP_USES: HopUse[] = ['first-wort', 'boil', 'whirlpool', 'dry-hop', 'mash']
const HOP_USE_LABELS: Record<HopUse, string> = {
  'first-wort': 'Premier moût',
  boil: 'Ébullition',
  whirlpool: 'Whirlpool',
  'dry-hop': 'Dry hop',
  mash: 'Empâtage',
}

const EMPTY_FERMENTABLE: Fermentable = { name: '', type: 'grain', amountKg: 1, colorLovibond: 3, yieldPercent: 80 }
const EMPTY_HOP: Hop = { name: '', amountG: 10, alphaAcidPercent: 10, timeMin: 60, use: 'boil', form: 'pellet' }
const EMPTY_YEAST: Yeast = { name: '', type: 'dry', style: 'ale', attenuationPercent: 75 }
const EMPTY_OTHER: OtherIngredient = { name: '', amount: '', timeMin: 10 }

const fmt = (value: number, digits = 0) => value.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits })

// ——— Briques communes ———

/** Section d'ingrédients : titre, résumé, liste de cartes, bouton d'ajout. */
export function IngredientSection({
  title,
  hint,
  summary,
  addLabel,
  onAdd,
  empty,
  children,
}: {
  title: string
  hint: string
  summary?: string
  addLabel: string
  onAdd: () => void
  empty: string
  children: ReactNode[]
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="section-title flex items-center">
            {title}
            <InfoTooltip text={hint} />
          </h2>
          {summary && <p className="text-sm text-slate-500">{summary}</p>}
        </div>
      </div>
      {children.length > 0 ? (
        <ul className="space-y-3">{children}</ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-400">{empty}</p>
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

/** Nom de l'ingrédient, avec les suggestions (vos ingrédients puis la bibliothèque) et la suppression. */
function NameRow<T extends { name: string }>({
  value,
  placeholder,
  suggestions,
  onChange,
  onPick,
  onRemove,
}: {
  value: string
  placeholder: string
  suggestions: T[]
  onChange: (name: string) => void
  /** Nom choisi parmi les suggestions : reprend ses caractéristiques. */
  onPick: (item: T) => void
  onRemove: () => void
}) {
  const listId = useId()
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
        {suggestions.map((s) => (
          <option key={s.name} value={s.name} />
        ))}
      </datalist>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
        aria-label="Retirer"
      >
        <Trash2 size={18} />
      </button>
    </div>
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

/** Fiche de la bibliothèque : ce qu'apporte l'ingrédient et comment le doser. */
function LibraryNote({ note }: { note: string | undefined }) {
  return note ? <p className="mt-2 text-xs leading-relaxed text-slate-500">{note}</p> : null
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
  onChange,
}: {
  fermentables: Fermentable[]
  contributions: FermentableContribution[]
  history: IngredientHistory | undefined
  onChange: (fermentables: Fermentable[]) => void
}) {
  const suggestions = mergeSuggestions<LibraryFermentable>(history?.fermentables, FERMENTABLE_LIBRARY)
  const update = (index: number, patch: Partial<Fermentable>) =>
    onChange(fermentables.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  const totalKg = fermentables.reduce((sum, f) => sum + (Number.isFinite(f.amountKg) ? f.amountKg : 0), 0)

  return (
    <IngredientSection
      title="Fermentescibles"
      hint="Les ingrédients qui apportent les sucres (malts, extraits, sucres). Leur poids, leur couleur (°L) et leur rendement font la densité initiale et la couleur de la bière."
      summary={fermentables.length > 0 ? `${fmt(totalKg, 2)} kg au total` : undefined}
      addLabel="Ajouter un fermentescible"
      onAdd={() => onChange([...fermentables, { ...EMPTY_FERMENTABLE }])}
      empty="Aucun fermentescible : commencez par un malt de base (Pilsner, Pale Ale…)."
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
            />
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Poids (kg)">
                <NumberInput value={f.amountKg} step="0.01" onChange={(amountKg) => update(i, { amountKg })} />
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
            </div>
            {c && (
              <Chips>
                <Chip>{fmt(c.percentOfGrist)} % du grain</Chip>
                <Chip>+{fmt(c.gravityPoints)} pts de densité</Chip>
                {c.colorPercent >= 1 && <Chip tone="amber">{fmt(c.colorPercent)} % de la couleur</Chip>}
              </Chips>
            )}
            <LibraryNote note={findByName(FERMENTABLE_LIBRARY, f.name)?.note} />
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
  history,
  onChange,
}: {
  hops: Hop[]
  /** IBU de chaque houblon (vide si la formule ne donne pas le détail). */
  ibuByHop: number[]
  history: IngredientHistory | undefined
  onChange: (hops: Hop[]) => void
}) {
  const suggestions = mergeSuggestions<LibraryHop>(history?.hops, HOP_LIBRARY)
  const update = (index: number, patch: Partial<Hop>) => onChange(hops.map((h, i) => (i === index ? { ...h, ...patch } : h)))
  const totalG = hops.reduce((sum, h) => sum + (Number.isFinite(h.amountG) ? h.amountG : 0), 0)

  return (
    <IngredientSection
      title="Houblons"
      hint="Amertume (IBU), saveur et arôme. Un ajout long en ébullition donne surtout de l'amertume ; un ajout court, un whirlpool ou un dry hop donnent surtout des arômes."
      summary={hops.length > 0 ? `${fmt(totalG)} g au total` : undefined}
      addLabel="Ajouter un houblon"
      onAdd={() => onChange([...hops, { ...EMPTY_HOP }])}
      empty="Aucun houblon."
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
            />
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-6">
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
              {h.use === 'dry-hop' && h.dryHopDays !== undefined && <Chip tone="slate">{h.dryHopDays} j en fermenteur</Chip>}
            </Chips>
            <LibraryNote note={findByName(HOP_LIBRARY, h.name)?.note} />
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
  mashTempC,
  history,
  onChange,
}: {
  yeasts: Yeast[]
  /** Atténuation retenue par le calcul (levure principale, ajustée par l'empâtage). */
  attenuationPercent: number
  fg: number
  mashTempC: number
  history: IngredientHistory | undefined
  onChange: (yeasts: Yeast[]) => void
}) {
  const suggestions = mergeSuggestions<LibraryYeast>(history?.yeasts, YEAST_LIBRARY)
  const update = (index: number, patch: Partial<Yeast>) => onChange(yeasts.map((y, i) => (i === index ? { ...y, ...patch } : y)))

  return (
    <IngredientSection
      title="Levures"
      hint="La levure transforme les sucres en alcool et CO₂. Son atténuation (part des sucres consommés) fixe la densité finale, donc l'alcool et la sécheresse."
      addLabel="Ajouter une levure"
      onAdd={() => onChange([...yeasts, { ...EMPTY_YEAST }])}
      empty="Aucune levure : le calcul suppose 75 % d'atténuation."
    >
      {yeasts.map((y, i) => (
        <Card key={i}>
          <NameRow
            value={y.name}
            placeholder="Souche de levure"
            suggestions={suggestions}
            onChange={(name) => update(i, { name })}
            onPick={({ name, type, style, attenuationPercent: attenuation }) => update(i, { name, type, style, attenuationPercent: attenuation })}
            onRemove={() => onChange(yeasts.filter((_, idx) => idx !== i))}
          />
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                {Number.isFinite(attenuationPercent) && Math.abs(attenuationPercent - y.attenuationPercent) >= 0.05 && (
                  <Chip tone="amber">
                    {fmt(attenuationPercent, 1)} % retenus avec un empâtage à {fmt(mashTempC, 1)} °C
                  </Chip>
                )}
              </>
            ) : (
              <Chip tone="slate">Seule la première levure compte dans le calcul</Chip>
            )}
          </Chips>
          <LibraryNote note={findByName(YEAST_LIBRARY, y.name)?.note} />
        </Card>
      ))}
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
