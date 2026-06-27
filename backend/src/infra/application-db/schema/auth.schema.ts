import { index, integer, pgTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { defaultFields } from './common.schema';

/**
 * Persisted refresh sessions. One row per issued refresh token.
 * `refresh_token_hash` = sha256(hex) of the opaque refresh token (the raw token
 * is never stored). Revocation = set `revoked_at`. Enables logout + rotation.
 */
export const authSession = pgTable(
  'auth_session',
  {
    personId: integer('person_id').notNull(),
    refreshTokenHash: varchar('refresh_token_hash', { length: 64 }).notNull(),
    userAgent: varchar('user_agent', { length: 512 }),
    ipAddress: varchar('ip_address', { length: 64 }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
    ...defaultFields,
  },
  (t) => [
    uniqueIndex('auth_session_token_hash_index').on(t.refreshTokenHash),
    index('auth_session_person_index').on(t.personId),
  ],
);
