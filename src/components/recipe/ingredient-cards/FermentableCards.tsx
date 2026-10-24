import type { ReactNode } from 'react'
import { Wheat } from 'lucide-react'
import { FERMENTABLE_LIBRARY, findByName, type LibraryFermentable } from '@/data/ingredients'
import type { FermentableContribution } from '@/lib/brew-calc/contributions'
import { fermentableUse } from '@/lib/brew-calc/gravity'
import type { Fermentable, FermentableUse } from '@/lib/brew-calc/types'
import type { IngredientHistory } from '@/lib/db/queries/ingredientHistory'
import { formatWeightKg } from '@/lib/brew-calc/units'
import { Card, NameRow, Field, NumberInput, WeightInput, Chips, Chip, LibraryNote, IngredientSection } from './shared'
import { fmt, reorder, mergeSuggestions } from './helpers'

const FERMENTABLE_USE_LABELS: Record<FermentableUse, string> = {
  mash: 'Empâtage',
  boil: 'Ébullition',
  fermentation: 'Fermentation',
}
const EMPTY_FERMENTABLE: Fermentable = { name: '', type: 'grain', amountKg: 1, colorLovibond: 3, yieldPercent: 80 }

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
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-[minmax(9.5rem,1.5fr)_repeat(4,minmax(0,1fr))]">
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
