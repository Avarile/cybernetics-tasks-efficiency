import { index, integer, pgEnum, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { defaultFields } from './common.schema';

export const knowledgeVisibility = pgEnum('knowledge_visibility', ['private', 'shared', 'organization']);

export const knowledge = pgTable(
  'knowledge',
  {
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body'),
    ownerPersonId: integer('owner_person_id').notNull(),
    visibility: knowledgeVisibility('visibility').notNull().default('private'),
    ...defaultFields,
  },
  (t) => [
    index('knowledge_owner_index').on(t.ownerPersonId),
    index('knowledge_visibility_index').on(t.visibility),
  ],
);

export const knowledgeShare = pgTable(
  'knowledge_share',
  {
    knowledgeId: integer('knowledge_id').notNull(),
    personId: integer('person_id').notNull(),
    ...defaultFields,
  },
  (t) => [
    index('knowledge_share_knowledge_index').on(t.knowledgeId),
    index('knowledge_share_person_index').on(t.personId),
    uniqueIndex('knowledge_share_unique').on(t.knowledgeId, t.personId).where(sql`${t.isDeleted} = false`),
  ],
);

export const knowledgeLink = pgTable(
  'knowledge_link',
  {
    knowledgeId: integer('knowledge_id').notNull(),
    url: varchar('url', { length: 2048 }).notNull(),
    title: varchar('title', { length: 255 }),
    ...defaultFields,
  },
  (t) => [index('knowledge_link_knowledge_index').on(t.knowledgeId)],
);

export const knowledgeAttachment = pgTable(
  'knowledge_attachment',
  {
    knowledgeId: integer('knowledge_id').notNull(),
    attachmentId: integer('attachment_id').notNull(),
    ...defaultFields,
  },
  (t) => [
    index('knowledge_attachment_knowledge_index').on(t.knowledgeId),
    index('knowledge_attachment_attachment_index').on(t.attachmentId),
    uniqueIndex('knowledge_attachment_unique').on(t.knowledgeId, t.attachmentId).where(sql`${t.isDeleted} = false`),
  ],
);

export const taskKnowledge = pgTable(
  'task_knowledge',
  {
    taskId: integer('task_id').notNull(),
    knowledgeId: integer('knowledge_id').notNull(),
    attachedByPersonId: integer('attached_by_person_id').notNull(),
    ...defaultFields,
  },
  (t) => [
    index('task_knowledge_task_index').on(t.taskId),
    index('task_knowledge_knowledge_index').on(t.knowledgeId),
    uniqueIndex('task_knowledge_unique').on(t.taskId, t.knowledgeId).where(sql`${t.isDeleted} = false`),
  ],
);
