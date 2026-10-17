import { useState } from 'react'
import {
  DRY_YEAST_SACHET_G,
  calculateCellsNeededBillions,
  calculateLiquidPacksNeeded,
  calculateLiquidYeastViabilityPercent,
  dryYeastForCells,
} from '@/lib/brew-calc/yeast'
import type { YeastStyle } from '@/lib/brew-calc/types'
import { FieldLabel } from '@/components/InfoTooltip'

type YeastForm = 'dry' | 'liquid'

const fmt = (value: number, digits = 0) => value.toLocaleString('fr-FR', { maximumFractionDigits: digits })

export function YeastPitchTool({
  defaultVolumeL,
  defaultOg,
  defaultStyle = 'ale',
  defaultForm = 'dry',
}: {
  defaultVolumeL?: number
  defaultOg?: number
  defaultStyle?: YeastStyle
  defaultForm?: YeastForm
}) {
  const [volume, setVolume] = useState(defaultVolumeL ? String(defaultVolumeL) : '20')
  const [og, setOg] = useState(defaultOg ? defaultOg.toFixed(3) : '1.050')
  const [style, setStyle] = useState<YeastStyle>(defaultStyle)
  const [form, setForm] = useState<YeastForm>(defaultForm)
  const [ageDays, setAgeDays] = useState('30')
  const [packBillions, setPackBillions] = useState('100')

  const volumeL = Number.parseFloat(volume)
  const gravity = Number.parseFloat(og)
  const valid = volumeL > 0 && gravity > 1
  const cells = valid ? calculateCellsNeededBillions(volumeL, gravity, style) : null
  const age = Number.parseFloat(ageDays)
  const packSize = Number.parseFloat(packBillions)

  return (
    <div className="card">
      <h2 className="section-title mb-1">Quantité de levure</h2>
      <p className="mb-3 text-sm text-slate-500">
        Cellules à ensemencer selon le volume et la densité (taux Mr Malty : 0,75 million/mL/°P en ale, le double en
        lager), traduites en sachets.
      </p>
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
        <div>
          <FieldLabel hint="Volume de moût mis en fermenteur.">Volume (L)</FieldLabel>
          <input type="number" step="0.1" value={volume} onChange={(e) => setVolume(e.target.value)} className="field-input" />
        </div>
        <div>
          <FieldLabel hint="Densité initiale du moût : plus elle est haute, plus il faut de levure.">DI</FieldLabel>
          <input type="number" step="0.001" value={og} onChange={(e) => setOg(e.target.value)} className="field-input" />
        </div>
        <div>
          <FieldLabel hint="Une lager fermente à froid : il lui faut deux fois plus de cellules.">Fermentation</FieldLabel>
          <select value={style} onChange={(e) => setStyle(e.target.value as YeastStyle)} className="field-input">
            <option value="ale">Ale</option>
            <option value="lager">Lager</option>
          </select>
        </div>
        <div>
          <FieldLabel hint="Levure sèche en sachet, ou liquide (sachet ou tube) dont la vitalité baisse avec l'âge.">
            Levure
          </FieldLabel>
          <select value={form} onChange={(e) => setForm(e.target.value as YeastForm)} className="field-input">
            <option value="dry">Sèche</option>
            <option value="liquid">Liquide</option>
          </select>
        </div>
        {form === 'liquid' && (
          <>
            <div>
              <FieldLabel hint="Jours écoulés depuis la date de fabrication imprimée sur le sachet.">Âge (jours)</FieldLabel>
              <input type="number" step="1" value={ageDays} onChange={(e) => setAgeDays(e.target.value)} className="field-input" />
            </div>
            <div>
              <FieldLabel hint="Cellules d'un sachet neuf : 100 milliards pour Wyeast et White Labs.">
                Cellules / sachet (Md)
              </FieldLabel>
              <input
                type="number"
                step="10"
                value={packBillions}
                onChange={(e) => setPackBillions(e.target.value)}
                className="field-input"
              />
            </div>
          </>
        )}
      </div>
      {cells !== null && (
        <div className="mt-3 text-sm">
          <p className="text-slate-600">{fmt(cells)} milliards de cellules à ensemencer.</p>
          {form === 'dry' ? (
            <DryResult cells={cells} />
          ) : (
            Number.isFinite(age) && age >= 0 && packSize > 0 && <LiquidResult cells={cells} ageDays={age} packBillions={packSize} />
          )}
        </div>
      )}
    </div>
  )
}

function DryResult({ cells }: { cells: number }) {
  const { grams, sachets } = dryYeastForCells(cells)
  return (
    <p className="mt-1 font-medium text-indigo-600">
      <strong>
        {sachets} sachet{sachets > 1 ? 's' : ''}
      </strong>{' '}
      de {fmt(DRY_YEAST_SACHET_G, 1)} g ({fmt(grams, 1)} g de levure sèche).
    </p>
  )
}

function LiquidResult({ cells, ageDays, packBillions }: { cells: number; ageDays: number; packBillions: number }) {
  const viability = calculateLiquidYeastViabilityPercent(ageDays)
  const packs = calculateLiquidPacksNeeded(cells, ageDays, packBillions)
  if (!Number.isFinite(packs)) {
    return <p className="mt-1 font-medium text-red-600">Sachet trop vieux : plus de cellules viables, faites un starter.</p>
  }
  return (
    <>
      <p className="mt-1 font-medium text-indigo-600">
        <strong>
          {packs} sachet{packs > 1 ? 's' : ''}
        </strong>{' '}
        (vitalité estimée {fmt(viability)} %).
      </p>
      {packs > 2 && (
        <p className="mt-1 text-slate-500">Plutôt qu'autant de sachets, un starter la veille multiplie les cellules d'un seul.</p>
      )}
    </>
  )
}
