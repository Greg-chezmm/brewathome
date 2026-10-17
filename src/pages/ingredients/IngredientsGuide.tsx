import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import {
  FERMENTABLE_CATEGORIES,
  FERMENTABLE_LIBRARY,
  HOP_LIBRARY,
  HOP_ROLES,
  YEAST_FAMILIES,
  YEAST_LIBRARY,
  yeastBrand,
  type FermentableGuide,
  type HopGuide,
  type YeastGuide,
} from '@/data/ingredients'

type Tab = 'malts' | 'hops' | 'yeasts'

const TABS: { id: Tab; label: string }[] = [
  { id: 'malts', label: 'Malts & céréales' },
  { id: 'hops', label: 'Houblons' },
  { id: 'yeasts', label: 'Levures' },
]

/** DI d'exemple pour traduire l'atténuation en DF attendue. */
const EXAMPLE_OG = 1.05

const fmt = (value: number, digits = 0) => value.toLocaleString('fr-FR', { maximumFractionDigits: digits })

/** Couleur d'un grain : °L (comme dans le formulaire de recette) et son équivalent EBC (Morey : SRM ≈ 1,3546 × °L − 0,76). */
function ebcFromLovibond(lovibond: number): number {
  return Math.max(0, (1.3546 * lovibond - 0.76) * 1.97)
}

/** Libellé sans sa parenthèse d'exemples, pour les raccourcis : « Ale américaine (IPA, pale ale) » → « Ale américaine ». */
const shortLabel = (label: string) => label.replace(/ \(.*\)$/, '')

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .toLowerCase()

function matches(query: string, ...fields: string[]): boolean {
  const q = normalize(query.trim())
  return !q || fields.some((field) => normalize(field).includes(q))
}

const fermentableMatches = (q: string, f: FermentableGuide) => matches(q, f.name, f.note)
const hopMatches = (q: string, h: HopGuide) => matches(q, h.name, h.note, h.origin)
const yeastMatches = (q: string, y: YeastGuide) =>
  matches(q, y.name, y.note, yeastBrand(y.name), YEAST_FAMILIES.find((f) => f.id === y.family)!.beers)

/** Onglet où se trouve un ingrédient, pour y sauter depuis un remplaçant. */
function tabOf(name: string): Tab {
  if (HOP_LIBRARY.some((h) => h.name === name)) return 'hops'
  if (YEAST_LIBRARY.some((y) => y.name === name)) return 'yeasts'
  return 'malts'
}

/**
 * Guide des ingrédients : conseils par famille (malts de base, caramel, céréales crues, houblons
 * amérisants ou aromatiques, types de levure) et fiches avec valeurs typiques et remplaçants.
 */
export function IngredientsGuide() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'malts') as Tab
  // ?q= : ouvert depuis la fiche d'un ingrédient de recette.
  const [query, setQuery] = useState(() => params.get('q') ?? '')

  const counts = useMemo(
    () => ({
      malts: FERMENTABLE_LIBRARY.filter((f) => fermentableMatches(query, f)).length,
      hops: HOP_LIBRARY.filter((h) => hopMatches(query, h)).length,
      yeasts: YEAST_LIBRARY.filter((y) => yeastMatches(query, y)).length,
    }),
    [query],
  )

  const selectTab = (next: Tab) => setParams(next === 'malts' ? {} : { tab: next }, { replace: true })
  const showIngredient = (name: string) => {
    setQuery(name)
    selectTab(tabOf(name))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Ingrédients</h1>
        <p className="text-slate-600">
          À quoi sert chaque malt, houblon ou levure, en quelle quantité, et par quoi le remplacer s’il manque. Valeurs
          typiques : l’étiquette du fabricant fait foi.
        </p>
      </div>

      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <label htmlFor="ingredient-search" className="sr-only">
          Rechercher un ingrédient
        </label>
        <input
          id="ingredient-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher : Citra, abbaye, riz, banane…"
          className="field-input py-2.5 pl-10 pr-10"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600"
            aria-label="Effacer la recherche"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav aria-label="Familles d’ingrédients" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
            {query && <span className="ml-1 text-xs text-slate-400">({counts[t.id]})</span>}
          </button>
        ))}
      </nav>

      {tab === 'malts' && <MaltsSection query={query} onPick={showIngredient} />}
      {tab === 'hops' && <HopsSection query={query} onPick={showIngredient} />}
      {tab === 'yeasts' && <YeastsSection query={query} onPick={showIngredient} />}
    </div>
  )
}

interface SectionProps {
  query: string
  onPick: (name: string) => void
}

/** Raccourcis vers chaque famille de l’onglet : la liste est longue sur mobile. */
function JumpLinks({ groups }: { groups: { id: string; label: string }[] }) {
  if (groups.length < 2) return null
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {groups.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => document.getElementById(`groupe-${g.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
        >
          {g.label}
        </button>
      ))}
    </div>
  )
}

function Group({ id, title, subtitle, advice, children }: { id: string; title: string; subtitle?: string; advice: string; children: React.ReactNode }) {
  return (
    <section id={`groupe-${id}`} className="scroll-mt-20">
      <h2 className="section-title">{title}</h2>
      {subtitle && <p className="text-sm font-medium text-indigo-600">{subtitle}</p>}
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">{advice}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Card({ title, tags, note, substitutes, onPick, children }: {
  title: string
  tags: string[]
  note: string
  substitutes: string[]
  onPick: (name: string) => void
  children?: React.ReactNode
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {tag}
          </span>
        ))}
      </p>
      {children}
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{note}</p>
      {substitutes.length > 0 && (
        <p className="mt-2 text-sm text-slate-500">
          Remplacer par :{' '}
          {substitutes.map((name, i) => (
            <span key={name}>
              {i > 0 && ', '}
              <button type="button" onClick={() => onPick(name)} className="font-medium text-indigo-600 hover:underline">
                {name}
              </button>
            </span>
          ))}
        </p>
      )}
    </article>
  )
}

function NoResult() {
  return <p className="text-sm text-slate-500">Aucun ingrédient ne correspond à cette recherche dans cet onglet.</p>
}

function MaltsSection({ query, onPick }: SectionProps) {
  const groups = FERMENTABLE_CATEGORIES.map((category) => ({
    category,
    items: FERMENTABLE_LIBRARY.filter((f) => f.category === category.id && fermentableMatches(query, f)),
  })).filter((g) => g.items.length > 0)
  if (groups.length === 0) return <NoResult />
  return (
    <div className="space-y-8">
      <JumpLinks groups={groups.map(({ category }) => ({ id: category.id, label: shortLabel(category.label) }))} />
      {groups.map(({ category, items }) => (
        <Group key={category.id} id={category.id} title={category.label} advice={category.advice}>
          {items.map((f) => (
            <Card
              key={f.name}
              title={f.name}
              tags={[
                f.type === 'grain' ? `${fmt(f.colorLovibond, 1)} °L · ${fmt(ebcFromLovibond(f.colorLovibond))} EBC` : `${fmt(f.colorLovibond, 1)} °L`,
                `rendement ${fmt(f.yieldPercent)} %`,
              ]}
              note={f.note}
              substitutes={f.substitutes}
              onPick={onPick}
            />
          ))}
        </Group>
      ))}
    </div>
  )
}

function HopsSection({ query, onPick }: SectionProps) {
  const groups = HOP_ROLES.map((role) => ({
    role,
    items: HOP_LIBRARY.filter((h) => h.role === role.id && hopMatches(query, h)),
  })).filter((g) => g.items.length > 0)
  if (groups.length === 0) return <NoResult />
  return (
    <div className="space-y-8">
      <JumpLinks groups={groups.map(({ role }) => ({ id: role.id, label: role.label }))} />
      {groups.map(({ role, items }) => (
        <Group key={role.id} id={role.id} title={role.label} advice={role.advice}>
          {items.map((h) => (
            <Card
              key={h.name}
              title={h.name}
              tags={[h.origin, `${fmt(h.alphaAcidPercent, 1)} % alpha`]}
              note={h.note}
              substitutes={h.substitutes}
              onPick={onPick}
            />
          ))}
        </Group>
      ))}
    </div>
  )
}

function YeastsSection({ query, onPick }: SectionProps) {
  const groups = YEAST_FAMILIES.map((family) => ({
    family,
    items: YEAST_LIBRARY.filter((y) => y.family === family.id && yeastMatches(query, y)),
  })).filter((g) => g.items.length > 0)
  if (groups.length === 0) return <NoResult />
  return (
    <div className="space-y-8">
      <JumpLinks groups={groups.map(({ family }) => ({ id: family.id, label: shortLabel(family.label) }))} />
      {groups.map(({ family, items }) => (
        <Group key={family.id} id={family.id} title={family.label} subtitle={`Pour : ${family.beers}`} advice={family.advice}>
          {items.map((y) => {
            const exampleFg = 1 + (EXAMPLE_OG - 1) * (1 - y.attenuationPercent / 100)
            return (
              <Card
                key={y.name}
                title={y.name}
                tags={[yeastBrand(y.name), y.type === 'dry' ? 'sèche' : 'liquide', `${y.tempC[0]}–${y.tempC[1]} °C`].filter(Boolean)}
                note={y.note}
                substitutes={y.substitutes}
                onPick={onPick}
              >
                <p className="mt-2 text-sm">
                  <span className="font-semibold text-indigo-600">Atténuation ≈ {fmt(y.attenuationPercent)} %</span>
                  <span className="text-slate-500">
                    {' '}
                    · DI {EXAMPLE_OG.toFixed(3)} → DF ≈ {exampleFg.toFixed(3)}
                  </span>
                </p>
              </Card>
            )
          })}
        </Group>
      ))}
    </div>
  )
}
