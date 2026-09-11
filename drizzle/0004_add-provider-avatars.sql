ALTER TABLE "user" ADD COLUMN "telegram_avatar" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "telegram_oidc_username" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "discord_avatar" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "discord_username" text;--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "telegram_id";--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "telegram_username";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "telegram_id";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "telegram_phone_number";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "telegram_username";
