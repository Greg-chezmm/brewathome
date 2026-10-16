# BrewAtHome — État du projet

_Dernière mise à jour : 2026-10-16_

Application personnelle de brassage de bière maison (type Brewfather/Little Bock), SPA React + TypeScript, backend Supabase, déployée sur GitHub Pages.

## Ce qui est fait

### Recettes
- Créateur de recette complet : fermentescibles, houblons, levures.
- Calculs en direct : OG, FG, IBU (Tinseth et Rager), SRM, ABV.
- Matching avec les styles BJCP 2021 (plages OG/FG/IBU/SRM/ABV).
- Profils d'équipement (cuve, évaporation, pertes, méthode tout-grain/BIAB/extrait) avec calcul des volumes à chaque étape (eau d'empâtage, eau de rinçage @ 76 °C, pré-ébullition, post-ébullition, fermenteur), alerte de débordement de cuve.
- Ancrage du dimensionnement sur le volume final **ou** sur le volume pré-ébullition (utile quand la cuve est le facteur limitant).
- Import BeerXML (lecture seule) pour récupérer des recettes existantes.
- **Houblons** : usages first-wort / ébullition / whirlpool / dry hop / empâtage, avec pour le dry hop une durée (jours) et une température cible dédiées.
- **Autres ajouts en ébullition** (Whirlfloc, nutriments...) : nom, quantité en texte libre, temps d'ajout — éditables directement dans le formulaire de recette.

### Batches (brassins)
- Validation d'une recette en brassin avec **snapshot figé** (une modification ultérieure de la recette source ne touche pas un brassin déjà lancé) ; la recette du brassin reste éditable indépendamment (`/batches/:id/edit-recipe`).
- Suivi de statut (planifié → brew day → fermentation → conditionnement → terminé), mesures réelles OG/FG/volume, ABV réel calculé.

### Mode Brew Day
- Étapes générées automatiquement à la création du brassin, **regroupées en 3 phases principales navigables** :
  1.1 **Empâtage** (chauffe eau d'empâtage → ajout du grain avec le détail des poids → chauffe eau de rinçage → rinçage)
  1.2 **Ébullition** (chauffe jusqu'à ébullition → ébullition → chaque ajout de houblon/ajout divers à son instant précis → whirlpool → refroidissement)
  1.3 **Houblonnage hors flamme** (dry hop, un minuteur par ajout en jours/heures avec température cible)
- Minuteur par étape (démarrer/arrêter-réinitialiser/terminer), persistant en base (survit à un rafraîchissement de page).
- Alertes sonores + changement du titre d'onglet quand un ajout (houblon ou divers) arrive à échéance pendant l'ébullition.
- Wake Lock (écran qui reste allumé) pendant tout le Brew Day.
- Navigation libre entre étapes (précédent/suivant + sélection directe par onglet de phase puis de sous-étape).
- Renvoi vers le suivi de fermentation (« 2 · Fermentation ») une fois toutes les étapes de brassage terminées.
- Outils intégrés : calcul d'eau de trempe (strike water), correction de densité (dilution/ajout de fermentescible).

### Fermentation
- Saisie manuelle de lectures (densité, température, commentaire) + graphique.
- Ingestion automatique iSpindel (Edge Function Supabase).

### Infra
- Auth Supabase, RLS sur toutes les tables, déploiement GitHub Pages via GitHub Actions, PWA installable.
- Schéma modélisé avec Drizzle (génération de migrations SQL uniquement — aucune dépendance runtime à Drizzle, tout passe par `supabase-js`).

## Ce qu'il reste à faire

- **Migration Supabase à appliquer manuellement** : `supabase/migrations/0006_parched_hercules.sql` (table `recipe_other_ingredients`, colonnes `dry_hop_days`/`dry_hop_temp_c` sur `recipe_hops`) doit être poussée sur le projet Supabase live (`supabase db push` ou SQL Editor) si ce n'est pas déjà fait.
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
