-- Ratio eau/grain visé pour l'empâtage (le reste de l'eau totale va au
-- rinçage) : permet d'afficher la répartition eau d'empâtage / eau de
-- rinçage au lieu d'un seul total, comme discuté avec l'utilisateur.
ALTER TABLE "equipment_profiles"
  ADD COLUMN "water_to_grain_ratio_l_per_kg" numeric(4, 2) NOT NULL DEFAULT 3;
