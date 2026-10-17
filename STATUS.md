# BrewAtHome — État du projet

_Dernière mise à jour : 2026-10-17_

Application personnelle de brassage de bière maison (type Brewfather/Little Bock), SPA React + TypeScript, backend Supabase, déployée sur GitHub Pages.

## Où on en est (résumé)

**Dernières avancées**
- Brewfather : explication du triangle d'écart directement sur la page de comparaison ; recette sans levure expliquée (fiche et import : atténuation par défaut de 75 %).
- Formulaire de recette : réordonner les ingrédients, viser une DI (tout le grain à l'échelle) ou un IBU (dose du houblon amérisant).
- **Empâtage à paliers** : la recette décrit tous ses paliers (repos protéinique, bêta, alpha, mash-out…), importés depuis Brewfather et BeerXML ; le palier principal règle l'atténuation, et chaque palier devient une étape minutée du Brew Day.
- Brew Day : boutons Démarrer / Arrêter déplacés dans la carte de l'étape, à côté de la durée prévue puis sous le minuteur ; la barre du bas garde Terminer et la navigation.
- Nouveau favicon et icônes PWA : cuve en cuivre fumante avec un cône de houblon.

**À faire juste après**
- Appliquer la migration `0012` (colonne `recipes.mash_steps`) sur la base live **avant** de pousser le code, puis pousser (le push est bloqué tant que l'identifiant git enregistré est le jeton en lecture seule).

**Prochaines étapes, par priorité** (d'après l'audit des 17 recettes Brewfather : paliers, profils de fermentation, dose de levure, jour du dry hop et carbonatation y sont tous renseignés)
1. Profil de fermentation (primaire, secondaire, garde, cold crash : température et durée) et jour d'ajout du dry hop, importés depuis Brewfather et utilisés dans le suivi de fermentation.
2. Quantité de levure (sachets / ml) et carbonatation visée (volumes de CO₂), avec l'écran de resucrage déjà calculé dans `carbonation.ts`.
3. Page « base de connaissances » consultable hors formulaire (empâtage, eau, levures).

## Ce qui est fait

### Recettes
- Créateur de recette complet : fermentescibles, houblons, levures.
- Calculs en direct : OG, FG, IBU (Tinseth et Rager), SRM, ABV. **Moteur aligné sur les specs** (`Specs appli de brassage`) et validé par le cas de référence Pale Ale 23 L (`tests/brew-calc/reference-pale-ale.test.ts`) : volumes calculés à rebours depuis le fermenteur, DI/couleur/IBU sur le volume de fin d'ébullition à froid, IBU Tinseth sur la densité d'ébullition moyenne, premier moût ×1,10, whirlpool selon sa température (Arrhenius), pellets +10 % d'utilisation par rapport aux cônes, et les houblons d'ébullition continuent d'isomériser pendant le hopstand (modèle retrouvé sur les recettes Brewfather), ABV = 131,25 × (DI − DF). La température du palier principal d'empâtage ajuste l'atténuation estimée (≈ 1 point par °C autour de 67 °C : plus chaud = FG plus haute, moins d'alcool).
- **Empâtage à paliers** (`brew-calc/mash.ts`, colonne `recipes.mash_steps`, migration 0012) : liste ordonnée de paliers (nom, température, durée) éditée comme les ingrédients, avec suggestions (repos protéinique, bêta-amylase, saccharification, alpha-amylase, mash-out), rôle de chaque température et conseil. Le palier principal (le plus long hors mash-out) donne la température qui ajuste l'atténuation ; le dernier palier à 75 °C ou plus est le mash-out. Sans paliers enregistrés : saccharification 60 min puis mash-out 76 °C, comme avant. Importés depuis Brewfather et BeerXML.
- Matching avec les styles BJCP 2021 (plages OG/FG/IBU/SRM/ABV).
- Profils d'équipement (cuve, évaporation en L/h, pertes cuve d'empâtage / trub / fermenteur, utilisation houblon, méthode tout-grain/BIAB/extrait) avec calcul des volumes à chaque étape (eau d'empâtage, eau de rinçage @ 76 °C, pré-ébullition, post-ébullition, fermenteur), alerte de débordement de cuve.
- Ancrage du dimensionnement sur le volume final **ou** sur le volume pré-ébullition (utile quand la cuve est le facteur limitant).
- Import BeerXML (lecture seule) pour récupérer des recettes existantes.
- **Brewfather** (`/recipes/brewfather`) : connexion par identifiant + clé API (droit recipes.read, enregistrés dans `brewfather_accounts`, RLS), liste de toutes les recettes du compte, **comparaison de nos calculs** (DI, DF, ABV, IBU, couleur, volume pré-ébullition) avec ceux de Brewfather recalculés sur l'équipement de la recette (coche verte = concordant, triangle orange = écart au-delà des tolérances, expliqué sur la page avec la cause probable de chaque écart), import de la recette et de son profil d'équipement. Onglet **Brassins** (droit batches.read) : liste des brassins, import d'un brassin (sa recette devient le snapshot, DI/DF au densimètre, volume en fermenteur, statut ; étapes de Brew Day générées seulement s'il n'est pas encore brassé ; `batches.brewfather_id` empêche un double import, migration 0011) et bilan réel : atténuation apparente mesurée par levure contre la fiche, rendement d'empâtage mesuré contre celui des recettes. Appels directs depuis le navigateur (l'API Brewfather autorise le CORS), quota 500 appels/heure.
- **Houblons** : usages first-wort / ébullition / whirlpool / dry hop / empâtage, avec pour le dry hop une durée (jours) et une température cible dédiées.
- **Autres ajouts en ébullition** (Whirlfloc, nutriments...) : nom, quantité en texte libre, temps d'ajout — éditables directement dans le formulaire de recette.
- **Recette offerte** aux nouveaux comptes : une American Pale Ale de 20 L dans toutes les plages du style (`src/data/starter-recipe.ts`), créée à la première connexion si le compte n'a aucune recette ; marqueur `starter_recipe` dans les métadonnées du compte pour ne pas la recréer.
- **Formulaire de recette** : chiffres clés recalculés à chaque saisie, vert/rouge selon le style — sur écran large, colonne de droite collée en haut avec la position dans chaque plage du style et le BU:GU ; sinon barre fixée au-dessus des onglets (mobile) ou en haut (PC), qui se déplie pour montrer le style ; un ingrédient = une carte aux champs légendés (2 colonnes sur mobile), seuls les champs utiles selon l'usage du houblon (forme pellets/cônes comprise), effet de chaque ingrédient (% du grain, points de densité, part de la couleur ; IBU par houblon ; DF et atténuation retenue pour la levure, `brew-calc/contributions.ts`). Suggestions de noms : vos ingrédients déjà utilisés (avec vos valeurs) puis une bibliothèque d'ingrédients courants (`src/data/ingredients.ts`, valeurs typiques + note d'usage affichée sous la carte). Flèches ↑/↓ pour réordonner chaque liste (l'ordre est enregistré ; la première levure est celle du calcul). **Viser une DI** : tout le grain est mis à l'échelle en gardant les proportions ; **viser un IBU** : seule la dose du houblon amérisant (le plus long en ébullition, premier moût compris) change (`brew-calc/targets.ts`).

### Batches (brassins)
- Validation d'une recette en brassin avec **snapshot figé** (une modification ultérieure de la recette source ne touche pas un brassin déjà lancé) ; la recette du brassin reste éditable indépendamment (`/batches/:id/edit-recipe`). Enregistrer la recette du brassin recalcule ses estimations (avec la formule IBU choisie) et régénère les étapes du Brew Day encore à faire ; les étapes commencées ou terminées gardent leurs minuteurs.
- Suivi de statut (planifié → brew day → fermentation → conditionnement → terminé), mesures réelles OG/FG/volume, ABV réel calculé.

### Mode Brew Day
- Interface façon app mobile : écran plein (une étape à la fois, barre d'actions en bas, vue d'ensemble en panneau) ; sur PC, vue d'ensemble permanente à gauche et étape en cours à droite.
- Étapes générées automatiquement à la création du brassin, dans l'ordre de la journée et **regroupées en phases** : Préparation → Empâtage (eau d'empâtage calculée pour le premier palier, une étape minutée par palier de la recette avec montée en température guidée, test à l'iode sur le palier principal, mash-out facultatif) → Filtration et rinçage → Ébullition (chaque ajout à son instant précis, whirlpool) → Refroidissement → Ensemencement → Rangement → Houblonnage à froid.
- Chaque étape a une **checklist de gestes à cocher** (sous-sous-étapes, enregistrées en base dans `batch_steps.checked_items`) et des **conseils** affichés au moment où ils servent (`src/lib/brew-day/checklist.ts`). Points et étapes facultatifs (test à l'iode, mash-out…) ; toute étape peut être « passée ».
- Minuteur par étape, persistant en base (survit à un rafraîchissement de page) : Démarrer à côté de la durée prévue, Arrêter sous le compte à rebours, Terminer dans la barre du bas. Terminer une étape enchaîne sur la suivante.
- Alertes sonores + bandeau rouge + changement du titre d'onglet quand un ajout arrive à échéance ; rappel du minuteur d'ébullition quand on consulte une autre étape.
- Wake Lock (écran qui reste allumé) pendant tout le Brew Day.
- Renvoi vers le suivi de fermentation une fois toutes les étapes terminées ou passées.
- Outils intégrés : calcul d'eau de trempe (strike water), correction de densité (dilution/ajout de fermentescible).

### Outils (`/tools`)
- Page de calculatrices (menu « Outils ») : **quantité de levure** (cellules Mr Malty, sachets secs de 11,5 g ou sachets liquides selon leur âge, starter conseillé au-delà de deux), **sels minéraux** (profil d'eau après gypse, CaCl2, Epsom, sel, bicarbonate ; repères par ion, rapport sulfates/chlorures ; eau de départ mémorisée dans le navigateur), eau d'empâtage, correction de densité, **resucrage** (CO2 résiduel selon la température, préréglages par style, saccharose/dextrose/extrait sec, grammes par bouteille).
- Depuis un brassin, bouton « Outils » qui pré-remplit volume, DI et levure (`?volume=&og=&yeast=&form=`).

### Navigation
- Barre d'onglets en bas sur mobile (Accueil, Recettes, Brassins, Plus), barre latérale sur PC.

### Fermentation
- Saisie manuelle de lectures (densité, température, commentaire) + graphique. En-tête rappelant le brassin (retour vers sa page), iSpindel rattaché affiché avec son statut de connexion (bouton « Détacher » ; terminer un brassin détache ses appareils), liste limitée aux 20 relevés les plus récents (« Tout afficher » en zone défilante), courbe densité (indigo) / température (orange) sur un vrai axe de temps, coupée dans les longues interruptions, sans points au-delà de 100 relevés ; lecture paginée (Supabase plafonne à 1 000 lignes par requête).
- **Fin de fermentation détectée** (`src/lib/fermentation/stability.ts`) : pendant la fermentation, bandeau quand la densité (lissée par tranches de 6 h, ±0,001) ne bouge plus depuis 2 jours, avec l'atténuation apparente ; invite à confirmer au densimètre et à saisir la DF à la main.
- **Import des relevés Brewfather** (`/batches/:id/readings`) pour un brassin lié à Brewfather (`brewfather_id`) : iSpindel, saisies, angle et batterie compris ; un second import n'ajoute que les nouveaux (testé sur 4 010 relevés).
- Ingestion automatique iSpindel (Edge Function Supabase). Page Appareils : champs à recopier dans le portail de l'iSpindel (service **HTTPS Post**, firmware 6.6 minimum, 7.3.3 conseillé ; en simple HTTP Supabase redirige vers HTTPS et les mesures sont perdues), marche à suivre de mise à jour du firmware, et mémo des réglages de l'appareil (polynôme, facteur batterie, intervalle, angle dans l'eau) enregistré dans `devices.calibration_coefficients`.

### Infra
- Auth Supabase, RLS sur toutes les tables, déploiement GitHub Pages via GitHub Actions, PWA installable (icône : cuve fumante et cône de houblon, `public/favicon.svg` ; PNG 192/512 rendus depuis ce SVG).
- Schéma modélisé avec Drizzle (génération de migrations SQL uniquement — aucune dépendance runtime à Drizzle, tout passe par `supabase-js`).

## Ce qu'il reste à faire

- Formulaire de recette, suite : page « base de connaissances » consultable hors formulaire (empâtage, eau, levures).
- Brewfather, champs encore ignorés à l'import : profil de fermentation, jour du dry hop, quantité de levure, carbonatation (voir « Prochaines étapes »).

- Export BeerXML (actuellement import seulement).
- Support Tilt/TiltBridge au-delà de la saisie manuelle.
- Calculateur de starter de levure.
- Historique/statistiques multi-brassins, export PDF de fiche de recette.
- Usage des fermentescibles (empâtage/ébullition/fermentation) à exposer en base et dans le formulaire.
- Sels minéraux : proposer les dosages pour viser un profil cible (aujourd'hui on saisit les grammes et on lit le résultat), et pH d'empâtage.
- Brewfather : utiliser l'atténuation réelle par levure et le rendement mesuré pour ajuster les recettes. Écarts restants connus : IBU des bières fortes (Brewfather prend la densité pré-ébullition, nous la moyenne des specs) et DF (Brewfather ajuste l'atténuation selon l'empâtage et le sucre).
- IBU Garetz (troisième formule, actuellement non implémentée malgré le type `IBUFormulaName` qui la prévoit).
- Gestion de stock d'ingrédients (si besoin confirmé un jour).
- Le bundle JS dépasse 500 kB après minification (avertissement Vite) — découpage en chunks à envisager si le temps de chargement devient gênant.

## Comment vérifier l'état du code

```bash
npx tsc -b        # typecheck
npx vitest run    # tests unitaires (brew-calc, etc.)
npm run build     # build de production
```
