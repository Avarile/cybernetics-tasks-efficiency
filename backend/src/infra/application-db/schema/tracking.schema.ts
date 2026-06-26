import {
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { defaultFields } from './identity.schema';
import { initiativeStatus } from './okr.schema';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const eventSource = pgEnum('event_source', [
  'human',
  'agent',
  'integration',
]);

export const subjectType = pgEnum('subject_type', [
  'initiative',
  'key_result',
  'objective',
]);

export const activityEventType = pgEnum('activity_event_type', [
  'created',
  'started',
  'paused',
  'resumed',
  'blocked',
  'unblocked',
  'cancelled',
  'completed',
  'time_logged',
  'reason_recorded',
  'outcome_recorded',
  'note_added',
  'key_result_measured',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** Append-only event log — no mutation/soft-delete columns. */
export const activityEvent = pgTable(
  'activity_event',
  {
    id: serial('id').primaryKey().notNull(),
    slug: uuid('slug').defaultRandom().notNull(),
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    recordedAt: timestamp('recorded_at', {
      withTimezone: true,
      mode: 'string',
    }).default(sql`now()`),
    actorPersonId: integer('actor_person_id').notNull(),
    subjectType: subjectType('subject_type').notNull(),
    subjectId: integer('subject_id').notNull(),
    type: activityEventType('type').notNull(),
    payload: jsonb('payload').default({}),
    source: eventSource('source').notNull().default('human'),
    confidence: decimal('confidence', { precision: 5, scale: 4 }),
    rawInputId: integer('raw_input_id'),
    correlationId: uuid('correlation_id'),
  },
  (t) => [
    index('activity_event_subject_index').on(t.subjectType, t.subjectId),
    index('activity_event_occurred_brin').using('brin', t.occurredAt),
    index('activity_event_payload_gin').using('gin', t.payload),
    index('activity_event_type_index').on(t.type),
  ],
);

export const rawInput = pgTable('raw_input', {
  personId: integer('person_id').notNull(),
  channel: varchar('channel').notNull(),
  text: text('text').notNull(),
  receivedAt: timestamp('received_at', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
  metadata: jsonb('metadata').default({}),
  ...defaultFields,
});

export const reasonTaxonomy = pgTable('reason_taxonomy', {
  label: varchar('label').notNull(),
  category: varchar('category').notNull(),
  ...defaultFields,
});

/** Projection: current state of each initiative, maintained by the projector. */
export const initiativeState = pgTable(
  'initiative_state',
  {
    initiativeId: integer('initiative_id').notNull(),
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
  (t) => [uniqueIndex('initiative_state_initiative_id_index').on(t.initiativeId)],
);

/** Projection/series: key result measurements over time. */
export const keyResultMeasurement = pgTable(
  'key_result_measurement',
  {
    keyResultId: integer('key_result_id').notNull(),
    value: decimal('value', { precision: 20, scale: 4 }).notNull(),
    measuredAt: timestamp('measured_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    sourceEventId: integer('source_event_id'),
    ...defaultFields,
  },
  (t) => [index('key_result_measurement_key_result_index').on(t.keyResultId)],
);
