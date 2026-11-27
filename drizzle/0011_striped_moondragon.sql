ALTER TABLE "bookmarks" ADD COLUMN "version_id" varchar(64) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "chapter_likes" ADD COLUMN "version_id" varchar(64) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_listening_stats" ADD COLUMN "version_id" varchar(64) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "listening_progress" ADD COLUMN "version_id" varchar(64) DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "listening_sessions" ADD COLUMN "version_id" varchar(64) DEFAULT 'default' NOT NULL;--> statement-breakpoint
DROP INDEX "daily_stats_unique_entry";--> statement-breakpoint
ALTER TABLE "chapter_likes" DROP CONSTRAINT "chapter_likes_user_id_chapter_id_pk";--> statement-breakpoint
ALTER TABLE "listening_progress" DROP CONSTRAINT "listening_progress_user_id_chapter_id_pk";--> statement-breakpoint
ALTER TABLE "chapter_likes" ADD CONSTRAINT "chapter_likes_user_id_chapter_id_version_id_pk" PRIMARY KEY("user_id","chapter_id","version_id");--> statement-breakpoint
ALTER TABLE "listening_progress" ADD CONSTRAINT "listening_progress_user_id_chapter_id_version_id_pk" PRIMARY KEY("user_id","chapter_id","version_id");--> statement-breakpoint
CREATE INDEX "bookmarks_version_idx" ON "bookmarks" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "chapter_likes_version_idx" ON "chapter_likes" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "daily_stats_version_idx" ON "daily_listening_stats" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "progress_version_idx" ON "listening_progress" USING btree ("version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_stats_unique_entry" ON "daily_listening_stats" USING btree ("date","book_id","chapter_id","version_id","user_id");
