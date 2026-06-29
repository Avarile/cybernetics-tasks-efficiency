import {
  bigint, index, integer, pgEnum, pgTable, text, uniqueIndex, varchar,
} from 'drizzle-orm/pg-core';
import { defaultFields } from './common.schema';

export const filePurpose = pgEnum('file_purpose', ['general', 'public']);

export const attachment = pgTable(
  'attachment',
  {
    token: varchar('token', { length: 64 }).notNull(),
    bucket: varchar('bucket', { length: 128 }).notNull(),
    path: varchar('path', { length: 1024 }).notNull(),
    hash: varchar('hash', { length: 128 }).notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    mimetype: varchar('mimetype', { length: 255 }).notNull(),
    width: integer('width'),
    height: integer('height'),
    thumbnailPath: text('thumbnail_path'),
    purpose: filePurpose('purpose').notNull().default('general'),
    createdByPersonId: integer('created_by_person_id').notNull(),
    ...defaultFields,
  },
  (t) => [
    uniqueIndex('attachment_token_index').on(t.token),
    index('attachment_hash_index').on(t.hash),
    index('attachment_created_by_index').on(t.createdByPersonId),
  ],
);
