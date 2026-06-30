CREATE TYPE "public"."knowledge_visibility" AS ENUM('private', 'shared', 'organization');--> statement-breakpoint
CREATE TABLE "knowledge" (
	"title" varchar(255) NOT NULL,
	"body" text,
	"owner_person_id" integer NOT NULL,
	"visibility" "knowledge_visibility" DEFAULT 'private' NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "knowledge_attachment" (
	"knowledge_id" integer NOT NULL,
	"attachment_id" integer NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "knowledge_link" (
	"knowledge_id" integer NOT NULL,
	"url" varchar(2048) NOT NULL,
	"title" varchar(255),
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "knowledge_share" (
	"knowledge_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "task_knowledge" (
	"task_id" integer NOT NULL,
	"knowledge_id" integer NOT NULL,
	"attached_by_person_id" integer NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE INDEX "knowledge_owner_index" ON "knowledge" USING btree ("owner_person_id");--> statement-breakpoint
CREATE INDEX "knowledge_visibility_index" ON "knowledge" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "knowledge_attachment_knowledge_index" ON "knowledge_attachment" USING btree ("knowledge_id");--> statement-breakpoint
CREATE INDEX "knowledge_attachment_attachment_index" ON "knowledge_attachment" USING btree ("attachment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_attachment_unique" ON "knowledge_attachment" USING btree ("knowledge_id","attachment_id") WHERE "knowledge_attachment"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "knowledge_link_knowledge_index" ON "knowledge_link" USING btree ("knowledge_id");--> statement-breakpoint
CREATE INDEX "knowledge_share_knowledge_index" ON "knowledge_share" USING btree ("knowledge_id");--> statement-breakpoint
CREATE INDEX "knowledge_share_person_index" ON "knowledge_share" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_share_unique" ON "knowledge_share" USING btree ("knowledge_id","person_id") WHERE "knowledge_share"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "task_knowledge_task_index" ON "task_knowledge" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_knowledge_knowledge_index" ON "task_knowledge" USING btree ("knowledge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_knowledge_unique" ON "task_knowledge" USING btree ("task_id","knowledge_id") WHERE "task_knowledge"."is_deleted" = false;