import type { Fermentable, Hop, Yeast } from '@/lib/brew-calc/types'

/**
 * Bibliothèque d'ingrédients courants : valeurs typiques (elles varient selon le
 * malteur, la récolte et le lot — l'étiquette du sachet fait foi) et une note
 * d'usage pour guider la conception de recette. Sert aux suggestions du formulaire
 * de recette et au guide des ingrédients (`/ingredients`).
 */

export interface LibraryFermentable extends Pick<Fermentable, 'name' | 'type' | 'colorLovibond' | 'yieldPercent'> {
  note: string
}

export interface LibraryHop extends Pick<Hop, 'name' | 'alphaAcidPercent'> {
  note: string
}

export interface LibraryYeast extends Pick<Yeast, 'name' | 'type' | 'style' | 'attenuationPercent'> {
  note: string
}

// ——— Malts, céréales et sucres ———

export type FermentableCategory = 'base' | 'caramel' | 'special' | 'roasted' | 'adjunct' | 'sugar' | 'extract'

export const FERMENTABLE_CATEGORIES: { id: FermentableCategory; label: string; advice: string }[] = [
  {
    id: 'base',
    label: 'Malts de base',
    advice:
      'L’essentiel du grain (60 à 100 %) : ils apportent les sucres et les enzymes qui convertissent l’amidon pendant l’empâtage. Le choix du malt de base donne déjà le caractère : Pilsner pour une bière nette, Pale Ale ou Maris Otter pour du biscuité, Munich pour du malté.',
  },
  {
    id: 'caramel',
    label: 'Malts caramel (crystal)',
    advice:
      'Sucres déjà caramélisés dans le grain : couleur, rondeur et douceur, mais peu fermentescibles (la DF monte). Rester sous 15 % au total ; plus le chiffre (°L) est haut, plus le goût est foncé (miel → caramel → raisin sec).',
  },
  {
    id: 'special',
    label: 'Malts spéciaux',
    advice:
      'Touraillés plus fort ou traités (fumé, acidulé) : une touche aromatique à petites doses, 2 à 10 % en général. Peu ou pas d’enzymes : ils ne remplacent pas le malt de base.',
  },
  {
    id: 'roasted',
    label: 'Malts torréfiés',
    advice:
      'Café, chocolat, grillé et beaucoup de couleur dès 2 à 5 %. Ils acidifient l’empâtage : une eau plus alcaline (bicarbonates) leur convient. Les versions dépelliculées (Carafa Spécial) colorent sans âpreté.',
  },
  {
    id: 'adjunct',
    label: 'Céréales non maltées (riz, maïs, blé, avoine…)',
    advice:
      'Sans enzymes : elles comptent sur celles du malt de base (garder au moins 60 % de malt). Les flocons sont précuits et vont directement à l’empâtage ; le grain cru (riz, maïs) doit d’abord être cuit pour gélatiniser son amidon. Riz et maïs allègent et assèchent ; blé, avoine et orge apportent corps, mousse et trouble. Au-delà de 15–20 %, des balles de riz évitent un empâtage collant.',
  },
  {
    id: 'sugar',
    label: 'Sucres',
    advice:
      'Fermentent presque entièrement : ils montent l’alcool sans alourdir, et assèchent la finale (tripel, IPA forte). 5 à 20 % des fermentescibles ; au-delà, la bière devient mince et « alcooleuse ».',
  },
  {
    id: 'extract',
    label: 'Extraits de malt',
    advice: 'Moût concentré : pour brasser sans empâtage, ou rattraper une densité trop basse le jour du brassage.',
  },
]

export interface FermentableGuide extends LibraryFermentable {
  category: FermentableCategory
  /** Ingrédients au rôle proche, si celui-ci est introuvable. */
  substitutes: string[]
}

export const FERMENTABLE_LIBRARY: FermentableGuide[] = [
  // Malts de base
  { category: 'base', substitutes: ['Pale Ale', 'Vienne'], name: 'Pilsner', type: 'grain', colorLovibond: 1.6, yieldPercent: 81, note: 'Malt de base très clair, goût de céréale et de miel. Jusqu’à 100 % (lagers, blondes, belges). Ébullition de 90 min conseillée (DMS).' },
  { category: 'base', substitutes: ['Maris Otter', 'Pilsner'], name: 'Pale Ale', type: 'grain', colorLovibond: 3, yieldPercent: 80, note: 'Malt de base un peu plus touraillé que le Pilsner : biscuité, rond. Jusqu’à 100 % (ales anglaises et américaines).' },
  { category: 'base', substitutes: ['Pale Ale'], name: 'Maris Otter', type: 'grain', colorLovibond: 3, yieldPercent: 81, note: 'Malt de base anglais de référence, riche et biscuité. Jusqu’à 100 % (bitters, porters, barley wines).' },
  { category: 'base', substitutes: ['Munich', 'Pale Ale'], name: 'Vienne', type: 'grain', colorLovibond: 3.5, yieldPercent: 79, note: 'Malt de base doré, notes de pain grillé. Jusqu’à 100 % (Vienna lager, Märzen) ou 10–30 % pour de la rondeur.' },
  { category: 'base', substitutes: ['Vienne', 'Melanoidin'], name: 'Munich', type: 'grain', colorLovibond: 9, yieldPercent: 78, note: 'Très malté, pain et croûte. Jusqu’à 100 % (Dunkel, Bock) ; 10–20 % pour plus de corps maltée.' },
  { category: 'base', substitutes: ['Flocons de blé', 'Malt d’épeautre'], name: 'Malt de blé', type: 'grain', colorLovibond: 2, yieldPercent: 82, note: 'Mousse et tenue, goût de pain frais. 50–70 % en Weizen/blanche, 5–10 % pour la mousse. Pas d’enveloppe : filtration plus lente.' },
  { category: 'base', substitutes: [], name: 'Malt de seigle', type: 'grain', colorLovibond: 3.5, yieldPercent: 80, note: 'Épicé, sec, texture huileuse. 10–20 % ; au-delà, prévoir des balles de riz (empâtage collant).' },
  { category: 'base', substitutes: ['Malt de blé'], name: 'Malt d’épeautre', type: 'grain', colorLovibond: 2.5, yieldPercent: 80, note: 'Céréale ancienne proche du blé : noisette, pain complet. 10–50 % (blanches, saisons, bières de ferme).' },
  { category: 'base', substitutes: ['Flocons d’avoine'], name: 'Malt d’avoine', type: 'grain', colorLovibond: 2, yieldPercent: 75, note: 'Avoine maltée : soyeuse comme les flocons, avec un goût de céréale plus marqué. 5–20 % (NEIPA, stouts).' },
  // Malts caramel
  { category: 'caramel', substitutes: ['Flocons d’orge'], name: 'Carapils', type: 'grain', colorLovibond: 1.5, yieldPercent: 72, note: 'Malt « dextrine » : mousse et corps sans couleur. 3–10 %.' },
  { category: 'caramel', substitutes: ['Crystal 40'], name: 'Crystal 20', type: 'grain', colorLovibond: 20, yieldPercent: 75, note: 'Caramel léger, miel. 5–15 %. Augmente la DF (sucres peu fermentescibles).' },
  { category: 'caramel', substitutes: ['CaraMunich', 'Crystal 20'], name: 'Crystal 40', type: 'grain', colorLovibond: 40, yieldPercent: 74, note: 'Caramel moyen, couleur ambrée. 5–15 % (pale ales, ambrées).' },
  { category: 'caramel', substitutes: ['Crystal 40', 'CaraMunich'], name: 'Crystal 60', type: 'grain', colorLovibond: 60, yieldPercent: 74, note: 'Caramel marqué, fruits secs. 3–10 %. Au-delà, la bière devient lourde et sucrée.' },
  { category: 'caramel', substitutes: ['Special B', 'Crystal 60'], name: 'Crystal 120', type: 'grain', colorLovibond: 120, yieldPercent: 72, note: 'Caramel foncé, raisin sec, brûlé léger. 2–5 % (ales foncées, porters).' },
  { category: 'caramel', substitutes: ['Crystal 40', 'Crystal 60'], name: 'CaraMunich', type: 'grain', colorLovibond: 45, yieldPercent: 74, note: 'Caramel malté, biscuit. 5–15 % (bières belges, ambrées, Bock).' },
  { category: 'caramel', substitutes: ['Crystal 120'], name: 'Special B', type: 'grain', colorLovibond: 145, yieldPercent: 70, note: 'Caramel belge très foncé : raisin sec, prune, figue. 2–8 % (dubbel, quadrupel, brunes belges).' },
  // Malts spéciaux
  { category: 'special', substitutes: ['Malt ambré', 'Melanoidin'], name: 'Biscuit', type: 'grain', colorLovibond: 25, yieldPercent: 75, note: 'Biscuit, pain grillé, sec. 3–10 %.' },
  { category: 'special', substitutes: ['Munich', 'Biscuit'], name: 'Melanoidin', type: 'grain', colorLovibond: 27, yieldPercent: 76, note: 'Intensément malté, miel, croûte de pain : imite une décoction. 2–10 %.' },
  { category: 'special', substitutes: ['Biscuit'], name: 'Malt ambré', type: 'grain', colorLovibond: 27, yieldPercent: 75, note: 'Anglais : biscuit sec, pain grillé, café léger. 5–15 % (porters, milds, bitters foncées).' },
  { category: 'special', substitutes: [], name: 'Malt fumé', type: 'grain', colorLovibond: 2.5, yieldPercent: 80, note: 'Fumé au bois de hêtre (Rauchbier). 10 % pour une touche, jusqu’à 100 % pour une Rauchbier de Bamberg.' },
  { category: 'special', substitutes: [], name: 'Malt acidulé', type: 'grain', colorLovibond: 2, yieldPercent: 58, note: 'Baisse le pH de l’empâtage (≈ 0,1 par 1 % du grain). 1–5 %, au-delà il donne une acidité perceptible.' },
  // Malts torréfiés
  { category: 'roasted', substitutes: ['Carafa Spécial III', 'Orge torréfiée'], name: 'Malt chocolat', type: 'grain', colorLovibond: 350, yieldPercent: 65, note: 'Chocolat, café doux. 2–8 % (porters, stouts, brunes).' },
  { category: 'roasted', substitutes: ['Malt noir (Black Patent)', 'Malt chocolat'], name: 'Orge torréfiée', type: 'grain', colorLovibond: 300, yieldPercent: 55, note: 'Orge non maltée torréfiée : café, sec, amer. La signature du stout irlandais, 5–10 %.' },
  { category: 'roasted', substitutes: ['Malt noir (Black Patent)'], name: 'Carafa Spécial III', type: 'grain', colorLovibond: 470, yieldPercent: 65, note: 'Malt noir dépelliculé : beaucoup de couleur, peu d’âpreté. 1–5 % (Schwarzbier, Black IPA).' },
  { category: 'roasted', substitutes: ['Carafa Spécial III', 'Orge torréfiée'], name: 'Malt noir (Black Patent)', type: 'grain', colorLovibond: 500, yieldPercent: 55, note: 'Le plus foncé : couleur intense, goût brûlé et âpre. 1–3 % pour colorer, à manier avec prudence.' },
  // Céréales non maltées
  { category: 'adjunct', substitutes: ['Malt d’avoine', 'Flocons d’orge'], name: 'Flocons d’avoine', type: 'grain', colorLovibond: 1, yieldPercent: 72, note: 'Texture soyeuse, trouble. 5–20 % (NEIPA, oatmeal stout). Prévoir des balles de riz au-delà de 15 %.' },
  { category: 'adjunct', substitutes: ['Carapils', 'Flocons d’avoine'], name: 'Flocons d’orge', type: 'grain', colorLovibond: 1.7, yieldPercent: 70, note: 'Corps et mousse, sec. 5–15 % (stout irlandais).' },
  { category: 'adjunct', substitutes: ['Blé cru', 'Malt de blé'], name: 'Flocons de blé', type: 'grain', colorLovibond: 2, yieldPercent: 77, note: 'Blé précuit : trouble, mousse, rondeur. 10–30 % (blanche, NEIPA). Directement à l’empâtage.' },
  { category: 'adjunct', substitutes: ['Flocons de blé', 'Malt de blé'], name: 'Blé cru', type: 'grain', colorLovibond: 2, yieldPercent: 77, note: 'Blé non malté : le trouble et la rondeur acidulée de la blanche belge, 30–50 % avec du Pilsner. Filtration lente : balles de riz conseillées.' },
  { category: 'adjunct', substitutes: ['Riz cru', 'Flocons de maïs', 'Sucre blanc (saccharose)'], name: 'Flocons de riz', type: 'grain', colorLovibond: 1, yieldPercent: 80, note: 'Allège corps et couleur, finale très sèche et nette (lagers légères, rice lager japonaise). 10–30 %. Neutre en goût.' },
  { category: 'adjunct', substitutes: ['Flocons de riz'], name: 'Riz cru', type: 'grain', colorLovibond: 1, yieldPercent: 80, note: 'Même effet que les flocons, mais à cuire avant (gélatinisation vers 70–80 °C, ou riz bien cuit à l’eau) puis à ajouter à l’empâtage.' },
  { category: 'adjunct', substitutes: ['Flocons de riz'], name: 'Flocons de maïs', type: 'grain', colorLovibond: 1, yieldPercent: 80, note: 'Allège et assèche, léger goût de maïs doux (cream ale, lager américaine, certaines bières belges). 10–25 %.' },
  // Sucres
  { category: 'sugar', substitutes: ['Dextrose', 'Sucre candi clair'], name: 'Sucre blanc (saccharose)', type: 'sugar', colorLovibond: 0, yieldPercent: 100, note: 'Fermente entièrement : allège le corps et assèche (tripel, IPA forte). 5–20 % des fermentescibles.' },
  { category: 'sugar', substitutes: ['Sucre blanc (saccharose)'], name: 'Dextrose', type: 'sugar', colorLovibond: 0, yieldPercent: 91, note: 'Glucose : fermente entièrement, comme le sucre blanc. Aussi utilisé pour le resucrage.' },
  { category: 'sugar', substitutes: ['Sucre blanc (saccharose)', 'Dextrose'], name: 'Sucre candi clair', type: 'sugar', colorLovibond: 1, yieldPercent: 78, note: 'Sucre belge : assèche sans couleur (tripel, golden strong).' },
  { category: 'sugar', substitutes: [], name: 'Sucre candi brun', type: 'sugar', colorLovibond: 75, yieldPercent: 78, note: 'Caramel, fruits secs, couleur (dubbel, quadrupel).' },
  { category: 'sugar', substitutes: [], name: 'Miel', type: 'sugar', colorLovibond: 1, yieldPercent: 76, note: 'Fermente presque entièrement : il reste peu de son goût. Ajouter en fin d’ébullition ou en fermentation pour garder des arômes.' },
  // Extraits
  { category: 'extract', substitutes: ['Extrait de malt liquide (clair)'], name: 'Extrait de malt sec (clair)', type: 'extract', colorLovibond: 4, yieldPercent: 95, note: 'Extrait déshydraté : densité sans empâtage, ou pour corriger une DI trop basse.' },
  { category: 'extract', substitutes: ['Extrait de malt sec (clair)'], name: 'Extrait de malt liquide (clair)', type: 'extract', colorLovibond: 4, yieldPercent: 78, note: 'Sirop d’extrait (≈ 20 % d’eau). À ajouter de préférence en fin d’ébullition pour limiter la coloration.' },
]

// ——— Houblons ———

/** Rôle principal : amérisant (riche en alpha, début d'ébullition), aromatique (fin d'ébullition, whirlpool, dry hop) ou les deux. */
export type HopRole = 'bittering' | 'aroma' | 'dual'

export const HOP_ROLES: { id: HopRole; label: string; advice: string }[] = [
  {
    id: 'bittering',
    label: 'Amérisants',
    advice:
      'Riches en acides alpha : ajoutés en début d’ébullition (60 min), ils donnent l’amertume avec peu de houblon. Leur arôme part à l’ébullition, d’où l’intérêt d’un houblon au goût propre.',
  },
  {
    id: 'dual',
    label: 'Mixtes',
    advice: 'Assez d’alpha pour amériser, assez d’huiles pour parfumer : un seul houblon peut suffire pour toute la recette.',
  },
  {
    id: 'aroma',
    label: 'Aromatiques',
    advice:
      'Leurs huiles essentielles sont volatiles : à ajouter dans les 15 dernières minutes, au whirlpool (vers 80 °C) ou en dry hop pendant la fermentation. Plus tard on les ajoute, plus l’arôme reste et moins ils amérisent.',
  },
]

export interface HopGuide extends LibraryHop {
  role: HopRole
  origin: string
  /** Houblons au profil proche, si celui-ci est introuvable. */
  substitutes: string[]
}

export const HOP_LIBRARY: HopGuide[] = [
  // Amérisants
  { role: 'bittering', origin: 'Allemagne', substitutes: ['Warrior', 'Herkules'], name: 'Magnum', alphaAcidPercent: 13, note: 'Amérisant propre et neutre. Idéal en début d’ébullition.' },
  { role: 'bittering', origin: 'Allemagne', substitutes: ['Magnum', 'Columbus'], name: 'Herkules', alphaAcidPercent: 16, note: 'Très amérisant, légèrement épicé et résineux.' },
  { role: 'dual', origin: 'États-Unis', substitutes: ['Chinook', 'Herkules'], name: 'Columbus', alphaAcidPercent: 15, note: 'Amérisant puissant, résine, poivre, agrumes (aussi appelé CTZ).' },
  { role: 'bittering', origin: 'États-Unis', substitutes: ['Magnum'], name: 'Warrior', alphaAcidPercent: 16, note: 'Amérisant doux et propre, peu de cohumulone.' },
  { role: 'bittering', origin: 'Allemagne', substitutes: ['Herkules'], name: 'Polaris', alphaAcidPercent: 20, note: 'Très riche en alpha, notes de menthe glaciale.' },
  // Américains / Nouveau Monde
  { role: 'aroma', origin: 'États-Unis', substitutes: ['Centennial', 'Amarillo'], name: 'Cascade', alphaAcidPercent: 6.5, note: 'Pamplemousse, fleurs : l’arôme de l’American Pale Ale.' },
  { role: 'dual', origin: 'États-Unis', substitutes: ['Cascade', 'Columbus'], name: 'Centennial', alphaAcidPercent: 10, note: 'Agrumes et fleurs, un « super Cascade ». Polyvalent.' },
  { role: 'dual', origin: 'États-Unis', substitutes: ['Columbus', 'Simcoe'], name: 'Chinook', alphaAcidPercent: 13, note: 'Pin, résine, pamplemousse. Amérisant ou arôme pour les West Coast IPA.' },
  { role: 'aroma', origin: 'États-Unis', substitutes: ['Galaxy', 'Mosaic'], name: 'Citra', alphaAcidPercent: 12.5, note: 'Agrumes, mangue, fruit de la passion. Star des IPA, surtout en whirlpool et dry hop.' },
  { role: 'aroma', origin: 'États-Unis', substitutes: ['Citra', 'Simcoe'], name: 'Mosaic', alphaAcidPercent: 12, note: 'Myrtille, fruits tropicaux, pin. Très complexe en dry hop.' },
  { role: 'dual', origin: 'États-Unis', substitutes: ['Mosaic', 'Chinook'], name: 'Simcoe', alphaAcidPercent: 13, note: 'Pin, fruit de la passion, résine.' },
  { role: 'aroma', origin: 'États-Unis', substitutes: ['Cascade', 'Centennial'], name: 'Amarillo', alphaAcidPercent: 9, note: 'Orange, fleurs. Se marie bien avec Citra et Simcoe.' },
  { role: 'aroma', origin: 'États-Unis', substitutes: ['Citra', 'Mosaic'], name: 'El Dorado', alphaAcidPercent: 15, note: 'Fruits à noyau, poire, bonbon.' },
  { role: 'aroma', origin: 'États-Unis', substitutes: [], name: 'Sabro', alphaAcidPercent: 14, note: 'Noix de coco, mandarine, crème.' },
  { role: 'aroma', origin: 'États-Unis', substitutes: ['Mosaic'], name: 'Strata', alphaAcidPercent: 13, note: 'Fruit de la passion, fraise, cannabis.' },
  { role: 'aroma', origin: 'États-Unis', substitutes: ['Fuggle', 'Styrian Golding'], name: 'Willamette', alphaAcidPercent: 5, note: 'Version américaine du Fuggle : épicé, floral, terreux.' },
  { role: 'aroma', origin: 'Japon', substitutes: [], name: 'Sorachi Ace', alphaAcidPercent: 12, note: 'Citron, aneth, noix de coco. Très typé : à doser.' },
  { role: 'aroma', origin: 'Australie', substitutes: ['Citra'], name: 'Galaxy', alphaAcidPercent: 14, note: 'Australien : fruit de la passion, pêche. Très intense.' },
  { role: 'aroma', origin: 'Nouvelle-Zélande', substitutes: ['Hallertau Blanc'], name: 'Nelson Sauvin', alphaAcidPercent: 12, note: 'Néo-zélandais : raisin blanc, groseille à maquereau (sauvignon).' },
  { role: 'aroma', origin: 'Nouvelle-Zélande', substitutes: ['Saaz'], name: 'Motueka', alphaAcidPercent: 7, note: 'Néo-zélandais : citron vert, mojito.' },
  // Européens nobles et traditionnels
  { role: 'aroma', origin: 'Tchéquie', substitutes: ['Hallertau Mittelfrüh', 'Strisselspalt'], name: 'Saaz', alphaAcidPercent: 3.5, note: 'Noble tchèque : épicé, herbacé, délicat. La signature de la Pils de Bohême.' },
  { role: 'aroma', origin: 'Allemagne', substitutes: ['Hersbrucker', 'Tettnang'], name: 'Hallertau Mittelfrüh', alphaAcidPercent: 4, note: 'Noble allemand : floral, épicé doux (lagers, Weizen).' },
  { role: 'aroma', origin: 'Allemagne', substitutes: ['Saaz', 'Spalt'], name: 'Tettnang', alphaAcidPercent: 4.5, note: 'Noble allemand : épicé, herbacé, floral.' },
  { role: 'aroma', origin: 'Allemagne', substitutes: ['Tettnang', 'Saaz'], name: 'Spalt', alphaAcidPercent: 4.5, note: 'Noble allemand : boisé, épicé (Altbier).' },
  { role: 'aroma', origin: 'Allemagne', substitutes: ['Hallertau Mittelfrüh'], name: 'Hersbrucker', alphaAcidPercent: 3, note: 'Floral, fruité léger, épices douces.' },
  { role: 'dual', origin: 'Allemagne', substitutes: ['Northern Brewer'], name: 'Perle', alphaAcidPercent: 7.5, note: 'Allemand : menthe, épices. Amérisant doux ou arôme.' },
  { role: 'dual', origin: 'Angleterre / Allemagne', substitutes: ['Perle'], name: 'Northern Brewer', alphaAcidPercent: 8.5, note: 'Boisé, mentholé, résineux (California Common, porters).' },
  { role: 'aroma', origin: 'Allemagne', substitutes: ['Nelson Sauvin'], name: 'Hallertau Blanc', alphaAcidPercent: 10, note: 'Allemand moderne : raisin blanc, fruits tropicaux.' },
  { role: 'aroma', origin: 'Allemagne', substitutes: ['Cascade', 'Amarillo'], name: 'Mandarina Bavaria', alphaAcidPercent: 8.5, note: 'Allemand moderne : mandarine, agrumes.' },
  { role: 'aroma', origin: 'Allemagne', substitutes: [], name: 'Huell Melon', alphaAcidPercent: 7, note: 'Allemand moderne : melon, fraise.' },
  { role: 'aroma', origin: 'France (Alsace)', substitutes: ['Hersbrucker', 'Saaz'], name: 'Strisselspalt', alphaAcidPercent: 2.5, note: 'Alsacien : floral, fruité, épices douces.' },
  { role: 'aroma', origin: 'France (Alsace)', substitutes: ['Strisselspalt', 'Willamette'], name: 'Aramis', alphaAcidPercent: 7.5, note: 'Alsacien : épicé, herbacé, agrumes.' },
  { role: 'aroma', origin: 'France (Alsace)', substitutes: [], name: 'Barbe Rouge', alphaAcidPercent: 8.5, note: 'Alsacien : fruits rouges, fraise, groseille.' },
  { role: 'aroma', origin: 'France (Alsace)', substitutes: ['Strisselspalt'], name: 'Triskel', alphaAcidPercent: 8, note: 'Alsacien : floral, agrumes, fruits blancs.' },
  { role: 'aroma', origin: 'Angleterre', substitutes: ['Fuggle', 'Styrian Golding'], name: 'East Kent Golding', alphaAcidPercent: 5.5, note: 'Anglais : miel, épices douces, terreux (bitters, ESB).' },
  { role: 'aroma', origin: 'Angleterre', substitutes: ['Willamette', 'East Kent Golding'], name: 'Fuggle', alphaAcidPercent: 4.5, note: 'Anglais : terreux, boisé, menthe (porters, milds).' },
  { role: 'dual', origin: 'Angleterre', substitutes: ['Northern Brewer', 'Target'], name: 'Challenger', alphaAcidPercent: 7.5, note: 'Anglais : épicé, cèdre, thé vert. Amérisant ou arôme.' },
  { role: 'bittering', origin: 'Angleterre', substitutes: ['Challenger', 'Northern Brewer'], name: 'Target', alphaAcidPercent: 11, note: 'Anglais : amérisant, sauge, épices.' },
  { role: 'aroma', origin: 'Slovénie', substitutes: ['Fuggle', 'East Kent Golding'], name: 'Styrian Golding', alphaAcidPercent: 4.5, note: 'Slovène : épicé, résineux, terreux (Saison, belges).' },
]

// ——— Levures ———

export type YeastFamily = 'american' | 'neipa' | 'english' | 'german-ale' | 'abbey' | 'wheat' | 'saison' | 'kveik' | 'lager'

export const YEAST_FAMILIES: { id: YeastFamily; label: string; beers: string; advice: string }[] = [
  {
    id: 'american',
    label: 'Ale américaine (IPA, pale ale)',
    beers: 'IPA West Coast, pale ale, ambrée américaine, blonde',
    advice: 'Propres et neutres : elles laissent la place au houblon et au malt. Le choix sans risque pour débuter, vers 18–20 °C.',
  },
  {
    id: 'neipa',
    label: 'NEIPA / hazy',
    beers: 'NEIPA, hazy IPA, pale ale juteuse',
    advice: 'Fruitées (pêche, abricot), elles gardent le trouble et arrondissent le corps ; elles exaltent les houblons tropicaux en dry hop pendant la fermentation.',
  },
  {
    id: 'english',
    label: 'Ale anglaise',
    beers: 'bitter, ESB, porter, stout, brown ale, mild',
    advice: 'Légèrement fruitées, très floculantes (bière claire rapidement). Certaines atténuent peu et laissent du corps : idéal pour les bières maltées.',
  },
  {
    id: 'german-ale',
    label: 'Ale allemande (Kölsch, Alt)',
    beers: 'Kölsch, Altbier, blonde légère',
    advice: 'Fermentation haute mais profil presque lager : propre, florale. Fermenter frais (15–18 °C) puis garder au froid quelques semaines.',
  },
  {
    id: 'abbey',
    label: 'Abbaye & trappiste',
    beers: 'blonde d’abbaye, dubbel, tripel, quadrupel, belge forte',
    advice: 'Fruits mûrs (banane, poire) et épices (clou de girofle, poivre), tolèrent l’alcool. Démarrer vers 18–20 °C puis laisser monter : les arômes se développent en fin de fermentation.',
  },
  {
    id: 'wheat',
    label: 'Blé : Weizen & blanche',
    beers: 'Weizen, Hefeweizen, blanche belge (witbier)',
    advice: 'Weizen : banane et clou de girofle (plus de banane au chaud, plus de girofle au frais). Blanche belge : épicée, agrumes. Peu floculantes : le trouble fait partie du style.',
  },
  {
    id: 'saison',
    label: 'Saison & bière de ferme',
    beers: 'saison, bière de garde légère, farmhouse ale',
    advice: 'Très atténuantes, poivrées et sèches ; elles aiment la chaleur (jusqu’à 30 °C et plus). Les souches diastaticus peuvent continuer en bouteille : prudence au resucrage.',
  },
  {
    id: 'kveik',
    label: 'Kveik',
    beers: 'IPA, pale ale, bières de ferme norvégiennes',
    advice: 'Levures de ferme norvégiennes : fermentent en 2–3 jours à 30–40 °C sans faux goûts. Pratique l’été sans contrôle de température.',
  },
  {
    id: 'lager',
    label: 'Lager',
    beers: 'Pils, Helles, Märzen, Bock, lagers',
    advice: 'Fermentation basse à 9–15 °C, plus lente, puis garde au froid (lagering) plusieurs semaines pour un goût net. Il faut deux fois plus de levure qu’une ale.',
  },
]

export interface YeastGuide extends LibraryYeast {
  family: YeastFamily
  /** Plage de fermentation conseillée par le fabricant (°C). */
  tempC: [number, number]
  /** Levures au profil proche (souvent la même souche chez une autre marque). */
  substitutes: string[]
}

export const YEAST_LIBRARY: YeastGuide[] = [
  // Fermentis
  { family: 'american', tempC: [18, 22], substitutes: ['Wyeast 1056 American Ale', 'WLP001 California Ale', 'LalBrew BRY-97', 'Mangrove Jack’s M44 US West Coast'], name: 'SafAle US-05', type: 'dry', style: 'ale', attenuationPercent: 78, note: 'Ale américaine propre et neutre, 18–22 °C. Laisse parler le houblon. Fermentis annonce 78–82 % d’atténuation.' },
  { family: 'english', tempC: [15, 20], substitutes: ['LalBrew Nottingham', 'Mangrove Jack’s M36 Liberty Bell'], name: 'SafAle S-04', type: 'dry', style: 'ale', attenuationPercent: 75, note: 'Ale anglaise : légèrement fruitée, flocule très bien. 15–20 °C.' },
  { family: 'german-ale', tempC: [15, 20], substitutes: ['SafAle US-05'], name: 'SafAle K-97', type: 'dry', style: 'ale', attenuationPercent: 81, note: 'Ale allemande (Kölsch, Alt) : propre, florale. 15–20 °C.' },
  { family: 'wheat', tempC: [18, 24], substitutes: ['LalBrew Munich Classic', 'Mangrove Jack’s M20 Bavarian Wheat', 'WLP300 Hefeweizen', 'Wyeast 3068 Weihenstephan Weizen'], name: 'SafAle WB-06', type: 'dry', style: 'ale', attenuationPercent: 86, note: 'Bière de blé : banane et clou de girofle. 18–24 °C. Atténue souvent plus qu’annoncé.' },
  { family: 'abbey', tempC: [18, 24], substitutes: ['LalBrew Abbaye', 'LalBrew Wit'], name: 'SafAle T-58', type: 'dry', style: 'ale', attenuationPercent: 75, note: 'Belge : épicée, poivrée. 18–24 °C.' },
  { family: 'abbey', tempC: [18, 25], substitutes: ['LalBrew Abbaye', 'Mangrove Jack’s M47 Belgian Abbey', 'WLP530 Abbey Ale', 'Wyeast 3787 Trappist High Gravity'], name: 'SafAle BE-256', type: 'dry', style: 'ale', attenuationPercent: 86, note: 'Abbaye : fruits mûrs, fermentation rapide (dubbel, tripel, quadrupel). 18–25 °C.' },
  { family: 'saison', tempC: [18, 28], substitutes: ['LalBrew Belle Saison', 'Mangrove Jack’s M29 French Saison', 'Wyeast 3711 French Saison'], name: 'SafAle BE-134', type: 'dry', style: 'ale', attenuationPercent: 90, note: 'Saison : très sèche, poivrée, fruitée. 18–28 °C.' },
  { family: 'lager', tempC: [9, 15], substitutes: ['WLP830 German Lager', 'Wyeast 2124 Bohemian Lager', 'LalBrew Diamond Lager', 'Mangrove Jack’s M84 Bohemian Lager'], name: 'SafLager W-34/70', type: 'dry', style: 'lager', attenuationPercent: 83, note: 'La levure de lager de référence : propre, maltée. 9–15 °C.' },
  { family: 'lager', tempC: [9, 15], substitutes: ['SafLager W-34/70'], name: 'SafLager S-23', type: 'dry', style: 'lager', attenuationPercent: 82, note: 'Lager fruitée et ester. 9–15 °C.' },
  // Lallemand
  { family: 'english', tempC: [14, 21], substitutes: ['SafAle S-04', 'SafAle US-05'], name: 'LalBrew Nottingham', type: 'dry', style: 'ale', attenuationPercent: 80, note: 'Ale anglaise neutre et robuste, tolère le froid (14–21 °C).' },
  { family: 'neipa', tempC: [18, 22], substitutes: ['LalBrew New England', 'Wyeast 1318 London Ale III'], name: 'LalBrew Verdant IPA', type: 'dry', style: 'ale', attenuationPercent: 77, note: 'NEIPA : abricot, corps doux, reste trouble. 18–22 °C.' },
  { family: 'neipa', tempC: [18, 22], substitutes: ['LalBrew Verdant IPA', 'Wyeast 1318 London Ale III'], name: 'LalBrew New England', type: 'dry', style: 'ale', attenuationPercent: 80, note: 'NEIPA : pêche, fruits à noyau, exalte les houblons tropicaux. 18–22 °C.' },
  { family: 'american', tempC: [15, 22], substitutes: ['SafAle US-05', 'Mangrove Jack’s M44 US West Coast'], name: 'LalBrew BRY-97', type: 'dry', style: 'ale', attenuationPercent: 80, note: 'West Coast : propre, met en valeur le houblon.' },
  { family: 'saison', tempC: [20, 35], substitutes: ['SafAle BE-134', 'Mangrove Jack’s M29 French Saison', 'Wyeast 3711 French Saison'], name: 'LalBrew Belle Saison', type: 'dry', style: 'ale', attenuationPercent: 90, note: 'Saison : très sèche, poivrée, agrumes. Supporte jusqu’à 35 °C.' },
  { family: 'abbey', tempC: [17, 25], substitutes: ['SafAle BE-256', 'Mangrove Jack’s M47 Belgian Abbey', 'Wyeast 1214 Belgian Abbey'], name: 'LalBrew Abbaye', type: 'dry', style: 'ale', attenuationPercent: 80, note: 'Belge d’abbaye : fruits, épices. 17–25 °C.' },
  { family: 'wheat', tempC: [17, 22], substitutes: ['SafAle WB-06', 'Mangrove Jack’s M20 Bavarian Wheat', 'Wyeast 3068 Weihenstephan Weizen'], name: 'LalBrew Munich Classic', type: 'dry', style: 'ale', attenuationPercent: 77, note: 'Weizen bavaroise : banane et clou de girofle équilibrés. 17–22 °C.' },
  { family: 'wheat', tempC: [17, 25], substitutes: ['Wyeast 3944 Belgian Witbier', 'WLP400 Belgian Wit'], name: 'LalBrew Wit', type: 'dry', style: 'ale', attenuationPercent: 75, note: 'Blanche belge : épicée, agrumes, légèrement phénolique. 17–25 °C.' },
  { family: 'kveik', tempC: [25, 40], substitutes: [], name: 'LalBrew Voss Kveik', type: 'dry', style: 'ale', attenuationPercent: 80, note: 'Kveik norvégien : orange, fermente vite et chaud (25–40 °C) sans faux goût.' },
  { family: 'english', tempC: [18, 22], substitutes: ['Wyeast 1968 London ESB', 'WLP002 English Ale'], name: 'LalBrew London ESB', type: 'dry', style: 'ale', attenuationPercent: 67, note: 'Anglaise peu atténuante : laisse du corps (bitters, milds). Ne fermente pas le maltotriose.' },
  { family: 'lager', tempC: [10, 15], substitutes: ['SafLager W-34/70'], name: 'LalBrew Diamond Lager', type: 'dry', style: 'lager', attenuationPercent: 80, note: 'Lager propre, 10–15 °C.' },
  // Mangrove Jack's
  { family: 'american', tempC: [18, 23], substitutes: ['SafAle US-05', 'LalBrew BRY-97'], name: 'Mangrove Jack’s M44 US West Coast', type: 'dry', style: 'ale', attenuationPercent: 80, note: 'Ale américaine propre et sèche : West Coast IPA, pale ale. 18–23 °C.' },
  { family: 'english', tempC: [18, 23], substitutes: ['SafAle S-04'], name: 'Mangrove Jack’s M36 Liberty Bell', type: 'dry', style: 'ale', attenuationPercent: 76, note: 'Ale anglo-américaine légèrement fruitée, bon corps (pale ales, bitters). 18–23 °C.' },
  { family: 'english', tempC: [18, 22], substitutes: ['SafAle S-04', 'LalBrew London ESB'], name: 'Mangrove Jack’s M15 Empire Ale', type: 'dry', style: 'ale', attenuationPercent: 72, note: 'Fruits rouges, corps plein : ambrées, brunes, porters. 18–22 °C.' },
  { family: 'abbey', tempC: [18, 25], substitutes: ['SafAle BE-256', 'LalBrew Abbaye'], name: 'Mangrove Jack’s M47 Belgian Abbey', type: 'dry', style: 'ale', attenuationPercent: 75, note: 'Abbaye : fruits, épices douces (dubbel, tripel). 18–25 °C.' },
  { family: 'saison', tempC: [26, 32], substitutes: ['SafAle BE-134', 'LalBrew Belle Saison'], name: 'Mangrove Jack’s M29 French Saison', type: 'dry', style: 'ale', attenuationPercent: 87, note: 'Saison française : poivrée, agrumes, finale très sèche. 26–32 °C.' },
  { family: 'wheat', tempC: [18, 25], substitutes: ['SafAle WB-06', 'LalBrew Munich Classic'], name: 'Mangrove Jack’s M20 Bavarian Wheat', type: 'dry', style: 'ale', attenuationPercent: 74, note: 'Weizen : banane et clou de girofle, reste trouble. 18–25 °C.' },
  { family: 'lager', tempC: [10, 15], substitutes: ['SafLager W-34/70', 'Wyeast 2124 Bohemian Lager'], name: 'Mangrove Jack’s M84 Bohemian Lager', type: 'dry', style: 'lager', attenuationPercent: 75, note: 'Lager de Bohême : maltée, ronde (Pils, Helles). 10–15 °C.' },
  { family: 'lager', tempC: [18, 20], substitutes: ['SafLager W-34/70'], name: 'Mangrove Jack’s M54 Californian Lager', type: 'dry', style: 'lager', attenuationPercent: 80, note: 'Lager qui fermente à température d’ale (18–20 °C) : pratique sans frigo (California Common).' },
  // Liquides
  { family: 'american', tempC: [16, 22], substitutes: ['SafAle US-05', 'WLP001 California Ale'], name: 'Wyeast 1056 American Ale', type: 'liquid', style: 'ale', attenuationPercent: 75, note: 'Équivalent liquide de l’US-05 : propre, neutre.' },
  { family: 'neipa', tempC: [18, 22], substitutes: ['LalBrew Verdant IPA'], name: 'Wyeast 1318 London Ale III', type: 'liquid', style: 'ale', attenuationPercent: 73, note: 'NEIPA : fruitée, ronde, garde le trouble.' },
  { family: 'english', tempC: [18, 22], substitutes: ['LalBrew London ESB', 'WLP002 English Ale'], name: 'Wyeast 1968 London ESB', type: 'liquid', style: 'ale', attenuationPercent: 69, note: 'Anglaise très floculante, maltée et fruitée (ESB, bitters).' },
  { family: 'abbey', tempC: [18, 25], substitutes: ['WLP530 Abbey Ale', 'SafAle BE-256'], name: 'Wyeast 3787 Trappist High Gravity', type: 'liquid', style: 'ale', attenuationPercent: 77, note: 'Trappiste (Westmalle) : fruits, épices, tolère l’alcool.' },
  { family: 'abbey', tempC: [20, 26], substitutes: ['WLP500 Monastery Ale', 'LalBrew Abbaye'], name: 'Wyeast 1214 Belgian Abbey', type: 'liquid', style: 'ale', attenuationPercent: 75, note: 'Abbaye (Chimay) : fruits, épices, tolère l’alcool.' },
  { family: 'wheat', tempC: [17, 24], substitutes: ['WLP400 Belgian Wit', 'LalBrew Wit'], name: 'Wyeast 3944 Belgian Witbier', type: 'liquid', style: 'ale', attenuationPercent: 74, note: 'Blanche belge : épicée, acidulée, agrumes.' },
  { family: 'wheat', tempC: [18, 24], substitutes: ['WLP300 Hefeweizen', 'SafAle WB-06'], name: 'Wyeast 3068 Weihenstephan Weizen', type: 'liquid', style: 'ale', attenuationPercent: 75, note: 'Weizen classique : banane et clou de girofle.' },
  { family: 'saison', tempC: [18, 25], substitutes: ['LalBrew Belle Saison', 'SafAle BE-134'], name: 'Wyeast 3711 French Saison', type: 'liquid', style: 'ale', attenuationPercent: 85, note: 'Saison très atténuante : poivre, agrumes, finale sèche.' },
  { family: 'lager', tempC: [9, 14], substitutes: ['WLP830 German Lager', 'SafLager W-34/70'], name: 'Wyeast 2124 Bohemian Lager', type: 'liquid', style: 'lager', attenuationPercent: 75, note: 'Lager de Bohême : maltée, propre (Pils, Märzen).' },
  { family: 'american', tempC: [18, 22], substitutes: ['SafAle US-05', 'Wyeast 1056 American Ale'], name: 'WLP001 California Ale', type: 'liquid', style: 'ale', attenuationPercent: 76, note: 'Ale américaine propre : la référence des IPA.' },
  { family: 'english', tempC: [18, 20], substitutes: ['Wyeast 1968 London ESB', 'LalBrew London ESB'], name: 'WLP002 English Ale', type: 'liquid', style: 'ale', attenuationPercent: 67, note: 'Anglaise très floculante, laisse du corps et de la douceur (bitters, milds).' },
  { family: 'abbey', tempC: [19, 22], substitutes: ['Wyeast 3787 Trappist High Gravity', 'SafAle BE-256'], name: 'WLP530 Abbey Ale', type: 'liquid', style: 'ale', attenuationPercent: 77, note: 'Abbaye (Westmalle) : fruits, prune, épices.' },
  { family: 'abbey', tempC: [18, 22], substitutes: ['Wyeast 1214 Belgian Abbey', 'LalBrew Abbaye'], name: 'WLP500 Monastery Ale', type: 'liquid', style: 'ale', attenuationPercent: 77, note: 'Trappiste (Chimay) : fruits, épices, tolère l’alcool.' },
  { family: 'wheat', tempC: [19, 23], substitutes: ['Wyeast 3944 Belgian Witbier', 'LalBrew Wit'], name: 'WLP400 Belgian Wit', type: 'liquid', style: 'ale', attenuationPercent: 76, note: 'Blanche belge : épicée, phénolique, légère acidité.' },
  { family: 'wheat', tempC: [20, 22], substitutes: ['Wyeast 3068 Weihenstephan Weizen', 'SafAle WB-06'], name: 'WLP300 Hefeweizen', type: 'liquid', style: 'ale', attenuationPercent: 74, note: 'Weizen : banane marquée, clou de girofle.' },
  { family: 'lager', tempC: [10, 13], substitutes: ['SafLager W-34/70', 'Wyeast 2124 Bohemian Lager'], name: 'WLP830 German Lager', type: 'liquid', style: 'lager', attenuationPercent: 77, note: 'Lager allemande la plus répandue : propre, maltée.' },
]

/** Marque d'une levure, d'après le début de son nom. */
export function yeastBrand(name: string): string {
  if (/^Saf/i.test(name)) return 'Fermentis'
  if (/^LalBrew/i.test(name)) return 'Lallemand'
  if (/^Mangrove/i.test(name)) return 'Mangrove Jack’s'
  if (/^Wyeast/i.test(name)) return 'Wyeast'
  if (/^WLP/i.test(name)) return 'White Labs'
  return ''
}

/** Entrée de bibliothèque portant exactement ce nom (casse et espaces ignorés). */
export function findByName<T extends { name: string }>(library: T[], name: string): T | undefined {
  const key = name.trim().toLowerCase()
  return key ? library.find((item) => item.name.toLowerCase() === key) : undefined
}
