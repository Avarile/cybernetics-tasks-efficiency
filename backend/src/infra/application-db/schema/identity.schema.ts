import { index, integer, pgEnum, pgTable, uniqueIndex, varchar, text } from 'drizzle-orm/pg-core';
import { defaultFields } from './common.schema';

export const personRole = pgEnum('person_role', ['admin', 'manager', 'member', 'executive']);

export const organization = pgTable('organization', {
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  ...defaultFields,
}, (t) => [index('organization_name_index').on(t.name)]);

export const department = pgTable('department', {
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  parentId: integer('parent_id'),            // nested departments
  leadPersonId: integer('lead_person_id'),
  ...defaultFields,
}, (t) => [index('department_name_index').on(t.name), index('department_parent_index').on(t.parentId)]);

export const team = pgTable('team', {
  name: varchar('name', { length: 255 }).notNull(),
  departmentId: integer('department_id').notNull(),
  leadPersonId: integer('lead_person_id'),
  ...defaultFields,
}, (t) => [index('team_department_index').on(t.departmentId)]);

export const person = pgTable('person', {
  name: varchar('name', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 128 }),
  lastName: varchar('last_name', { length: 128 }),
  position: varchar('position', { length: 128 }),
  avatarAttachmentId: integer('avatar_attachment_id'),
  description: text('description'),
  note: text('note'),
  phone: varchar('phone', { length: 40 }),
  timezone: varchar('timezone', { length: 64 }),
  email: varchar('email', { length: 320 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  role: personRole('role').notNull().default('member'),
  departmentId: integer('department_id'),
  teamId: integer('team_id'),
  ...defaultFields,
}, (t) => [uniqueIndex('person_email_index').on(t.email), index('person_role_index').on(t.role)]);
