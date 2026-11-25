ALTER TABLE "subscriptions" ADD COLUMN "revoked_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "revoked_remaining_ms" bigint;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "blocked_remaining_ms" bigint;