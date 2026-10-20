import { FlaskConical } from 'lucide-react'
import { findByName, YEAST_LIBRARY, type LibraryYeast } from '@/data/ingredients'
import type { Yeast, YeastAmountUnit } from '@/lib/brew-calc/types'
import type { IngredientHistory } from '@/lib/db/queries/ingredientHistory'
import { checkYeastPitch, dryYeastSachetGrams } from '@/lib/brew-calc/yeast'
import { yeastPitchMessage } from '../yeastPitch'
import { Card, NameRow, Field, NumberInput, Chips, Chip, LibraryNote, IngredientSection } from './shared'
import { fmt, reorder, mergeSuggestions } from './helpers'

const YEAST_UNIT_LABELS: Record<YeastAmountUnit, string> = { pkg: 'sachet(s)', g: 'g', ml: 'ml' }
const EMPTY_YEAST: Yeast = { name: '', type: 'dry', style: 'ale', attenuationPercent: 75 }

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
      empty={
        og > 1
          ? 'Aucune levure : sans levure, pas de fermentation. Ajoutez celle que vous ensemencerez (en attendant, le calcul suppose 75 % d’atténuation).'
          : 'Aucune levure : ajoutez celle que vous ensemencerez (sinon le calcul suppose 75 % d’atténuation).'
      }
      emptyTone={og > 1 ? 'warn' : 'muted'}
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
