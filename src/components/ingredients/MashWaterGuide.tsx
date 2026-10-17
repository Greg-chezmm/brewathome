import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MASH_STEP_ROLE_LABELS, mashStepTip, type MashStepRole } from '@/lib/brew-calc/mash'
import { MASH_PH_RANGE } from '@/lib/brew-calc/mash-ph'
import { sulfateToChlorideRatio, WATER_TARGETS, type WaterProfile } from '@/lib/brew-calc/water'

/** Plages de chaque rôle de palier (voir `mashStepRole`) et température d'exemple pour son explication. */
const MASH_RANGES: { role: MashStepRole; range: string; exampleC: number }[] = [
  { role: 'acid', range: '35–44 °C', exampleC: 40 },
  { role: 'protein', range: '45–59 °C', exampleC: 52 },
  { role: 'beta', range: '60–65 °C', exampleC: 63 },
  { role: 'balanced', range: '66–67 °C', exampleC: 66 },
  { role: 'alpha', range: '68–74 °C', exampleC: 70 },
  { role: 'mash-out', range: '75–78 °C', exampleC: 76 },
]

const MASH_PROFILES: { name: string; steps: string; when: string }[] = [
  {
    name: 'Infusion simple',
    steps: '66–67 °C · 60 min, puis mash-out 76 °C · 10 min',
    when: 'La plupart des bières avec des malts modernes : pale ale, IPA, ambrée, stout.',
  },
  {
    name: 'Bière sèche',
    steps: '63–64 °C · 60–75 min, puis mash-out',
    when: 'Saison, tripel, IPA de la côte ouest, bière légère : plus d’alcool, finale sèche.',
  },
  {
    name: 'Bière ronde',
    steps: '68–69 °C · 45–60 min, puis mash-out',
    when: 'Stout sucré, bitter, scotch ale, bières peu alcoolisées qui doivent garder du corps.',
  },
  {
    name: 'Paliers bêta + alpha',
    steps: '63 °C · 30 min, 72 °C · 20–30 min, puis mash-out',
    when: 'Pils, weizen, bières belges : on règle finement corps et sécheresse (cuve chauffante nécessaire).',
  },
  {
    name: 'Beaucoup de blé, avoine, seigle',
    steps: 'Ajoutez 40 °C (gommes) ou 52 °C · 10–15 min (protéines) en tête',
    when: 'Au-delà de ≈ 30 % de céréales non maltées, ou si la filtration colle. Balles de riz conseillées.',
  },
]

const IONS: { key: keyof WaterProfile; label: string; range: string; role: string }[] = [
  {
    key: 'calcium',
    label: 'Calcium',
    range: '50–150 ppm',
    role: 'L’ion clé : aide les enzymes, abaisse le pH d’empâtage, clarifie et favorise la floculation. En dessous de 50 ppm, complétez (gypse ou chlorure de calcium).',
  },
  {
    key: 'magnesium',
    label: 'Magnésium',
    range: '5–30 ppm',
    role: 'Nutriment de levure, déjà apporté par le malt. Au-delà de 30 ppm : amertume aigre, effet laxatif.',
  },
  {
    key: 'sodium',
    label: 'Sodium',
    range: '0–50 ppm',
    role: 'Arrondit le malt à petite dose. Au-delà de 100 ppm, goût salé, surtout avec beaucoup de sulfates.',
  },
  {
    key: 'sulfate',
    label: 'Sulfates',
    range: '50–300 ppm',
    role: 'Sèchent la finale et font ressortir l’amertume : IPA, bitter. À limiter dans les lagers délicates et les bières maltées.',
  },
  {
    key: 'chloride',
    label: 'Chlorures',
    range: '50–200 ppm',
    role: 'Donnent de la rondeur et du moelleux au malt : NEIPA, stout, bières maltées. Au-delà de 200–250 ppm, goût minéral.',
  },
  {
    key: 'bicarbonate',
    label: 'Bicarbonates',
    range: '0–50 ppm (blondes) · jusqu’à 150 (brunes)',
    role: 'Remontent le pH d’empâtage : gênants dans les bières claires, ils équilibrent l’acidité des malts torréfiés dans les bières foncées.',
  },
]

const fmt = (value: number, digits = 0) => value.toLocaleString('fr-FR', { maximumFractionDigits: digits })

function GuideCard({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-20" aria-label={title}>
      <h2 className="section-title mb-3">{title}</h2>
      {children}
    </section>
  )
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="text-indigo-500">
        •
      </span>
      <span>{children}</span>
    </li>
  )
}

const linkClass = 'font-medium text-indigo-600 hover:underline'

/**
 * Onglet « Empâtage & eau » du guide : ce que fait chaque température de palier, des profils
 * d'empâtage types, le rôle des ions de l'eau et les profils cibles de l'outil « Sels minéraux ».
 */
export function MashWaterGuide() {
  return (
    <div className="space-y-6">
      <GuideCard id="paliers" title="Les températures d’empâtage">
        <p className="mb-3 text-sm text-slate-600">
          Les enzymes du malt découpent l’amidon en sucres. Selon la température, l’une ou l’autre domine : c’est le palier principal qui
          fixe la sécheresse de la bière (et l’atténuation estimée par l’app).
        </p>
        <ul className="divide-y divide-slate-100">
          {MASH_RANGES.map(({ role, range, exampleC }) => (
            <li key={role} className="py-3 sm:flex sm:gap-4">
              <div className="shrink-0 sm:w-48">
                <div className="font-semibold text-slate-900">{range}</div>
                <div className="text-xs font-medium text-indigo-700">{MASH_STEP_ROLE_LABELS[role]}</div>
              </div>
              <p className="mt-1 text-sm text-slate-600 sm:mt-0">{mashStepTip(exampleC)}</p>
            </li>
          ))}
        </ul>
      </GuideCard>

      <GuideCard id="profils-empatage" title="Profils d’empâtage types">
        <ul className="grid gap-3 sm:grid-cols-2">
          {MASH_PROFILES.map((p) => (
            <li key={p.name} className="rounded-xl border border-slate-200 p-4">
              <div className="font-semibold text-slate-900">{p.name}</div>
              <div className="mt-0.5 text-sm font-medium tabular-nums text-indigo-700">{p.steps}</div>
              <p className="mt-1 text-sm text-slate-600">{p.when}</p>
            </li>
          ))}
        </ul>
      </GuideCard>

      <GuideCard id="pratique" title="En pratique">
        <ul className="space-y-2 text-sm text-slate-700">
          <Tip>
            <strong>Ratio eau / grain</strong> : 2,5 à 3,5 L/kg. Plus épais (2,5), la maische protège mieux les enzymes ; plus fluide (3,5),
            elle se brasse et se filtre mieux. En BIAB (tout le volume d’un coup), le ratio est bien plus haut et ça marche très bien.
          </Tip>
          <Tip>
            <strong>Température de l’eau d’empâtage</strong> : plus chaude que le palier, car le grain froid la refroidit (souvent +8 à
            +12 °C). L’étape « eau d’empâtage » du Brew Day la calcule ; préchauffez la cuve si elle est épaisse.
          </Tip>
          <Tip>
            <strong>Mesurer au cœur</strong> de la maische après avoir bien remué : les bords et le fond peuvent différer de 2 à 3 °C. Un
            écart de 2 °C change déjà la sécheresse de la bière.
          </Tip>
          <Tip>
            <strong>Test à l’iode</strong> en fin de palier : une goutte de lugol sur un peu de moût (sans grain). Ambre : conversion
            terminée ; bleu-noir : prolongez de 15 min.
          </Tip>
          <Tip>
            <strong>Rinçage</strong> à 75–78 °C, lentement, sans tasser le lit de drêches. Arrêtez quand la densité des dernières coulées
            descend sous 1.010 (tanins astringents au-delà).
          </Tip>
          <Tip>
            <strong>Efficacité basse ?</strong> Mouture trop grossière (premier suspect), palier trop court, rinçage trop rapide. L’
            <Link to="/batches/history" className={linkClass}>
              historique des brassins
            </Link>{' '}
            donne votre efficacité réelle, à reporter dans le profil d’équipement.
          </Tip>
        </ul>
      </GuideCard>

      <GuideCard id="ph" title="pH d’empâtage">
        <ul className="space-y-2 text-sm text-slate-700">
          <Tip>
            Visez <strong>{fmt(MASH_PH_RANGE[0], 1)} à {fmt(MASH_PH_RANGE[1], 1)}</strong> (5,4 idéal), mesuré sur un échantillon refroidi
            10–15 min après l’empâtage : meilleure conversion, cassure à l’ébullition, amertume plus fine.
          </Tip>
          <Tip>
            Les malts caramel et torréfiés acidifient la maische ; les bicarbonates de l’eau la remontent. Blonde + eau calcaire : pH trop
            haut ; stout + eau osmosée : pH parfois trop bas.
          </Tip>
          <Tip>
            Trop haut : acide lactique 88 % (quelques mL), malt acidulé (≈ 1 % du grain par 0,1 de pH), ou coupez l’eau avec de l’eau
            déminéralisée. Trop bas : bicarbonate de soude, ou ajoutez les malts torréfiés en fin d’empâtage.
          </Tip>
          <Tip>
            La fiche de chaque recette tout grain estime son pH d’empâtage et la dose d’acide à prévoir, à partir de l’eau saisie dans l’outil{' '}
            <Link to="/tools" className={linkClass}>
              Sels minéraux
            </Link>
            .
          </Tip>
        </ul>
      </GuideCard>

      <GuideCard id="ions" title="Les ions de l’eau">
        <p className="mb-3 text-sm text-slate-600">
          Analyse de l’eau : fiche qualité de votre commune (ARS) ou de l’eau en bouteille. Une eau osmosée ou déminéralisée part de zéro : il
          suffit d’ajouter les sels.
        </p>
        <ul className="divide-y divide-slate-100">
          {IONS.map((ion) => (
            <li key={ion.key} className="py-3 sm:flex sm:gap-4">
              <div className="shrink-0 sm:w-48">
                <div className="font-semibold text-slate-900">{ion.label}</div>
                <div className="text-xs tabular-nums text-slate-500">{ion.range}</div>
              </div>
              <p className="mt-1 text-sm text-slate-600 sm:mt-0">{ion.role}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-xl bg-indigo-50/60 px-3 py-2 text-sm text-slate-700">
          <strong>Rapport sulfates / chlorures</strong> : au-dessus de 2, la bière paraît sèche et amère ; autour de 1, équilibrée ; sous 0,7,
          ronde et maltée. C’est le réglage qui se goûte le plus.
        </p>
        <p className="mt-3 text-sm text-slate-700">
          <strong>Chlore</strong> : l’eau du robinet chlorée (ou chloraminée) donne des goûts de médicament. Un demi-cachet de Campden
          (métabisulfite) pour 20 à 40 L, dissous quelques minutes avant l’empâtage, l’élimine.
        </p>
      </GuideCard>

      <GuideCard id="profils-eau" title="Profils d’eau cibles">
        <p className="mb-3 text-sm text-slate-600">
          Repères à ajuster au goût. L’outil{' '}
          <Link to="/tools" className={linkClass}>
            Sels minéraux
          </Link>{' '}
          calcule les grammes de sels pour y arriver depuis votre eau.
        </p>
        <div className="-mx-6 overflow-x-auto px-6">
          <table className="w-full min-w-[560px] text-left text-sm tabular-nums">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-semibold">Profil</th>
                <th className="px-2 py-2 font-semibold">Ca</th>
                <th className="px-2 py-2 font-semibold">Mg</th>
                <th className="px-2 py-2 font-semibold">Na</th>
                <th className="px-2 py-2 font-semibold">SO₄</th>
                <th className="px-2 py-2 font-semibold">Cl</th>
                <th className="px-2 py-2 font-semibold">SO₄/Cl</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {WATER_TARGETS.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 pr-3">
                    <span className="font-semibold text-slate-900">{t.label}</span>
                    <span className="block text-xs text-slate-500">{t.examples}</span>
                  </td>
                  <td className="px-2 py-2">{t.profile.calcium}</td>
                  <td className="px-2 py-2">{t.profile.magnesium}</td>
                  <td className="px-2 py-2">{t.profile.sodium}</td>
                  <td className="px-2 py-2">{t.profile.sulfate}</td>
                  <td className="px-2 py-2">{t.profile.chloride}</td>
                  <td className="px-2 py-2 font-medium">{fmt(sulfateToChlorideRatio(t.profile), 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">En ppm (mg/L). Bicarbonates visés : le plus bas possible, sauf bières très foncées.</p>
      </GuideCard>
    </div>
  )
}
