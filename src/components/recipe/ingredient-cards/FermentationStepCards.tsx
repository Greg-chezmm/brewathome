import { ArrowDown, ArrowUp, Snowflake, Trash2 } from 'lucide-react'
import { dryHopEvents, FERMENTATION_STEP_LABELS, FERMENTATION_STEP_TIPS, FERMENTATION_STEP_TYPES, fermentationSchedule, nextFermentationStep, totalFermentationDays, type FermentationStep, type FermentationStepType } from '@/lib/brew-calc/fermentation-profile'
import type { Hop } from '@/lib/brew-calc/types'
import { Card, MoveButton, Field, NumberInput, Chips, Chip, LibraryNote, IngredientSection } from './shared'
import { fmt, reorder } from './helpers'

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
