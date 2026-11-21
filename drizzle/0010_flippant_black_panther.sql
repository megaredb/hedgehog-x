ALTER TABLE "chapter_audio_versions" ALTER COLUMN "audio_url" SET DATA TYPE varchar(2048);--> statement-breakpoint
ALTER TABLE "chapters" ALTER COLUMN "audio_url" SET DATA TYPE varchar(2048);