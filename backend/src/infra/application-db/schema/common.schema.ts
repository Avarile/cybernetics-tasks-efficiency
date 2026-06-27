import { boolean, serial, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Shared columns spread into every soft-deletable table.
 * Internal numeric PK (`id`) + public-facing `slug` (uuid).
 */
export const defaultFields = {
  id: serial('id').primaryKey().notNull(),
  slug: uuid('slug').defaultRandom().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  isDeleted: boolean('is_deleted').default(false),
  isActive: boolean('is_active').default(true),
};
