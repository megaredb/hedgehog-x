ALTER TABLE "account" DROP COLUMN IF EXISTS "telegram_id";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN IF EXISTS "telegram_username";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "telegram_id";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "telegram_phone_number";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "telegram_username";
