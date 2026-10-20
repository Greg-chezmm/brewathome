-- Contenants remplis à l'embouteillage : { bottle33, bottle50, bottle75, keg5 }.
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "packaging" jsonb;
