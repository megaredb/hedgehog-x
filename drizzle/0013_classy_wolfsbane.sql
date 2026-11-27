ALTER TABLE "chapter_audio_versions" ALTER COLUMN "duration_seconds" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "chapters" ALTER COLUMN "duration_seconds" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "video_url" varchar(2048);--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;