ALTER TABLE "equipment_profiles" ADD COLUMN "evaporation_rate_l_per_hour" numeric(5, 2) DEFAULT '2.5' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_profiles" ADD COLUMN "mash_tun_volume_l" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "equipment_profiles" ADD COLUMN "mash_tun_deadspace_l" numeric(4, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_profiles" ADD COLUMN "fermenter_loss_l" numeric(4, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment_profiles" ADD COLUMN "hop_utilization_percent" numeric(5, 2) DEFAULT '100' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_hops" ADD COLUMN "temperature_c" numeric(4, 1);--> statement-breakpoint
-- Conversion des profils existants : l'ancien taux (% du volume pré-ébullition par heure)
-- devient des litres par heure, en recalculant le volume pré-ébullition du brassin type
-- du profil avec l'ancienne formule (fermenteur ÷ (1 − contraction) + pertes, ÷ (1 − évaporation)).
UPDATE "equipment_profiles" SET "evaporation_rate_l_per_hour" = ROUND(
  (
    ("target_batch_volume_l" / (1 - "thermal_shrinkage_percent" / 100) + "hop_absorption_l" + "deadspace_l")
    / (1 - "evaporation_rate_percent_per_hour" / 100 * "boil_time_min" / 60)
  ) * "evaporation_rate_percent_per_hour" / 100,
  2
)
WHERE "evaporation_rate_percent_per_hour" > 0;
