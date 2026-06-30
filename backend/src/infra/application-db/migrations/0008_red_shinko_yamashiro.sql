ALTER TABLE "person" ADD COLUMN "first_name" varchar(128);--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "last_name" varchar(128);--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "position" varchar(128);--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "avatar_attachment_id" integer;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "phone" varchar(40);--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "timezone" varchar(64);