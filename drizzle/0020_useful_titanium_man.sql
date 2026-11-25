ALTER TABLE "daily_listening_stats" DROP CONSTRAINT "daily_listening_stats_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "listening_sessions" DROP CONSTRAINT "listening_sessions_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "daily_listening_stats" ADD CONSTRAINT "daily_listening_stats_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listening_sessions" ADD CONSTRAINT "listening_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;