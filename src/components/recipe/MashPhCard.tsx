import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DEFAULT_MASH_RATIO_L_PER_KG,
  estimateMashPh,
  MASH_PH_RANGE,
  MASH_PH_TARGET,
  mashPhVerdict,
} from '@/lib/brew-calc/mash-ph'
import { fermentableUse } from '@/lib/brew-calc/gravity'
import type { Fermentable } from '@/lib/brew-calc/types'
import { residualAlkalinity } from '@/lib/brew-calc/water'
import { loadSourceWaterProfile } from '@/lib/water-storage'
import { FieldLabel } from '@/components/InfoTooltip'

const fmt = (value: number, digits: number) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/**
 * pH d'empâtage estimé d'après le grain et l'eau, avec la dose d'acide lactique pour viser 5,4.
 * L'eau est celle saisie dans l'outil « Sels minéraux » (gardée dans le navigateur), modifiable ici.
 */
export function MashPhCard({ fermentables, mashWaterL }: { fermentables: Fermentable[]; mashWaterL: number | null }) {
  const [storedWater] = useState(loadSourceWaterProfile)
  const [ra, setRa] = useState(() => (storedWater ? String(Math.round(residualAlkalinity(storedWater))) : '0'))
  const [lactic, setLactic] = useState('')

  const grainKg = fermentables
    .filter((f) => f.type === 'grain' && fermentableUse(f) === 'mash')
    .reduce((sum, f) => sum + (Number.isFinite(f.amountKg) ? f.amountKg : 0), 0)
  const waterL = mashWaterL ?? grainKg * DEFAULT_MASH_RATIO_L_PER_KG
  const estimate = estimateMashPh({
    fermentables,
    mashWaterL: waterL,
    residualAlkalinityPpm: Number.parseFloat(ra) || 0,
    lacticAcidMl: Number.parseFloat(lactic) || 0,
  })
  if (!estimate) return null

  const inRange = estimate.ph >= MASH_PH_RANGE[0] && estimate.ph <= MASH_PH_RANGE[1]
  const tone = inRange ? 'text-green-700' : Math.abs(estimate.ph - MASH_PH_TARGET) > 0.4 ? 'text-red-700' : 'text-orange-600'

  return (
    <section className="card" aria-label="pH d'empâtage">
      <h2 className="section-title mb-1">pH d’empâtage estimé</h2>
      <p className="mb-3 text-sm text-slate-500">
        Le grain (surtout caramel et torréfié) acidifie la maische, l’alcalinité de l’eau la remonte. Visez {fmt(MASH_PH_RANGE[0], 1)} à{' '}
        {fmt(MASH_PH_RANGE[1], 1)}.
      </p>
      <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
        <div>
          <FieldLabel hint="Alcalinité résiduelle de l'eau d'empâtage (ppm de CaCO₃) : bicarbonates moins l'effet du calcium et du magnésium. Déminéralisée ou osmosée : ≈ 0. Calculée dans l'outil « Sels minéraux » à partir de l'analyse de votre eau.">
            Alcalinité résiduelle
          </FieldLabel>
          <input type="number" step="1" value={ra} onChange={(e) => setRa(e.target.value)} className="field-input" />
        </div>
        <div>
          <FieldLabel hint="Acide lactique à 88 % versé dans l'eau d'empâtage. Au-delà de ≈ 2 mL pour 20 L, l'acidité peut se goûter dans les bières légères.">
            Acide lactique 88 % (mL)
          </FieldLabel>
          <input type="number" step="0.1" min="0" value={lactic} placeholder="0" onChange={(e) => setLactic(e.target.value)} className="field-input" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <div className="text-xs text-slate-500">pH estimé</div>
          <div className={`text-2xl font-bold tabular-nums ${tone}`}>{fmt(estimate.ph, 2)}</div>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {storedWater ? (
          <>Eau du robinet saisie dans l’outil </>
        ) : (
          <>Aucune analyse d’eau enregistrée : saisissez la vôtre dans l’outil </>
        )}
        <Link to="/tools" className="font-medium text-indigo-600 hover:underline">
          Sels minéraux
        </Link>{' '}
        (avant ajout de sels) · {fmt(waterL, 1)} L d’eau d’empâtage{mashWaterL === null && ` (${DEFAULT_MASH_RATIO_L_PER_KG} L/kg)`} · grain seul en
        eau distillée : {fmt(estimate.diPh, 2)}
        {estimate.acidMaltPercent > 0 && ` · ${fmt(estimate.acidMaltPercent, 1)} % de malt acidulé compté`}
      </p>

      <p className={`mt-3 text-sm font-medium ${tone}`}>{mashPhVerdict(estimate.ph)}</p>
      {estimate.lacticMlToTarget > 0 && !inRange && (
        <p className="mt-1 text-sm text-slate-700">
          Pour viser {fmt(MASH_PH_TARGET, 1)} : ajouter <strong>{fmt(estimate.lacticMlToTarget, 1)} mL</strong> d’acide lactique 88 %
          {(Number.parseFloat(lactic) || 0) > 0 && ' de plus'}, ou du malt acidulé (≈ 1 % du grain par 0,1 de pH), ou couper l’eau avec de l’eau déminéralisée.
        </p>
      )}
      {estimate.bakingSodaGToTarget > 0 && !inRange && (
        <p className="mt-1 text-sm text-slate-700">
          Pour remonter à {fmt(MASH_PH_TARGET, 1)} : environ <strong>{fmt(estimate.bakingSodaGToTarget, 1)} g</strong> de bicarbonate de
          soude dans l’eau d’empâtage, ou ajoutez les malts torréfiés en fin d’empâtage seulement.
        </p>
      )}
      <p className="mt-3 text-xs text-slate-400">
        Estimation (±0,1 à 0,2) : mesurez au pH-mètre 10–15 min après l’empâtage, sur un échantillon refroidi, et notez-le dans les mesures du
        brassin.
      </p>
    </section>
  )
}
