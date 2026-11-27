ALTER TABLE "broadcast_messages" ADD COLUMN "reply_to_id" varchar(36);--> statement-breakpoint
ALTER TABLE "broadcast_messages" ADD COLUMN "reply_to_name" varchar(255);--> statement-breakpoint
ALTER TABLE "broadcast_messages" ADD COLUMN "reply_to_body" text;