import {
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { defaultFields } from './common.schema';
import { initiativeStatus } from './okr.schema';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const taskPriority = pgEnum('task_priority', [
  'urgent',
  'high',
  'medium',
  'low',
  'none',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const task = pgTable(
  'task',
  {
    initiativeId: integer('initiative_id').notNull(), // ladders to an OKR initiative
    parentId: integer('parent_id'), // self-FK → sub-tasks
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    priority: taskPriority('priority').notNull().default('none'),
    startDate: timestamp('start_date', { withTimezone: true, mode: 'string' }),
    targetDate: timestamp('target_date', { withTimezone: true, mode: 'string' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
    sortOrder: doublePrecision('sort_order').notNull().default(65535),
    // Org-wide human ID. DB assigns it via DEFAULT nextval('task_sequence_seq')
    // (added by hand in the migration); inserts omit it.
    sequenceId: integer('sequence_id'),
    createdByPersonId: integer('created_by_person_id').notNull(),
    // Denormalized convenience cache — authoritative status is the task_state projection.
    status: initiativeStatus('status').notNull().default('not_started'),
    ...defaultFields,
  },
  (t) => [
    index('task_initiative_index').on(t.initiativeId),
    index('task_parent_index').on(t.parentId),
    index('task_status_index').on(t.status),
    uniqueIndex('task_sequence_index').on(t.sequenceId),
  ],
);

export const taskAssignee = pgTable(
  'task_assignee',
  {
    taskId: integer('task_id').notNull(),
    personId: integer('person_id').notNull(),
    ...defaultFields,
  },
  (t) => [
    index('task_assignee_task_index').on(t.taskId),
    index('task_assignee_person_index').on(t.personId),
    uniqueIndex('task_assignee_unique').on(t.taskId, t.personId).where(sql`${t.isDeleted} = false`),
  ],
);

export const label = pgTable(
  'label',
  {
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    color: varchar('color', { length: 32 }),
    parentId: integer('parent_id'), // self-FK → label hierarchy
    sortOrder: doublePrecision('sort_order').notNull().default(65535),
    ...defaultFields,
  },
  (t) => [
    index('label_name_index').on(t.name),
    index('label_parent_index').on(t.parentId),
  ],
);

export const taskLabel = pgTable(
  'task_label',
  {
    taskId: integer('task_id').notNull(),
    labelId: integer('label_id').notNull(),
    ...defaultFields,
  },
  (t) => [
    index('task_label_task_index').on(t.taskId),
    index('task_label_label_index').on(t.labelId),
    uniqueIndex('task_label_unique').on(t.taskId, t.labelId).where(sql`${t.isDeleted} = false`),
  ],
);

/** Projection: current state of each task, maintained by TaskStateProjector. */
export const taskState = pgTable(
  'task_state',
  {
    taskId: integer('task_id').notNull(),
    status: initiativeStatus('status').notNull().default('not_started'),
    totalTimeLoggedMinutes: integer('total_time_logged_minutes')
      .notNull()
      .default(0),
    blockedSince: timestamp('blocked_since', {
      withTimezone: true,
      mode: 'string',
    }),
    lastEventAt: timestamp('last_event_at', {
      withTimezone: true,
      mode: 'string',
    }),
    ...defaultFields,
  },
  (t) => [uniqueIndex('task_state_task_id_index').on(t.taskId)],
);
