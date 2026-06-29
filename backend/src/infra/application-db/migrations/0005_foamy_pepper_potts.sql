CREATE TYPE "public"."alignable_type" AS ENUM('objective', 'key_result');--> statement-breakpoint
ALTER TABLE "alignment_link" ALTER COLUMN "from_type" SET DATA TYPE "public"."alignable_type" USING "from_type"::"public"."alignable_type";--> statement-breakpoint
ALTER TABLE "alignment_link" ALTER COLUMN "to_type" SET DATA TYPE "public"."alignable_type" USING "to_type"::"public"."alignable_type";--> statement-breakpoint
CREATE UNIQUE INDEX "alignment_link_unique_edge" ON "alignment_link" USING btree ("from_type","from_id","to_type","to_id") WHERE "alignment_link"."is_deleted" = false;