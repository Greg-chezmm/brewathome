# BrewAtHome — État du projet

_Dernière mise à jour : 2026-10-16_

Application personnelle de brassage de bière maison (type Brewfather/Little Bock), SPA React + TypeScript, backend Supabase, déployée sur GitHub Pages.

## Ce qui est fait

### Recettes
- Créateur de recette complet : fermentescibles, houblons, levures.
- Calculs en direct : OG, FG, IBU (Tinseth et Rager), SRM, ABV. La température d'empâtage ajuste l'atténuation estimée (≈ 1 point par °C autour de 67 °C : plus chaud = FG plus haute, moins d'alcool).
- Matching avec les styles BJCP 2021 (plages OG/FG/IBU/SRM/ABV).
- Profils d'équipement (cuve, évaporation, pertes, méthode tout-grain/BIAB/extrait) avec calcul des volumes à chaque étape (eau d'empâtage, eau de rinçage @ 76 °C, pré-ébullition, post-ébullition, fermenteur), alerte de débordement de cuve.
- Ancrage du dimensionnement sur le volume final **ou** sur le volume pré-ébullition (utile quand la cuve est le facteur limitant).
- Import BeerXML (lecture seule) pour récupérer des recettes existantes.
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
- IBU Garetz (troisième formule, actuellement non implémentée malgré le type `IBUFormulaName` qui la prévoit).
- Gestion de stock d'ingrédients (si besoin confirmé un jour).
- Vérification croisée formelle des calculs (OG/FG/IBU/SRM/ABV/pitch levure) contre un compte Brewfather existant, au-delà des tests unitaires actuels.
- Le bundle JS dépasse 500 kB après minification (avertissement Vite) — découpage en chunks à envisager si le temps de chargement devient gênant.

## Comment vérifier l'état du code

```bash
npx tsc -b        # typecheck
npx vitest run    # tests unitaires (brew-calc, etc.)
npm run build     # build de production
```
