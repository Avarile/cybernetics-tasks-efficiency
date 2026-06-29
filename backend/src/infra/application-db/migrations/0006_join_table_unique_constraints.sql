CREATE UNIQUE INDEX "task_assignee_unique" ON "task_assignee" USING btree ("task_id","person_id") WHERE "task_assignee"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "task_label_unique" ON "task_label" USING btree ("task_id","label_id") WHERE "task_label"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "initiative_key_result_unique" ON "initiative_key_result" USING btree ("initiative_id","key_result_id") WHERE "initiative_key_result"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "intervention_key_result_unique" ON "intervention_key_result" USING btree ("intervention_id","key_result_id") WHERE "intervention_key_result"."is_deleted" = false;
