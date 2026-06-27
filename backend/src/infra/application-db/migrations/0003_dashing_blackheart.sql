CREATE TABLE "auth_session" (
	"person_id" integer NOT NULL,
	"refresh_token_hash" varchar(64) NOT NULL,
	"user_agent" varchar(512),
	"ip_address" varchar(64),
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_session_token_hash_index" ON "auth_session" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "auth_session_person_index" ON "auth_session" USING btree ("person_id");