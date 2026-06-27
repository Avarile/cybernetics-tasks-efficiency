import {
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { defaultFields } from './common.schema';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const objectiveScope = pgEnum('objective_scope', [
  'org',
  'department',
  'team',
]);

export const objectiveStatus = pgEnum('objective_status', [
  'draft',
  'active',
  'completed',
  'archived',
]);

export const krMetricType = pgEnum('kr_metric_type', [
  'number',
  'percent',
  'currency',
  'boolean',
]);

export const krDirection = pgEnum('kr_direction', ['increase', 'decrease']);

export const initiativeStatus = pgEnum('initiative_status', [
  'not_started',
  'in_progress',
  'blocked',
  'paused',
  'completed',
  'cancelled',
]);

export const interventionStatus = pgEnum('intervention_status', [
  'planned',
  'active',
  'measuring',
  'concluded',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const objective = pgTable(
  'objective',
  {
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    ownerPersonId: integer('owner_person_id').notNull(),
    scope: objectiveScope('scope').notNull(),
    scopeRefId: integer('scope_ref_id'),
    period: varchar('period', { length: 50 }).notNull(),
    status: objectiveStatus('status').notNull().default('draft'),
    ...defaultFields,
  },
  (t) => [index('objective_owner_index').on(t.ownerPersonId)],
);

export const keyResult = pgTable(
  'key_result',
  {
    objectiveId: integer('objective_id').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    metricType: krMetricType('metric_type').notNull(),
    unit: varchar('unit', { length: 100 }),
    startValue: decimal('start_value', { precision: 20, scale: 4 }),
    targetValue: decimal('target_value', { precision: 20, scale: 4 }),
    currentValue: decimal('current_value', { precision: 20, scale: 4 }),
    direction: krDirection('direction').notNull(),
    ...defaultFields,
  },
  (t) => [index('key_result_objective_index').on(t.objectiveId)],
);

export const initiative = pgTable(
  'initiative',
  {
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    ownerPersonId: integer('owner_person_id').notNull(),
    priority: varchar('priority', { length: 50 }).notNull(),
    dueDate: timestamp('due_date', { withTimezone: true, mode: 'string' }),
    // Denormalized convenience cache — authoritative status is the tracking projection (Task 10)
    status: initiativeStatus('status').notNull().default('not_started'),
    ...defaultFields,
  },
  (t) => [
    index('initiative_owner_index').on(t.ownerPersonId),
    index('initiative_status_index').on(t.status),
  ],
);

export const initiativeKeyResult = pgTable(
  'initiative_key_result',
  {
    initiativeId: integer('initiative_id').notNull(),
    keyResultId: integer('key_result_id').notNull(),
    ...defaultFields,
  },
  (t) => [
    index('initiative_key_result_initiative_index').on(t.initiativeId),
    index('initiative_key_result_key_result_index').on(t.keyResultId),
  ],
);

export const alignmentLink = pgTable(
  'alignment_link',
  {
    // plain varchar — 'objective' | 'key_result'; intentionally not an enum
    fromType: varchar('from_type', { length: 50 }).notNull(),
    fromId: integer('from_id').notNull(),
    toType: varchar('to_type', { length: 50 }).notNull(),
    toId: integer('to_id').notNull(),
    weight: decimal('weight', { precision: 6, scale: 2 }).default('1.00'),
    ...defaultFields,
  },
  (t) => [
    index('alignment_link_from_index').on(t.fromType, t.fromId),
    index('alignment_link_to_index').on(t.toType, t.toId),
  ],
);

export const intervention = pgTable(
  'intervention',
  {
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    decidedByPersonId: integer('decided_by_person_id').notNull(),
    startedAt: timestamp('started_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    scope: varchar('scope', { length: 100 }).notNull(),
    hypothesis: text('hypothesis'),
    measurementWindowDays: integer('measurement_window_days')
      .notNull()
      .default(14),
    status: interventionStatus('status').notNull().default('planned'),
    ...defaultFields,
  },
  (t) => [index('intervention_decided_by_index').on(t.decidedByPersonId)],
);

export const interventionKeyResult = pgTable(
  'intervention_key_result',
  {
    interventionId: integer('intervention_id').notNull(),
    keyResultId: integer('key_result_id').notNull(),
    ...defaultFields,
  },
  (t) => [
    index('intervention_key_result_intervention_index').on(t.interventionId),
    index('intervention_key_result_key_result_index').on(t.keyResultId),
  ],
);
