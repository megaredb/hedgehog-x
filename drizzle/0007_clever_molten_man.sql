CREATE INDEX "bookmarks_user_idx" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookmarks_chapter_idx" ON "bookmarks" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "chapter_likes_chapter_idx" ON "chapter_likes" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "chapters_volume_id_idx" ON "chapters" USING btree ("volume_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chapters_volume_number_unique" ON "chapters" USING btree ("volume_id","chapter_number");--> statement-breakpoint
CREATE INDEX "illustrations_volume_id_idx" ON "illustrations" USING btree ("volume_id");--> statement-breakpoint
CREATE INDEX "progress_chapter_idx" ON "listening_progress" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "volume_likes_volume_idx" ON "volume_likes" USING btree ("volume_id");--> statement-breakpoint
CREATE INDEX "volumes_book_id_idx" ON "volumes" USING btree ("book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "volumes_book_number_unique" ON "volumes" USING btree ("book_id","volume_number");