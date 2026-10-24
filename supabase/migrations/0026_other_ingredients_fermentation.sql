-- Autres ajouts en fermentation (copeaux de chêne, fruits, épices…) : moment d'ajout, jour et durée de contact.
-- NULL = ajout en ébullition, comme avant. Écrite à la main (snapshots Drizzle arrêtés à 0019).
ALTER TABLE "recipe_other_ingredients" ADD COLUMN IF NOT EXISTS "use" text;
ALTER TABLE "recipe_other_ingredients" ADD COLUMN IF NOT EXISTS "day" integer;
ALTER TABLE "recipe_other_ingredients" ADD COLUMN IF NOT EXISTS "contact_days" integer;
