-- Dégustations, suivi du conditionnement et coût d'un brassin : trois groupes de colonnes sur `batches`.
-- Les prix vivent sur le brassin et jamais sur la recette : une recette refaite un an plus tard repart de prix
-- vierges, et chaque brassin garde son coût d'époque. Les colonnes héritent de la RLS de `batches` (aucune
-- nouvelle table, aucun nouveau droit).

-- Dégustations : liste de { id, date (AAAA-MM-JJ), rating (1 à 5), appearance, aroma, taste, changeNext }.
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "tastings" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Conditionnement : date d'embouteillage et durée de refermentation voulue (NULL = 21 jours par défaut côté appli).
-- La date « prête à boire » en est déduite, rien d'autre n'est stocké.
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "bottled_at" date;
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "conditioning_days" smallint;
ALTER TABLE "batches" ADD CONSTRAINT "batches_conditioning_days_range"
  CHECK ("conditioning_days" IS NULL OR "conditioning_days" BETWEEN 1 AND 365);

-- Coût : liste de { label, amount } en euros (un prix par ingrédient du brassin, plus des frais libres).
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "costs" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Annulation, si besoin :
--   ALTER TABLE "batches" DROP CONSTRAINT "batches_conditioning_days_range";
--   ALTER TABLE "batches" DROP COLUMN "tastings", DROP COLUMN "bottled_at", DROP COLUMN "conditioning_days", DROP COLUMN "costs";
