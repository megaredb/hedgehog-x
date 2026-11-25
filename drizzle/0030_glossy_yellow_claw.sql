ALTER TABLE "broadcast_messages" ADD COLUMN "link_url" varchar(2048);--> statement-breakpoint
ALTER TABLE "broadcast_messages" ADD COLUMN "link_title" varchar(255);--> statement-breakpoint
ALTER TABLE "broadcast_messages" ADD COLUMN "link_description" text;--> statement-breakpoint
ALTER TABLE "broadcast_messages" ADD COLUMN "link_image" varchar(2048);