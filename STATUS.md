# BrewAtHome — État du projet

_Dernière mise à jour : 2026-10-16_

Application personnelle de brassage de bière maison (type Brewfather/Little Bock), SPA React + TypeScript, backend Supabase, déployée sur GitHub Pages.

## Ce qui est fait

### Recettes
- Créateur de recette complet : fermentescibles, houblons, levures.
- Calculs en direct : OG, FG, IBU (Tinseth et Rager), SRM, ABV. **Moteur aligné sur les specs** (`Specs appli de brassage`) et validé par le cas de référence Pale Ale 23 L (`tests/brew-calc/reference-pale-ale.test.ts`) : volumes calculés à rebours depuis le fermenteur, DI/couleur/IBU sur le volume de fin d'ébullition à froid, IBU Tinseth sur la densité d'ébullition moyenne, premier moût ×1,10, whirlpool selon sa température (Arrhenius), pellets +10 % d'utilisation par rapport aux cônes, et les houblons d'ébullition continuent d'isomériser pendant le hopstand (modèle retrouvé sur les recettes Brewfather), ABV = 131,25 × (DI − DF). La température d'empâtage ajuste l'atténuation estimée (≈ 1 point par °C autour de 67 °C : plus chaud = FG plus haute, moins d'alcool).
- Matching avec les styles BJCP 2021 (plages OG/FG/IBU/SRM/ABV).
- Profils d'équipement (cuve, évaporation en L/h, pertes cuve d'empâtage / trub / fermenteur, utilisation houblon, méthode tout-grain/BIAB/extrait) avec calcul des volumes à chaque étape (eau d'empâtage, eau de rinçage @ 76 °C, pré-ébullition, post-ébullition, fermenteur), alerte de débordement de cuve.
- Ancrage du dimensionnement sur le volume final **ou** sur le volume pré-ébullition (utile quand la cuve est le facteur limitant).
- Import BeerXML (lecture seule) pour récupérer des recettes existantes.
- **Brewfather** (`/recipes/brewfather`) : connexion par identifiant + clé API (droit recipes.read, enregistrés dans `brewfather_accounts`, RLS), liste de toutes les recettes du compte, **comparaison de nos calculs** (DI, DF, ABV, IBU, couleur, volume pré-ébullition) avec ceux de Brewfather recalculés sur l'équipement de la recette, import de la recette et de son profil d'équipement. Appels directs depuis le navigateur (l'API Brewfather autorise le CORS), quota 500 appels/heure.
- **Houblons** : usages first-wort / ébullition / whirlpool / dry hop / empâtage, avec pour le dry hop une durée (jours) et une température cible dédiées.
- **Autres ajouts en ébullition** (Whirlfloc, nutriments...) : nom, quantité en texte libre, temps d'ajout — éditables directement dans le formulaire de recette.

### Batches (brassins)
- Validation d'une recette en brassin avec **snapshot figé** (une modification ultérieure de la recette source ne touche pas un brassin déjà lancé) ; la recette du brassin reste éditable indépendamment (`/batches/:id/edit-recipe`). Enregistrer la recette du brassin recalcule ses estimations (avec la formule IBU choisie) et régénère les étapes du Brew Day encore à faire ; les étapes commencées ou terminées gardent leurs minuteurs.
- Suivi de statut (planifié → brew day → fermentation → conditionnement → terminé), mesures réelles OG/FG/volume, ABV réel calculé.

### Mode Brew Day
- Interface façon app mobile : écran plein (une étape à la fois, barre d'actions en bas, vue d'ensemble en panneau) ; sur PC, vue d'ensemble permanente à gauche et étape en cours à droite.
- Étapes générées automatiquement à la création du brassin, dans l'ordre de la journée et **regroupées en phases** : Préparation → Empâtage (eau d'empâtage à la bonne température, empâtage à la température de la recette, mash-out facultatif) → Filtration et rinçage → Ébullition (chaque ajout à son instant précis, whirlpool) → Refroidissement → Ensemencement → Rangement → Houblonnage à froid.
- Chaque étape a une **checklist de gestes à cocher** (sous-sous-étapes, enregistrées en base dans `batch_steps.checked_items`) et des **conseils** affichés au moment où ils servent (`src/lib/brew-day/checklist.ts`). Points et étapes facultatifs (test à l'iode, mash-out…) ; toute étape peut être « passée ».
- Minuteur par étape (démarrer/arrêter/terminer), persistant en base (survit à un rafraîchissement de page). Terminer une étape enchaîne sur la suivante.
- Alertes sonores + bandeau rouge + changement du titre d'onglet quand un ajout arrive à échéance ; rappel du minuteur d'ébullition quand on consulte une autre étape.
- Wake Lock (écran qui reste allumé) pendant tout le Brew Day.
- Renvoi vers le suivi de fermentation une fois toutes les étapes terminées ou passées.
- Outils intégrés : calcul d'eau de trempe (strike water), correction de densité (dilution/ajout de fermentescible).

### Navigation
- Barre d'onglets en bas sur mobile (Accueil, Recettes, Brassins, Plus), barre latérale sur PC.

### Fermentation
- Saisie manuelle de lectures (densité, température, commentaire) + graphique.
- Ingestion automatique iSpindel (Edge Function Supabase).

### Infra
- Auth Supabase, RLS sur toutes les tables, déploiement GitHub Pages via GitHub Actions, PWA installable.
- Schéma modélisé avec Drizzle (génération de migrations SQL uniquement — aucune dépendance runtime à Drizzle, tout passe par `supabase-js`).

## Ce qu'il reste à faire

- Refonte UX en cours : impact en direct des modifications dans le formulaire de recette (et formulaire adapté au mobile), base de connaissances (malts, houblons, levures, empâtage).

- Export BeerXML (actuellement import seulement).
- Support Tilt/TiltBridge au-delà de la saisie manuelle.
- Calculateur de starter de levure.
- Historique/statistiques multi-brassins, export PDF de fiche de recette.
- Interfaces pour les calculs déjà prêts dans `src/lib/brew-calc/` : resucrage (`carbonation.ts`), sels minéraux (`water.ts`), sachets de levure sèche (`dryYeastForCells`). Usage des fermentescibles (empâtage/ébullition/fermentation) à exposer en base et dans le formulaire.
- Migration `0009` (suppression de `evaporation_rate_percent_per_hour`) à appliquer **seulement après** le déploiement du nouveau code (le site en ligne lit encore l'ancienne colonne).
- Brewfather : import des brassins (DI/DF mesurées au densimètre → atténuation réelle par levure). Écarts restants connus : IBU des bières fortes (Brewfather prend la densité pré-ébullition, nous la moyenne des specs) et DF (Brewfather ajuste l'atténuation selon l'empâtage et le sucre).
- Fin de fermentation : prévenir quand la densité iSpindel est stable 2-3 jours (« prendre une mesure au densimètre »). La DF du brassin reste toujours saisie à la main.
- IBU Garetz (troisième formule, actuellement non implémentée malgré le type `IBUFormulaName` qui la prévoit).
- Gestion de stock d'ingrédients (si besoin confirmé un jour).
- Le bundle JS dépasse 500 kB après minification (avertissement Vite) — découpage en chunks à envisager si le temps de chargement devient gênant.

## Comment vérifier l'état du code

```bash
npx tsc -b        # typecheck
npx vitest run    # tests unitaires (brew-calc, etc.)
npm run build     # build de production
```
