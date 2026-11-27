CREATE TABLE "broadcast_reactions" (
	"message_id" varchar(36) NOT NULL,
	"user_id" text NOT NULL,
	"emoji" varchar(8) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "broadcast_reactions_message_id_user_id_emoji_pk" PRIMARY KEY("message_id","user_id","emoji")
);
--> statement-breakpoint
ALTER TABLE "broadcast_reactions" ADD CONSTRAINT "broadcast_reactions_message_id_broadcast_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."broadcast_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_reactions" ADD CONSTRAINT "broadcast_reactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;