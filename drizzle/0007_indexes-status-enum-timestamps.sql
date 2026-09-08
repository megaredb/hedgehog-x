CREATE TYPE "public"."book_status" AS ENUM('ongoing', 'completed', 'paused');--> statement-breakpoint
ALTER TABLE "bookmarks" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
UPDATE "books" SET "status" = 'ongoing' WHERE "status" IS NULL;--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "status" SET DATA TYPE "public"."book_status" USING "status"::"public"."book_status";--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "status" SET DEFAULT 'ongoing'::"public"."book_status";--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chapter_likes" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chapters" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chapters" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "illustrations" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "illustrations" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "listening_progress" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "volume_likes" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "volumes" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "volumes" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "bookmarks_user_id_idx" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chapters_volume_id_idx" ON "chapters" USING btree ("volume_id");--> statement-breakpoint
CREATE INDEX "illustrations_volume_id_idx" ON "illustrations" USING btree ("volume_id");--> statement-breakpoint
CREATE INDEX "volumes_book_id_idx" ON "volumes" USING btree ("book_id");--> statement-breakpoint
UPDATE "books" SET "theme_color" = NULL WHERE "theme_color" IS NOT NULL AND "theme_color" !~ '^[0-9a-fA-F]{6}$';--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_theme_color_hex_check" CHECK ("books"."theme_color" IS NULL OR "books"."theme_color" ~ '^[0-9a-fA-F]{6}$');