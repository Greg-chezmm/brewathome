ALTER TABLE "batch_steps" ADD COLUMN "session" smallint;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "brew_sessions" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "session_measurements" jsonb;