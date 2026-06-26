CREATE TYPE "public"."person_role" AS ENUM('admin', 'manager', 'member', 'executive');--> statement-breakpoint
CREATE TABLE "department" (
	"name" varchar(255) NOT NULL,
	"description" text,
	"parent_id" integer,
	"lead_person_id" integer,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"name" varchar(255) NOT NULL,
	"description" text,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "person" (
	"name" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" varchar(255),
	"role" "person_role" DEFAULT 'member' NOT NULL,
	"department_id" integer,
	"team_id" integer,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "team" (
	"name" varchar(255) NOT NULL,
	"department_id" integer NOT NULL,
	"lead_person_id" integer,
	"id" serial PRIMARY KEY NOT NULL,
	"slug" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE INDEX "department_name_index" ON "department" USING btree ("name");--> statement-breakpoint
CREATE INDEX "department_parent_index" ON "department" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "organization_name_index" ON "organization" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "person_email_index" ON "person" USING btree ("email");--> statement-breakpoint
CREATE INDEX "person_role_index" ON "person" USING btree ("role");--> statement-breakpoint
CREATE INDEX "team_department_index" ON "team" USING btree ("department_id");