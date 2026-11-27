CREATE INDEX "broadcast_listeners_broadcast_seen_idx" ON "broadcast_listeners" USING btree ("broadcast_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "broadcast_views_broadcast_user_kind_idx" ON "broadcast_views" USING btree ("broadcast_id","user_id","kind");--> statement-breakpoint
CREATE INDEX "broadcasts_chapter_idx" ON "broadcasts" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "chapter_illustrations_illustration_idx" ON "chapter_illustrations" USING btree ("illustration_id");