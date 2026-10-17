import type { Fermentable, Hop, Yeast } from '@/lib/brew-calc/types'

/**
 * Bibliothèque d'ingrédients courants : valeurs typiques (elles varient selon le
 * malteur, la récolte et le lot — l'étiquette du sachet fait foi) et une note
 * d'usage pour guider la conception de recette.
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

export const FERMENTABLE_LIBRARY: LibraryFermentable[] = [
  // Malts de base
  { name: 'Pilsner', type: 'grain', colorLovibond: 1.6, yieldPercent: 81, note: 'Malt de base très clair, goût de céréale et de miel. Jusqu’à 100 % (lagers, blondes, belges). Ébullition de 90 min conseillée (DMS).' },
  { name: 'Pale Ale', type: 'grain', colorLovibond: 3, yieldPercent: 80, note: 'Malt de base un peu plus touraillé que le Pilsner : biscuité, rond. Jusqu’à 100 % (ales anglaises et américaines).' },
  { name: 'Maris Otter', type: 'grain', colorLovibond: 3, yieldPercent: 81, note: 'Malt de base anglais de référence, riche et biscuité. Jusqu’à 100 % (bitters, porters, barley wines).' },
  { name: 'Vienne', type: 'grain', colorLovibond: 3.5, yieldPercent: 79, note: 'Malt de base doré, notes de pain grillé. Jusqu’à 100 % (Vienna lager, Märzen) ou 10–30 % pour de la rondeur.' },
  { name: 'Munich', type: 'grain', colorLovibond: 9, yieldPercent: 78, note: 'Très malté, pain et croûte. Jusqu’à 100 % (Dunkel, Bock) ; 10–20 % pour plus de corps maltée.' },
  { name: 'Malt de blé', type: 'grain', colorLovibond: 2, yieldPercent: 82, note: 'Mousse et tenue, goût de pain frais. 50–70 % en Weizen/blanche, 5–10 % pour la mousse. Pas d’enveloppe : filtration plus lente.' },
  { name: 'Malt de seigle', type: 'grain', colorLovibond: 3.5, yieldPercent: 80, note: 'Épicé, sec, texture huileuse. 10–20 % ; au-delà, prévoir des balles de riz (empâtage collant).' },
  { name: 'Malt fumé', type: 'grain', colorLovibond: 2.5, yieldPercent: 80, note: 'Fumé au bois de hêtre (Rauchbier). 10 % pour une touche, jusqu’à 100 % pour une Rauchbier de Bamberg.' },
  { name: 'Malt acidulé', type: 'grain', colorLovibond: 2, yieldPercent: 58, note: 'Baisse le pH de l’empâtage (≈ 0,1 par 1 % du grain). 1–5 %, au-delà il donne une acidité perceptible.' },
  // Malts spéciaux
  { name: 'Carapils', type: 'grain', colorLovibond: 1.5, yieldPercent: 72, note: 'Malt « dextrine » : mousse et corps sans couleur. 3–10 %.' },
  { name: 'Crystal 20', type: 'grain', colorLovibond: 20, yieldPercent: 75, note: 'Caramel léger, miel. 5–15 %. Augmente la DF (sucres peu fermentescibles).' },
  { name: 'Crystal 40', type: 'grain', colorLovibond: 40, yieldPercent: 74, note: 'Caramel moyen, couleur ambrée. 5–15 % (pale ales, ambrées).' },
  { name: 'Crystal 60', type: 'grain', colorLovibond: 60, yieldPercent: 74, note: 'Caramel marqué, fruits secs. 3–10 %. Au-delà, la bière devient lourde et sucrée.' },
  { name: 'Crystal 120', type: 'grain', colorLovibond: 120, yieldPercent: 72, note: 'Caramel foncé, raisin sec, brûlé léger. 2–5 % (ales foncées, porters).' },
  { name: 'CaraMunich', type: 'grain', colorLovibond: 45, yieldPercent: 74, note: 'Caramel malté, biscuit. 5–15 % (bières belges, ambrées, Bock).' },
  { name: 'Biscuit', type: 'grain', colorLovibond: 25, yieldPercent: 75, note: 'Biscuit, pain grillé, sec. 3–10 %.' },
  { name: 'Melanoidin', type: 'grain', colorLovibond: 27, yieldPercent: 76, note: 'Intensément malté, miel, croûte de pain : imite une décoction. 2–10 %.' },
  { name: 'Malt chocolat', type: 'grain', colorLovibond: 350, yieldPercent: 65, note: 'Chocolat, café doux. 2–8 % (porters, stouts, brunes).' },
  { name: 'Orge torréfiée', type: 'grain', colorLovibond: 300, yieldPercent: 55, note: 'Orge non maltée torréfiée : café, sec, amer. La signature du stout irlandais, 5–10 %.' },
  { name: 'Carafa Spécial III', type: 'grain', colorLovibond: 470, yieldPercent: 65, note: 'Malt noir dépelliculé : beaucoup de couleur, peu d’âpreté. 1–5 % (Schwarzbier, Black IPA).' },
  { name: 'Flocons d’avoine', type: 'grain', colorLovibond: 1, yieldPercent: 72, note: 'Texture soyeuse, trouble. 5–20 % (NEIPA, oatmeal stout). Prévoir des balles de riz au-delà de 15 %.' },
  { name: 'Flocons d’orge', type: 'grain', colorLovibond: 1.7, yieldPercent: 70, note: 'Corps et mousse, sec. 5–15 % (stout irlandais).' },
  // Sucres et extraits
  { name: 'Sucre blanc (saccharose)', type: 'sugar', colorLovibond: 0, yieldPercent: 100, note: 'Fermente entièrement : allège le corps et assèche (tripel, IPA forte). 5–20 % des fermentescibles.' },
  { name: 'Dextrose', type: 'sugar', colorLovibond: 0, yieldPercent: 91, note: 'Glucose : fermente entièrement, comme le sucre blanc. Aussi utilisé pour le resucrage.' },
  { name: 'Sucre candi clair', type: 'sugar', colorLovibond: 1, yieldPercent: 78, note: 'Sucre belge : assèche sans couleur (tripel, golden strong).' },
  { name: 'Sucre candi brun', type: 'sugar', colorLovibond: 75, yieldPercent: 78, note: 'Caramel, fruits secs, couleur (dubbel, quadrupel).' },
  { name: 'Miel', type: 'sugar', colorLovibond: 1, yieldPercent: 76, note: 'Fermente presque entièrement : il reste peu de son goût. Ajouter en fin d’ébullition ou en fermentation pour garder des arômes.' },
  { name: 'Extrait de malt sec (clair)', type: 'extract', colorLovibond: 4, yieldPercent: 95, note: 'Extrait déshydraté : densité sans empâtage, ou pour corriger une DI trop basse.' },
  { name: 'Extrait de malt liquide (clair)', type: 'extract', colorLovibond: 4, yieldPercent: 78, note: 'Sirop d’extrait (≈ 20 % d’eau). À ajouter de préférence en fin d’ébullition pour limiter la coloration.' },
]

export const HOP_LIBRARY: LibraryHop[] = [
  // Amérisants
  { name: 'Magnum', alphaAcidPercent: 13, note: 'Amérisant propre et neutre. Idéal en début d’ébullition.' },
  { name: 'Herkules', alphaAcidPercent: 16, note: 'Très amérisant, légèrement épicé et résineux.' },
  { name: 'Columbus', alphaAcidPercent: 15, note: 'Amérisant puissant, résine, poivre, agrumes (aussi appelé CTZ).' },
  { name: 'Warrior', alphaAcidPercent: 16, note: 'Amérisant doux et propre, peu de cohumulone.' },
  { name: 'Polaris', alphaAcidPercent: 20, note: 'Très riche en alpha, notes de menthe glaciale.' },
  // Américains / Nouveau Monde
  { name: 'Cascade', alphaAcidPercent: 6.5, note: 'Pamplemousse, fleurs : l’arôme de l’American Pale Ale.' },
  { name: 'Centennial', alphaAcidPercent: 10, note: 'Agrumes et fleurs, un « super Cascade ». Polyvalent.' },
  { name: 'Chinook', alphaAcidPercent: 13, note: 'Pin, résine, pamplemousse. Amérisant ou arôme pour les West Coast IPA.' },
  { name: 'Citra', alphaAcidPercent: 12.5, note: 'Agrumes, mangue, fruit de la passion. Star des IPA, surtout en whirlpool et dry hop.' },
  { name: 'Mosaic', alphaAcidPercent: 12, note: 'Myrtille, fruits tropicaux, pin. Très complexe en dry hop.' },
  { name: 'Simcoe', alphaAcidPercent: 13, note: 'Pin, fruit de la passion, résine.' },
  { name: 'Amarillo', alphaAcidPercent: 9, note: 'Orange, fleurs. Se marie bien avec Citra et Simcoe.' },
  { name: 'El Dorado', alphaAcidPercent: 15, note: 'Fruits à noyau, poire, bonbon.' },
  { name: 'Sabro', alphaAcidPercent: 14, note: 'Noix de coco, mandarine, crème.' },
  { name: 'Strata', alphaAcidPercent: 13, note: 'Fruit de la passion, fraise, cannabis.' },
  { name: 'Willamette', alphaAcidPercent: 5, note: 'Version américaine du Fuggle : épicé, floral, terreux.' },
  { name: 'Sorachi Ace', alphaAcidPercent: 12, note: 'Citron, aneth, noix de coco. Très typé : à doser.' },
  { name: 'Galaxy', alphaAcidPercent: 14, note: 'Australien : fruit de la passion, pêche. Très intense.' },
  { name: 'Nelson Sauvin', alphaAcidPercent: 12, note: 'Néo-zélandais : raisin blanc, groseille à maquereau (sauvignon).' },
  { name: 'Motueka', alphaAcidPercent: 7, note: 'Néo-zélandais : citron vert, mojito.' },
  // Européens nobles et traditionnels
  { name: 'Saaz', alphaAcidPercent: 3.5, note: 'Noble tchèque : épicé, herbacé, délicat. La signature de la Pils de Bohême.' },
  { name: 'Hallertau Mittelfrüh', alphaAcidPercent: 4, note: 'Noble allemand : floral, épicé doux (lagers, Weizen).' },
  { name: 'Tettnang', alphaAcidPercent: 4.5, note: 'Noble allemand : épicé, herbacé, floral.' },
  { name: 'Spalt', alphaAcidPercent: 4.5, note: 'Noble allemand : boisé, épicé (Altbier).' },
  { name: 'Hersbrucker', alphaAcidPercent: 3, note: 'Floral, fruité léger, épices douces.' },
  { name: 'Perle', alphaAcidPercent: 7.5, note: 'Allemand : menthe, épices. Amérisant doux ou arôme.' },
  { name: 'Northern Brewer', alphaAcidPercent: 8.5, note: 'Boisé, mentholé, résineux (California Common, porters).' },
  { name: 'Hallertau Blanc', alphaAcidPercent: 10, note: 'Allemand moderne : raisin blanc, fruits tropicaux.' },
  { name: 'Mandarina Bavaria', alphaAcidPercent: 8.5, note: 'Allemand moderne : mandarine, agrumes.' },
  { name: 'Huell Melon', alphaAcidPercent: 7, note: 'Allemand moderne : melon, fraise.' },
  { name: 'Strisselspalt', alphaAcidPercent: 2.5, note: 'Alsacien : floral, fruité, épices douces.' },
  { name: 'Aramis', alphaAcidPercent: 7.5, note: 'Alsacien : épicé, herbacé, agrumes.' },
  { name: 'Barbe Rouge', alphaAcidPercent: 8.5, note: 'Alsacien : fruits rouges, fraise, groseille.' },
  { name: 'Triskel', alphaAcidPercent: 8, note: 'Alsacien : floral, agrumes, fruits blancs.' },
  { name: 'East Kent Golding', alphaAcidPercent: 5.5, note: 'Anglais : miel, épices douces, terreux (bitters, ESB).' },
  { name: 'Fuggle', alphaAcidPercent: 4.5, note: 'Anglais : terreux, boisé, menthe (porters, milds).' },
  { name: 'Challenger', alphaAcidPercent: 7.5, note: 'Anglais : épicé, cèdre, thé vert. Amérisant ou arôme.' },
  { name: 'Target', alphaAcidPercent: 11, note: 'Anglais : amérisant, sauge, épices.' },
  { name: 'Styrian Golding', alphaAcidPercent: 4.5, note: 'Slovène : épicé, résineux, terreux (Saison, belges).' },
]

export const YEAST_LIBRARY: LibraryYeast[] = [
  // Fermentis
  { name: 'SafAle US-05', type: 'dry', style: 'ale', attenuationPercent: 81, note: 'Ale américaine propre et neutre, 18–22 °C. Laisse parler le houblon.' },
  { name: 'SafAle S-04', type: 'dry', style: 'ale', attenuationPercent: 75, note: 'Ale anglaise : légèrement fruitée, flocule très bien. 15–20 °C.' },
  { name: 'SafAle K-97', type: 'dry', style: 'ale', attenuationPercent: 81, note: 'Ale allemande (Kölsch, Alt) : propre, florale. 15–20 °C.' },
  { name: 'SafAle WB-06', type: 'dry', style: 'ale', attenuationPercent: 86, note: 'Bière de blé : banane et clou de girofle. 18–24 °C. Atténue souvent plus qu’annoncé.' },
  { name: 'SafAle T-58', type: 'dry', style: 'ale', attenuationPercent: 75, note: 'Belge : épicée, poivrée. 18–24 °C.' },
  { name: 'SafAle BE-256', type: 'dry', style: 'ale', attenuationPercent: 86, note: 'Abbaye : fruits mûrs, fermentation rapide (dubbel, tripel, quadrupel). 18–25 °C.' },
  { name: 'SafAle BE-134', type: 'dry', style: 'ale', attenuationPercent: 90, note: 'Saison : très sèche, poivrée, fruitée. 18–28 °C.' },
  { name: 'SafLager W-34/70', type: 'dry', style: 'lager', attenuationPercent: 83, note: 'La levure de lager de référence : propre, maltée. 9–15 °C.' },
  { name: 'SafLager S-23', type: 'dry', style: 'lager', attenuationPercent: 82, note: 'Lager fruitée et ester. 9–15 °C.' },
  // Lallemand
  { name: 'LalBrew Nottingham', type: 'dry', style: 'ale', attenuationPercent: 80, note: 'Ale anglaise neutre et robuste, tolère le froid (14–21 °C).' },
  { name: 'LalBrew Verdant IPA', type: 'dry', style: 'ale', attenuationPercent: 77, note: 'NEIPA : abricot, corps doux, reste trouble. 18–22 °C.' },
  { name: 'LalBrew BRY-97', type: 'dry', style: 'ale', attenuationPercent: 80, note: 'West Coast : propre, met en valeur le houblon.' },
  { name: 'LalBrew Belle Saison', type: 'dry', style: 'ale', attenuationPercent: 90, note: 'Saison : très sèche, poivrée, agrumes. Supporte jusqu’à 35 °C.' },
  { name: 'LalBrew Abbaye', type: 'dry', style: 'ale', attenuationPercent: 80, note: 'Belge d’abbaye : fruits, épices. 17–25 °C.' },
  { name: 'LalBrew Voss Kveik', type: 'dry', style: 'ale', attenuationPercent: 80, note: 'Kveik norvégien : orange, fermente vite et chaud (25–40 °C) sans faux goût.' },
  { name: 'LalBrew London ESB', type: 'dry', style: 'ale', attenuationPercent: 67, note: 'Anglaise peu atténuante : laisse du corps (bitters, milds). Ne fermente pas le maltotriose.' },
  { name: 'LalBrew Diamond Lager', type: 'dry', style: 'lager', attenuationPercent: 80, note: 'Lager propre, 10–15 °C.' },
  // Liquides
  { name: 'Wyeast 1056 American Ale', type: 'liquid', style: 'ale', attenuationPercent: 75, note: 'Équivalent liquide de l’US-05 : propre, neutre.' },
  { name: 'Wyeast 1318 London Ale III', type: 'liquid', style: 'ale', attenuationPercent: 73, note: 'NEIPA : fruitée, ronde, garde le trouble.' },
  { name: 'Wyeast 3787 Trappist High Gravity', type: 'liquid', style: 'ale', attenuationPercent: 77, note: 'Trappiste (Westmalle) : fruits, épices, tolère l’alcool.' },
  { name: 'Wyeast 3711 French Saison', type: 'liquid', style: 'ale', attenuationPercent: 85, note: 'Saison très atténuante : poivre, agrumes, finale sèche.' },
  { name: 'Wyeast 2124 Bohemian Lager', type: 'liquid', style: 'lager', attenuationPercent: 75, note: 'Lager de Bohême : maltée, propre (Pils, Märzen).' },
  { name: 'WLP001 California Ale', type: 'liquid', style: 'ale', attenuationPercent: 76, note: 'Ale américaine propre : la référence des IPA.' },
  { name: 'WLP300 Hefeweizen', type: 'liquid', style: 'ale', attenuationPercent: 74, note: 'Weizen : banane marquée, clou de girofle.' },
]

/** Entrée de bibliothèque portant exactement ce nom (casse et espaces ignorés). */
export function findByName<T extends { name: string }>(library: T[], name: string): T | undefined {
  const key = name.trim().toLowerCase()
  return key ? library.find((item) => item.name.toLowerCase() === key) : undefined
}
