-- Décalage manuel (en densité SG) appliqué aux relevés de l'iSpindel du brassin ; NULL = recalage automatique sur la DI.
ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "ispindel_offset" numeric(6, 4);
