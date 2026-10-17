ALTER TABLE "batches" ADD COLUMN "mash_ph_measured" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "pre_boil_volume_measured_l" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "pre_boil_gravity_measured" numeric(5, 3);--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "post_boil_volume_measured_l" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "post_boil_gravity_measured" numeric(5, 3);--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "fermenter_top_up_l" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "packaging_volume_l" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "max_fermentation_temp_c" numeric(4, 1);