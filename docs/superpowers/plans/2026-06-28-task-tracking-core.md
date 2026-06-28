# Task Tracking (Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a granular `task` layer beneath `initiative` (the Plane *Issue* analog) — sub-tasks, multi-assignee, labels, priority enum, manual ordering, org-wide human IDs — with lifecycle driven through the existing event-sourced `activity_event` pipeline and tasks laddering up to OKR initiatives.

**Architecture:** A new `task.schema.ts` (5 tables + `task_priority` enum) reuses the existing `initiative_status` enum and `defaultFields`. Lifecycle reuses `TrackingService` → a new `TaskStateProjector` writes the `task_state` projection in the same transaction that appends the event (mirroring `InitiativeStateProjector`). New `module-task/` and `module-label/` follow the established `module-<name>/<name>.{module,controller,service,repo,dto,interface}.ts` shape. Authz via two new CASL subjects (`Task`, `Label`).

**Tech Stack:** NestJS 10 (Express), Drizzle ORM + Postgres, drizzle-kit migrations, `@casl/ability`, Jest/ts-jest (real-DB repo specs via `test/db-setup.ts`).

**Spec:** `docs/superpowers/specs/2026-06-28-task-tracking-core-design.md`

## Global Constraints

- All files live under `backend/src/`; import aliases use the `src/` prefix. Run all test/build commands from `backend/`.
- Every persistent table spreads `defaultFields` (serial `id`, uuid `slug`, tz timestamps, `isDeleted`/`isActive`) and is **soft-deleted** (`isDeleted=true` + `deletedAt`), never hard-deleted.
- Repositories implement the `runQuery(provider, ctx, fn, executor?)` pattern, take a trailing `tenancyInfo: IDBConfigOptions`, and never read `process.env` directly — `env.ts` is the single source of truth.
- The append-only `activity_event` log is the source of truth for lifecycle; **status is derived by projection, never mutated directly** on a status transition.
- Reuse the existing `initiative_status` pg enum for task status (do **not** create a parallel status enum).
- Join-table dedup follows the existing `initiativeKeyResult` pattern: check-before-insert on `isDeleted=false` (no DB unique constraint, because soft-delete makes a plain unique impractical).
- Human-readable task IDs are org-wide via a Postgres sequence; the display key `${env.TASK_KEY_PREFIX}-${sequenceId}` is **composed, never stored**.
- CASL: **executive is read-only** (no task/label writes); **manager** manages Task+Label; **member** manages own (`createdByPersonId`) Task and reads all Task/Label. Do not grant executive any write.
- Each task ends with `cd backend && yarn test` green and (final task) `yarn build` + `yarn lint` clean.

---

## File Map

**Create:**
- `backend/src/infra/application-db/schema/task.schema.ts` — `task_priority` enum + `task`, `taskAssignee`, `label`, `taskLabel`, `taskState` tables
- `backend/src/infra/application-db/schema/task.schema.spec.ts` — schema-shape assertions
- `backend/src/infra/application-db/migrations/0004_*.sql` — generated, then hand-edited (enum `IF NOT EXISTS`, sequence, default)
- `backend/src/modules/business-logic-modules/module-label/label.interface.ts`
- `backend/src/modules/business-logic-modules/module-label/label.dto.ts`
- `backend/src/modules/business-logic-modules/module-label/label.repo.ts`
- `backend/src/modules/business-logic-modules/module-label/label.repo.spec.ts`
- `backend/src/modules/business-logic-modules/module-label/label.service.ts`
- `backend/src/modules/business-logic-modules/module-label/label.controller.ts`
- `backend/src/modules/business-logic-modules/module-label/label.module.ts`
- `backend/src/modules/business-logic-modules/module-task/task.interface.ts`
- `backend/src/modules/business-logic-modules/module-task/task.util.ts`
- `backend/src/modules/business-logic-modules/module-task/task.dto.ts`
- `backend/src/modules/business-logic-modules/module-task/task.repo.ts`
- `backend/src/modules/business-logic-modules/module-task/task.repo.spec.ts`
- `backend/src/modules/business-logic-modules/module-task/task.service.ts`
- `backend/src/modules/business-logic-modules/module-task/task.service.spec.ts`
- `backend/src/modules/business-logic-modules/module-task/task.controller.ts`
- `backend/src/modules/business-logic-modules/module-task/task.module.ts`
- `backend/src/modules/business-logic-modules/module-tracking/projection/task-state.repo.ts`
- `backend/src/modules/business-logic-modules/module-tracking/projection/task-state.projector.ts`
- `backend/src/modules/business-logic-modules/module-tracking/projection/task-state.projector.spec.ts`

**Modify:**
- `backend/src/infra/application-db/schema/tracking.schema.ts` — add `'task'` to `subjectType` enum
- `backend/src/infra/application-db/schema/index.ts` — export `task.schema`
- `backend/src/utils/env.ts` — add `TASK_KEY_PREFIX`
- `backend/src/common/casl/ability.types.ts` — add `'Task'`, `'Label'` to `AppSubjectName`
- `backend/src/common/casl/ability.factory.ts` — Task/Label rules per role
- `backend/src/common/casl/ability.factory.spec.ts` — Task/Label cases
- `backend/src/modules/business-logic-modules/module-tracking/tracking.interface.ts` — `'task'` in `subjectType` union
- `backend/src/modules/business-logic-modules/module-tracking/activity-event.repo.ts` — `'task'` in `listBySubject` param type
- `backend/src/modules/business-logic-modules/module-tracking/tracking.service.ts` — `emitLifecycle` refactor + task methods + 2nd projector
- `backend/src/modules/business-logic-modules/module-tracking/tracking.controller.ts` — task lifecycle endpoints
- `backend/src/modules/business-logic-modules/module-tracking/tracking.module.ts` — providers + `TaskModule` import
- `backend/src/modules/main.module.ts` — register `TaskModule`, `LabelModule`

---

### Task 1: Schema + migration

**Files:**
- Create: `backend/src/infra/application-db/schema/task.schema.ts`
- Create: `backend/src/infra/application-db/schema/task.schema.spec.ts`
- Modify: `backend/src/infra/application-db/schema/tracking.schema.ts:29-33`
- Modify: `backend/src/infra/application-db/schema/index.ts`
- Create: `backend/src/infra/application-db/migrations/0004_*.sql` (generated + hand-edited)

**Interfaces:**
- Produces: drizzle tables `task`, `taskAssignee`, `label`, `taskLabel`, `taskState`; enum `taskPriority` — imported by Tasks 3–8. Postgres sequence `task_sequence_seq` + `task.sequence_id` DEFAULT `nextval(...)`.

- [ ] **Step 1: Write the failing schema-shape test**

Create `backend/src/infra/application-db/schema/task.schema.spec.ts`:

```ts
import { getTableColumns } from 'drizzle-orm';
import { task, taskAssignee, label, taskLabel, taskState, taskPriority } from './task.schema';
import { subjectType } from './tracking.schema';

describe('task.schema', () => {
  it('taskPriority enum has the five Plane priority values', () => {
    expect(taskPriority.enumValues).toEqual(['urgent', 'high', 'medium', 'low', 'none']);
  });

  it('task table exposes the core columns', () => {
    const cols = Object.keys(getTableColumns(task));
    for (const c of ['id', 'slug', 'initiativeId', 'parentId', 'title', 'priority',
      'startDate', 'targetDate', 'completedAt', 'sortOrder', 'sequenceId',
      'createdByPersonId', 'status', 'isDeleted']) {
      expect(cols).toContain(c);
    }
  });

  it('join + projection tables expose their keys', () => {
    expect(Object.keys(getTableColumns(taskAssignee))).toEqual(expect.arrayContaining(['taskId', 'personId']));
    expect(Object.keys(getTableColumns(taskLabel))).toEqual(expect.arrayContaining(['taskId', 'labelId']));
    expect(Object.keys(getTableColumns(label))).toEqual(expect.arrayContaining(['name', 'color', 'parentId', 'sortOrder']));
    expect(Object.keys(getTableColumns(taskState))).toEqual(expect.arrayContaining(['taskId', 'status', 'totalTimeLoggedMinutes', 'blockedSince', 'lastEventAt']));
  });

  it('subjectType enum now includes task', () => {
    expect(subjectType.enumValues).toContain('task');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && yarn test src/infra/application-db/schema/task.schema.spec.ts`
Expected: FAIL — `Cannot find module './task.schema'`.

- [ ] **Step 3: Create `task.schema.ts`**

```ts
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
```

- [ ] **Step 4: Extend the `subjectType` enum**

In `backend/src/infra/application-db/schema/tracking.schema.ts`, change the `subjectType` enum (currently lines 29–33):

```ts
export const subjectType = pgEnum('subject_type', [
  'initiative',
  'key_result',
  'objective',
  'task',
]);
```

- [ ] **Step 5: Export the new schema**

Append to `backend/src/infra/application-db/schema/index.ts`:

```ts
export * from './task.schema';
```

- [ ] **Step 6: Run the schema test to verify it passes**

Run: `cd backend && yarn test src/infra/application-db/schema/task.schema.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Generate the migration**

Run: `cd backend && yarn db:generate`
Expected: a new file `src/infra/application-db/migrations/0004_<random>.sql` containing `CREATE TYPE "public"."task_priority"`, `CREATE TABLE "task"/"task_assignee"/"label"/"task_label"/"task_state"`, and an `ALTER TYPE ... ADD VALUE 'task'` for `subject_type`.

- [ ] **Step 8: Hand-edit the migration for idempotent enum + the ID sequence**

Open the generated `0004_*.sql` and make two edits:

(a) Make the `subject_type` extension idempotent (the test harness re-runs migrations against a DB where `public` enums persist, and only tolerates duplicate errors for `CREATE TYPE`). Change:

```sql
ALTER TYPE "public"."subject_type" ADD VALUE 'task';
```
to:
```sql
ALTER TYPE "public"."subject_type" ADD VALUE IF NOT EXISTS 'task';
```

(b) Append the org-wide sequence and wire it as the `sequence_id` default. Add to the end of the file, each separated by a `--> statement-breakpoint` line:

```sql
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "task_sequence_seq";--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "sequence_id" SET DEFAULT nextval('task_sequence_seq');
```

> Note: `ALTER TYPE ... ADD VALUE` requires PostgreSQL ≥ 12 to run inside the migrator's transaction (the new value is only usable after commit, which is fine — we never use it in the same migration). The sequence is created in the active `search_path` schema (`COMPANY_SCHEMA` in prod, the isolated test schema in specs), so it is correctly tenant-scoped.

- [ ] **Step 9: Run the full suite to verify the migration applies in test schemas**

Run: `cd backend && yarn test`
Expected: PASS — existing 137 unit + integration specs still green; the new schema spec green. The real-DB repo specs prove `0004_*.sql` applies cleanly into a fresh schema.

- [ ] **Step 10: Commit**

```bash
git add backend/src/infra/application-db/schema/task.schema.ts \
        backend/src/infra/application-db/schema/task.schema.spec.ts \
        backend/src/infra/application-db/schema/tracking.schema.ts \
        backend/src/infra/application-db/schema/index.ts \
        backend/src/infra/application-db/migrations/
git commit -m "feat(task): add task/label/task_state schema + subject_type 'task' + id sequence"
```

---

### Task 2: CASL subjects (Task, Label)

**Files:**
- Modify: `backend/src/common/casl/ability.types.ts:5-16`
- Modify: `backend/src/common/casl/ability.factory.ts`
- Modify: `backend/src/common/casl/ability.factory.spec.ts`

**Interfaces:**
- Consumes: `defineAbilityFor(user)` from Task-0 codebase.
- Produces: subjects `'Task'`, `'Label'` usable in `@CheckPolicies` and `assertAbility` (Tasks 5, 8).

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/common/casl/ability.factory.spec.ts` inside the `describe('defineAbilityFor', ...)` block:

```ts
it('admin can manage Task and Label', () => {
  const a = defineAbilityFor(user({ role: 'admin' }));
  expect(a.can('create', 'Task')).toBe(true);
  expect(a.can('delete', 'Label')).toBe(true);
});

it('executive can read Task/Label but not write (read-only)', () => {
  const a = defineAbilityFor(user({ role: 'executive' }));
  expect(a.can('read', 'Task')).toBe(true);
  expect(a.can('create', 'Task')).toBe(false);
  expect(a.can('update', 'Label')).toBe(false);
});

it('manager can manage Task and Label', () => {
  const a = defineAbilityFor(user({ id: 5, role: 'manager' }));
  expect(a.can('create', 'Task')).toBe(true);
  expect(a.can('delete', subject('Task', { createdByPersonId: 9 }))).toBe(true);
  expect(a.can('manage', 'Label')).toBe(true);
});

it('member can manage only own Task and read all Task/Label', () => {
  const a = defineAbilityFor(user({ id: 7, role: 'member' }));
  expect(a.can('update', subject('Task', { createdByPersonId: 7 }))).toBe(true);
  expect(a.can('update', subject('Task', { createdByPersonId: 8 }))).toBe(false);
  expect(a.can('read', subject('Task', { createdByPersonId: 8 }))).toBe(true);
  expect(a.can('read', 'Label')).toBe(true);
  expect(a.can('create', 'Label')).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && yarn test src/common/casl/ability.factory.spec.ts`
Expected: FAIL — TypeScript error / assertion failures: `'Task'` not assignable to `AppSubjectName`.

- [ ] **Step 3: Add the subjects to `ability.types.ts`**

In `backend/src/common/casl/ability.types.ts`, extend the `AppSubjectName` union (insert before `| 'all'`):

```ts
export type AppSubjectName =
  | 'Organization'
  | 'Department'
  | 'Team'
  | 'Person'
  | 'Objective'
  | 'KeyResult'
  | 'Initiative'
  | 'AlignmentLink'
  | 'Intervention'
  | 'ActivityEvent'
  | 'Task'
  | 'Label'
  | 'all';
```

- [ ] **Step 4: Add the rules to `ability.factory.ts`**

In `defineAbilityFor`, add to the `manager` case (alongside the existing `can('manage', 'Initiative')`):

```ts
can('manage', 'Task');
can('manage', 'Label');
```

And to the `member` case (alongside `can('manage', 'Initiative', { ownerPersonId: user.id })`):

```ts
can('manage', 'Task', { createdByPersonId: user.id });
can('read', 'Task');
can('read', 'Label');
```

(`admin` already has `manage all`; `executive` already has `read all` — no change needed for those.)

- [ ] **Step 5: Run to verify pass**

Run: `cd backend && yarn test src/common/casl/ability.factory.spec.ts`
Expected: PASS (all prior cases + 4 new).

- [ ] **Step 6: Commit**

```bash
git add backend/src/common/casl/
git commit -m "feat(casl): add Task and Label subjects with role rules"
```

---

### Task 3: Label module

**Files:**
- Create: `backend/src/modules/business-logic-modules/module-label/label.interface.ts`
- Create: `.../module-label/label.dto.ts`
- Create: `.../module-label/label.repo.ts`
- Create: `.../module-label/label.repo.spec.ts`
- Create: `.../module-label/label.service.ts`
- Create: `.../module-label/label.controller.ts`
- Create: `.../module-label/label.module.ts`
- Modify: `backend/src/modules/main.module.ts`

**Interfaces:**
- Consumes: `label` table (Task 1); `runQuery`, `withPagination`, `IDBConfigOptions`, `IBaseResponse`/`IBaseQueryResult`, `buildOk`/`buildCreated`, CASL `Label` (Task 2).
- Produces: `LabelRepository` (`create/findById/findBySlug/update/delete/query/queryAll/countAll`), `LabelService`, `LabelModule` (exports `LabelRepository`, `LabelService`) — used by Task 4 (task→label linking can resolve labels) and the app.

- [ ] **Step 1: Write the failing repo test**

Create `backend/src/modules/business-logic-modules/module-label/label.repo.spec.ts`:

```ts
import 'dotenv/config';
import { useTestSchema } from '../../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { LabelRepository } from './label.repo';

describe('LabelRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: LabelRepository;

  beforeAll(() => {
    repo = new LabelRepository(new ApplicationDBProvider());
  });

  it('create then findById returns the row', async () => {
    const ctx = getCtx();
    const created = await repo.create({ name: 'bug', color: '#ff0000' }, ctx);
    expect(created.id).toBeDefined();
    expect(created.name).toBe('bug');
    const found = await repo.findById(created.id, ctx);
    expect(found?.name).toBe('bug');
  });

  it('delete soft-deletes (hidden from findById)', async () => {
    const ctx = getCtx();
    const created = await repo.create({ name: 'temp' }, ctx);
    await repo.delete(created.id, ctx);
    expect(await repo.findById(created.id, ctx)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && yarn test src/modules/business-logic-modules/module-label/label.repo.spec.ts`
Expected: FAIL — `Cannot find module './label.repo'`.

- [ ] **Step 3: Create `label.interface.ts`**

```ts
import {
  DefaultFields,
  IBaseQueryParams,
  UpdatableDefaultFields,
} from 'src/utils/shared/interface';

export interface ILabelProfile {
  name: string;
  description?: string | null;
  color?: string | null;
  parentId?: number | null;
  sortOrder?: number;
}

export interface INewLabel extends ILabelProfile {}
export interface IUpdateLabel extends Partial<ILabelProfile>, UpdatableDefaultFields {}
export interface IQueryLabelParams extends Partial<ILabelProfile>, Partial<IBaseQueryParams> {}
export interface ILabelEntity extends DefaultFields, ILabelProfile {}
```

- [ ] **Step 4: Create `label.repo.ts`**

```ts
import { HttpStatus, Injectable } from '@nestjs/common';
import { eq, and, ilike, inArray, desc, asc, count, SQL, getTableColumns } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';
import { AppException } from 'src/utils/exception.provider';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { runQuery } from 'src/infra/application-db/query-runner';
import { label } from 'src/infra/application-db/schema/task.schema';
import { BaseRepo } from 'src/utils/shared/base.abstract';
import { IBaseQueryResult } from 'src/utils/shared/interface';
import { withPagination } from 'src/utils/shared/query';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import {
  INewLabel,
  IUpdateLabel,
  IQueryLabelParams,
  ILabelEntity,
} from './label.interface';

@Injectable()
export class LabelRepository implements BaseRepo<ILabelEntity> {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async create(item: INewLabel, ctx: IDBConfigOptions): Promise<ILabelEntity> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .insert(label)
        .values({
          name: item.name,
          description: item.description ?? null,
          color: item.color ?? null,
          parentId: item.parentId ?? null,
          sortOrder: item.sortOrder ?? 65535,
        })
        .returning();
      return row as ILabelEntity;
    });
  }

  async update(id: number, payload: IUpdateLabel, ctx: IDBConfigOptions): Promise<ILabelEntity> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [existing] = await db
        .select({ id: label.id })
        .from(label)
        .where(and(eq(label.id, id), eq(label.isDeleted, false)));
      if (!existing) AppException.notFound('Label', id);

      const { id: _i, slug: _s, createdAt: _c, ...rest } = payload as any;
      const [updated] = await db
        .update(label)
        .set({ ...rest, updatedAt: new Date().toISOString() })
        .where(eq(label.id, id))
        .returning();
      return updated as ILabelEntity;
    });
  }

  async delete(id: string | number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db
        .update(label)
        .set({ isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(label.id, Number(id)));
    });
  }

  async findById(id: string | number, ctx: IDBConfigOptions): Promise<ILabelEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .select({ ...getTableColumns(label) })
        .from(label)
        .where(and(eq(label.id, Number(id)), eq(label.isDeleted, false)));
      return (row as ILabelEntity) || null;
    });
  }

  async findBySlug(slug: string, ctx: IDBConfigOptions): Promise<ILabelEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .select({ ...getTableColumns(label) })
        .from(label)
        .where(and(eq(label.slug, slug), eq(label.isDeleted, false)));
      return (row as ILabelEntity) || null;
    });
  }

  async queryAll(ctx: IDBConfigOptions): Promise<ILabelEntity[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({ ...getTableColumns(label) })
        .from(label)
        .where(eq(label.isDeleted, false))
        .orderBy(asc(label.sortOrder));
      return rows as ILabelEntity[];
    });
  }

  async query(searchParams: IQueryLabelParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    const { name, id, ids, slug, page = 1, pageSize = 50, isDeleted } = searchParams;
    const conditions: SQL[] = [eq(label.isDeleted, isDeleted ?? false)];
    if (id) conditions.push(eq(label.id, id));
    if (ids?.length) conditions.push(inArray(label.id, ids));
    if (slug) conditions.push(eq(label.slug, slug));
    if (name) conditions.push(ilike(label.name, `%${name}%`));
    const where = and(...conditions);

    return runQuery(this.dbProvider, ctx, async (db) => {
      const q = db.select({ ...getTableColumns(label) }).from(label).where(where).orderBy(desc(label.createdAt)).$dynamic();
      const data = await withPagination(q, page, pageSize);
      const total = await this.countAll(ctx, where);
      return {
        data: data as ILabelEntity[],
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        status_code: HttpStatus.OK,
        message: 'Label query successful',
        timestamp: new Date(),
        error: null,
      };
    });
  }

  async findAll(searchParams: IQueryLabelParams, ctx: IDBConfigOptions): Promise<ILabelEntity[]> {
    const res = await this.query(searchParams, ctx);
    return res.data as ILabelEntity[];
  }

  async countAll(ctx: IDBConfigOptions, where?: SQL): Promise<number> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [{ c }] = await db.select({ c: count() }).from(label).where(where ?? eq(label.isDeleted, false));
      return Number(c);
    });
  }
}
```

- [ ] **Step 5: Run the repo test to verify it passes**

Run: `cd backend && yarn test src/modules/business-logic-modules/module-label/label.repo.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Create `label.dto.ts`**

```ts
import { IsString, IsOptional, IsNumber, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { INewLabel, IUpdateLabel } from './label.interface';

export class NewLabelDTO implements INewLabel {
  @ApiProperty() @IsString() @MinLength(1) name!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() color?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() parentId?: number | null;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() sortOrder?: number;
}

export class UpdateLabelDTO implements IUpdateLabel {
  @ApiProperty() @IsNumber() id!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() color?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() parentId?: number | null;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() sortOrder?: number;
}

export class FindLabelByIdDTO {
  @ApiProperty() @IsNumber() @Type(() => Number) id!: number;
}
```

- [ ] **Step 7: Create `label.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { LabelRepository } from './label.repo';
import { INewLabel, IUpdateLabel, ILabelEntity } from './label.interface';

@Injectable()
export class LabelService {
  constructor(private readonly repo: LabelRepository) {}

  async create(item: INewLabel, ctx: IDBConfigOptions): Promise<ILabelEntity> {
    return this.repo.create(item, ctx);
  }

  async requireById(id: number, ctx: IDBConfigOptions): Promise<ILabelEntity> {
    const entity = await this.repo.findById(id, ctx);
    if (!entity) AppException.notFound('Label', id);
    return entity!;
  }

  async update(id: number, payload: IUpdateLabel, ctx: IDBConfigOptions): Promise<ILabelEntity> {
    await this.requireById(id, ctx);
    return this.repo.update(id, payload, ctx);
  }

  async remove(id: number, ctx: IDBConfigOptions): Promise<void> {
    await this.requireById(id, ctx);
    await this.repo.delete(id, ctx);
  }

  async queryAll(ctx: IDBConfigOptions): Promise<ILabelEntity[]> {
    return this.repo.queryAll(ctx);
  }
}
```

- [ ] **Step 8: Create `label.controller.ts`**

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LabelService } from './label.service';
import { NewLabelDTO, UpdateLabelDTO, FindLabelByIdDTO } from './label.dto';
import { IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { CheckPolicies } from 'src/common/casl/policy.types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('labels')
@Controller('labels')
export class LabelController {
  constructor(
    private readonly labelService: LabelService,
    private readonly ctx: DbContextService,
  ) {}

  @Post()
  @CheckPolicies((a) => a.can('create', 'Label'))
  @ApiOperation({ summary: 'Create a label' })
  async create(@CurrentUser() user: IUserSession, @Body() dto: NewLabelDTO): Promise<IBaseResponse> {
    const result = await this.labelService.create(dto, this.ctx.forUser(user.id));
    return buildCreated(result, 'Label created successfully');
  }

  @Get()
  @CheckPolicies((a) => a.can('read', 'Label'))
  @ApiOperation({ summary: 'List all labels' })
  async list(@CurrentUser() user: IUserSession): Promise<IBaseResponse> {
    const data = await this.labelService.queryAll(this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} labels`);
  }

  @Patch(':id')
  @CheckPolicies((a) => a.can('update', 'Label'))
  @ApiOperation({ summary: 'Update a label' })
  async update(@CurrentUser() user: IUserSession, @Param() params: FindLabelByIdDTO, @Body() dto: UpdateLabelDTO): Promise<IBaseResponse> {
    const updated = await this.labelService.update(params.id, dto, this.ctx.forUser(user.id));
    return buildOk(updated, 'Label updated successfully');
  }

  @Delete(':id')
  @CheckPolicies((a) => a.can('delete', 'Label'))
  @ApiOperation({ summary: 'Soft-delete a label' })
  async remove(@CurrentUser() user: IUserSession, @Param() params: FindLabelByIdDTO): Promise<IBaseResponse> {
    await this.labelService.remove(params.id, this.ctx.forUser(user.id));
    return buildOk(null, 'Label deleted successfully');
  }
}
```

- [ ] **Step 9: Create `label.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { LabelController } from './label.controller';
import { LabelRepository } from './label.repo';
import { LabelService } from './label.service';

@Module({
  controllers: [LabelController],
  providers: [LabelRepository, LabelService],
  exports: [LabelRepository, LabelService],
})
export class LabelModule {}
```

- [ ] **Step 10: Register in `main.module.ts`**

Add the import and include `LabelModule` in the `imports` array of `backend/src/modules/main.module.ts`:

```ts
import { LabelModule } from './business-logic-modules/module-label/label.module';
```
(add `LabelModule,` to the `imports: [...]` list)

- [ ] **Step 11: Run tests + build to verify wiring**

Run: `cd backend && yarn test src/modules/business-logic-modules/module-label && yarn build`
Expected: PASS + clean build (module resolves in the Nest graph).

- [ ] **Step 12: Commit**

```bash
git add backend/src/modules/business-logic-modules/module-label/ backend/src/modules/main.module.ts
git commit -m "feat(label): add Label module (repo/service/controller) wired into MainModule"
```

---

### Task 4: Task repository + interfaces + DTO

**Files:**
- Create: `backend/src/modules/business-logic-modules/module-task/task.interface.ts`
- Create: `.../module-task/task.util.ts`
- Create: `.../module-task/task.dto.ts`
- Create: `.../module-task/task.repo.ts`
- Create: `.../module-task/task.repo.spec.ts`
- Modify: `backend/src/utils/env.ts:34`

**Interfaces:**
- Consumes: `task`, `taskAssignee`, `taskLabel` tables (Task 1); `runQuery`, `withPagination`, `IDBConfigOptions`.
- Produces:
  - `ITaskEntity`, `INewTask`, `IUpdateTask`, `IQueryTaskParams`, `ITaskSummary`, `TaskStatus`, `TaskPriority` (task.interface.ts)
  - `buildTaskKey(sequenceId: number | null): string | null` (task.util.ts)
  - `TaskRepository` with: `create(INewTask) → ITaskEntity` (DB assigns `sequenceId`), `findById`, `findBySlug`, `update(id, IUpdateTask)`, `delete`, `query → IBaseQueryResult`, `queryAll`, `countAll`, `existByID`, `findChildren(parentId) → ITaskEntity[]`, `countByInitiative(initiativeId) → ITaskSummary`, `linkAssignee/unlinkAssignee/findAssigneeIds`, `addLabel/removeLabel/findLabelIds` — used by Tasks 5–8.

- [ ] **Step 1: Add `TASK_KEY_PREFIX` to `env.ts`**

In `backend/src/utils/env.ts`, add inside the `z.object({...})` (e.g. after the redis block, before the closing `})`):

```ts
  // task tracking
  TASK_KEY_PREFIX: z.string().default('TASK'),
```

- [ ] **Step 2: Write the failing repo test**

Create `backend/src/modules/business-logic-modules/module-task/task.repo.spec.ts`:

```ts
import 'dotenv/config';
import { useTestSchema } from '../../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { TaskRepository } from './task.repo';

describe('TaskRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: TaskRepository;
  beforeAll(() => { repo = new TaskRepository(new ApplicationDBProvider()); });

  const base = { initiativeId: 1, createdByPersonId: 1, priority: 'none' as const };

  it('create assigns an org-wide sequenceId and defaults status', async () => {
    const ctx = getCtx();
    const a = await repo.create({ ...base, title: 'First' }, ctx);
    const b = await repo.create({ ...base, title: 'Second' }, ctx);
    expect(a.sequenceId).not.toBeNull();
    expect(b.sequenceId).toBe((a.sequenceId as number) + 1);
    expect(a.status).toBe('not_started');
  });

  it('delete soft-deletes', async () => {
    const ctx = getCtx();
    const t = await repo.create({ ...base, title: 'Temp' }, ctx);
    await repo.delete(t.id, ctx);
    expect(await repo.findById(t.id, ctx)).toBeNull();
  });

  it('findChildren returns sub-tasks of a parent', async () => {
    const ctx = getCtx();
    const parent = await repo.create({ ...base, title: 'Parent' }, ctx);
    await repo.create({ ...base, title: 'Child', parentId: parent.id }, ctx);
    const kids = await repo.findChildren(parent.id, ctx);
    expect(kids.map((k) => k.title)).toContain('Child');
  });

  it('countByInitiative aggregates by status', async () => {
    const ctx = getCtx();
    await repo.create({ ...base, initiativeId: 555, title: 'X' }, ctx);
    await repo.create({ ...base, initiativeId: 555, title: 'Y' }, ctx);
    const summary = await repo.countByInitiative(555, ctx);
    expect(summary.total).toBe(2);
    expect(summary.byStatus.not_started).toBe(2);
  });

  it('linkAssignee is idempotent and listed by findAssigneeIds', async () => {
    const ctx = getCtx();
    const t = await repo.create({ ...base, title: 'Assignee Test' }, ctx);
    await repo.linkAssignee(t.id, 9, ctx);
    await repo.linkAssignee(t.id, 9, ctx);
    expect(await repo.findAssigneeIds(t.id, ctx)).toEqual([9]);
    await repo.unlinkAssignee(t.id, 9, ctx);
    expect(await repo.findAssigneeIds(t.id, ctx)).not.toContain(9);
  });

  it('addLabel is idempotent and listed by findLabelIds', async () => {
    const ctx = getCtx();
    const t = await repo.create({ ...base, title: 'Label Test' }, ctx);
    await repo.addLabel(t.id, 3, ctx);
    await repo.addLabel(t.id, 3, ctx);
    expect(await repo.findLabelIds(t.id, ctx)).toEqual([3]);
    await repo.removeLabel(t.id, 3, ctx);
    expect(await repo.findLabelIds(t.id, ctx)).not.toContain(3);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd backend && yarn test src/modules/business-logic-modules/module-task/task.repo.spec.ts`
Expected: FAIL — `Cannot find module './task.repo'`.

- [ ] **Step 4: Create `task.interface.ts`**

```ts
import {
  DefaultFields,
  IBaseQueryParams,
  UpdatableDefaultFields,
} from 'src/utils/shared/interface';

export type TaskStatus =
  | 'not_started' | 'in_progress' | 'blocked' | 'paused' | 'completed' | 'cancelled';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface ITaskProfile {
  initiativeId: number;
  parentId?: number | null;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  startDate?: string | null;
  targetDate?: string | null;
  createdByPersonId: number;
}

export interface INewTask extends ITaskProfile {}

export interface IUpdateTask
  extends Partial<Omit<ITaskProfile, 'createdByPersonId'>>,
    UpdatableDefaultFields {
  completedAt?: string | null;
  sortOrder?: number;
}

export interface IQueryTaskParams extends Partial<ITaskProfile>, Partial<IBaseQueryParams> {
  status?: TaskStatus;
}

export interface ITaskEntity extends DefaultFields, ITaskProfile {
  completedAt: string | null;
  sortOrder: number;
  sequenceId: number | null;
  status: TaskStatus;
}

export interface ITaskSummary {
  total: number;
  byStatus: Record<TaskStatus, number>;
}
```

- [ ] **Step 5: Create `task.util.ts`**

```ts
import env from 'src/utils/env';

/** Compose the display key for a task (e.g. "TASK-123"). Never stored. */
export function buildTaskKey(sequenceId: number | null): string | null {
  if (sequenceId == null) return null;
  return `${env.TASK_KEY_PREFIX}-${sequenceId}`;
}
```

- [ ] **Step 6: Create `task.repo.ts`**

```ts
import { HttpStatus, Injectable } from '@nestjs/common';
import { eq, and, ilike, inArray, desc, asc, count, SQL, getTableColumns } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';
import { AppException } from 'src/utils/exception.provider';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { runQuery } from 'src/infra/application-db/query-runner';
import { task, taskAssignee, taskLabel } from 'src/infra/application-db/schema/task.schema';
import { BaseRepo } from 'src/utils/shared/base.abstract';
import { IBaseQueryResult } from 'src/utils/shared/interface';
import { withPagination } from 'src/utils/shared/query';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import {
  INewTask, IUpdateTask, IQueryTaskParams, ITaskEntity, ITaskSummary, TaskStatus,
} from './task.interface';

const ALL_STATUSES: TaskStatus[] = ['not_started', 'in_progress', 'blocked', 'paused', 'completed', 'cancelled'];

@Injectable()
export class TaskRepository implements BaseRepo<ITaskEntity> {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async create(item: INewTask, ctx: IDBConfigOptions): Promise<ITaskEntity> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      // sequenceId is intentionally omitted — the DB DEFAULT nextval(...) assigns it.
      const [row] = await db
        .insert(task)
        .values({
          initiativeId: item.initiativeId,
          parentId: item.parentId ?? null,
          title: item.title,
          description: item.description ?? null,
          priority: item.priority,
          startDate: item.startDate ?? null,
          targetDate: item.targetDate ?? null,
          createdByPersonId: item.createdByPersonId,
          status: 'not_started',
        })
        .returning();
      return row as ITaskEntity;
    });
  }

  async update(id: number, payload: IUpdateTask, ctx: IDBConfigOptions): Promise<ITaskEntity> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [existing] = await db
        .select({ id: task.id })
        .from(task)
        .where(and(eq(task.id, id), eq(task.isDeleted, false)));
      if (!existing) AppException.notFound('Task', id);

      const { id: _i, slug: _s, createdAt: _c, sequenceId: _seq, status: _st, ...rest } = payload as any;
      const [updated] = await db
        .update(task)
        .set({ ...rest, updatedAt: new Date().toISOString() })
        .where(eq(task.id, id))
        .returning();
      return updated as ITaskEntity;
    });
  }

  async delete(id: string | number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db
        .update(task)
        .set({ isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(task.id, Number(id)));
    });
  }

  async findById(id: string | number, ctx: IDBConfigOptions): Promise<ITaskEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .select({ ...getTableColumns(task) })
        .from(task)
        .where(and(eq(task.id, Number(id)), eq(task.isDeleted, false)));
      return (row as ITaskEntity) || null;
    });
  }

  async findBySlug(slug: string, ctx: IDBConfigOptions): Promise<ITaskEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db
        .select({ ...getTableColumns(task) })
        .from(task)
        .where(and(eq(task.slug, slug), eq(task.isDeleted, false)));
      return (row as ITaskEntity) || null;
    });
  }

  async findChildren(parentId: number, ctx: IDBConfigOptions): Promise<ITaskEntity[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({ ...getTableColumns(task) })
        .from(task)
        .where(and(eq(task.parentId, parentId), eq(task.isDeleted, false)))
        .orderBy(asc(task.sortOrder));
      return rows as ITaskEntity[];
    });
  }

  async countByInitiative(initiativeId: number, ctx: IDBConfigOptions): Promise<ITaskSummary> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({ status: task.status, c: count() })
        .from(task)
        .where(and(eq(task.initiativeId, initiativeId), eq(task.isDeleted, false)))
        .groupBy(task.status);
      const byStatus = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
      let total = 0;
      for (const r of rows) {
        byStatus[r.status as TaskStatus] = Number(r.c);
        total += Number(r.c);
      }
      return { total, byStatus };
    });
  }

  async query(searchParams: IQueryTaskParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    const { title, initiativeId, parentId, priority, status, id, ids, slug, page = 1, pageSize = 50, isDeleted,
      sortOptions = [{ SortBy: 'sortOrder', sortOrder: 'asc' }, { SortBy: 'createdAt', sortOrder: 'desc' }] } = searchParams;

    const conditions: SQL[] = [eq(task.isDeleted, isDeleted ?? false)];
    if (id) conditions.push(eq(task.id, id));
    if (ids?.length) conditions.push(inArray(task.id, ids));
    if (slug) conditions.push(eq(task.slug, slug));
    if (title) conditions.push(ilike(task.title, `%${title}%`));
    if (initiativeId) conditions.push(eq(task.initiativeId, initiativeId));
    if (parentId) conditions.push(eq(task.parentId, parentId));
    if (priority) conditions.push(eq(task.priority, priority));
    if (status) conditions.push(eq(task.status, status));
    const where = and(...conditions);

    return runQuery(this.dbProvider, ctx, async (db) => {
      const columnMap: Record<string, PgColumn> = {
        id: task.id as unknown as PgColumn,
        title: task.title as unknown as PgColumn,
        sortOrder: task.sortOrder as unknown as PgColumn,
        createdAt: task.createdAt as unknown as PgColumn,
        updatedAt: task.updatedAt as unknown as PgColumn,
      };
      const order = sortOptions.map((o) => {
        const col = columnMap[o.SortBy] ?? columnMap.createdAt;
        return o.sortOrder === 'asc' ? asc(col) : desc(col);
      });
      const q = db.select({ ...getTableColumns(task) }).from(task).where(where).orderBy(...order).$dynamic();
      const data = await withPagination(q, page, pageSize);
      const total = await this.countAll(ctx, where);
      return {
        data: data as ITaskEntity[],
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        status_code: HttpStatus.OK,
        message: 'Task query successful',
        timestamp: new Date(),
        error: null,
      };
    });
  }

  async findAll(searchParams: IQueryTaskParams, ctx: IDBConfigOptions): Promise<ITaskEntity[]> {
    const res = await this.query(searchParams, ctx);
    return res.data as ITaskEntity[];
  }

  async queryAll(ctx: IDBConfigOptions): Promise<ITaskEntity[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({ ...getTableColumns(task) })
        .from(task)
        .where(eq(task.isDeleted, false))
        .orderBy(desc(task.createdAt));
      return rows as ITaskEntity[];
    });
  }

  async existByID(id: number, ctx: IDBConfigOptions): Promise<boolean> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [{ c }] = await db.select({ c: count() }).from(task).where(and(eq(task.id, id), eq(task.isDeleted, false)));
      return Number(c) > 0;
    });
  }

  async countAll(ctx: IDBConfigOptions, where?: SQL): Promise<number> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [{ c }] = await db.select({ c: count() }).from(task).where(where ?? eq(task.isDeleted, false));
      return Number(c);
    });
  }

  // --- assignees -----------------------------------------------------------
  async linkAssignee(taskId: number, personId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const existing = await db.select({ id: taskAssignee.id }).from(taskAssignee)
        .where(and(eq(taskAssignee.taskId, taskId), eq(taskAssignee.personId, personId), eq(taskAssignee.isDeleted, false)));
      if (existing.length > 0) return;
      await db.insert(taskAssignee).values({ taskId, personId });
    });
  }

  async unlinkAssignee(taskId: number, personId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db.update(taskAssignee)
        .set({ isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(and(eq(taskAssignee.taskId, taskId), eq(taskAssignee.personId, personId)));
    });
  }

  async findAssigneeIds(taskId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db.select({ personId: taskAssignee.personId }).from(taskAssignee)
        .where(and(eq(taskAssignee.taskId, taskId), eq(taskAssignee.isDeleted, false)));
      return rows.map((r) => r.personId);
    });
  }

  // --- labels --------------------------------------------------------------
  async addLabel(taskId: number, labelId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const existing = await db.select({ id: taskLabel.id }).from(taskLabel)
        .where(and(eq(taskLabel.taskId, taskId), eq(taskLabel.labelId, labelId), eq(taskLabel.isDeleted, false)));
      if (existing.length > 0) return;
      await db.insert(taskLabel).values({ taskId, labelId });
    });
  }

  async removeLabel(taskId: number, labelId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db.update(taskLabel)
        .set({ isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(and(eq(taskLabel.taskId, taskId), eq(taskLabel.labelId, labelId)));
    });
  }

  async findLabelIds(taskId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db.select({ labelId: taskLabel.labelId }).from(taskLabel)
        .where(and(eq(taskLabel.taskId, taskId), eq(taskLabel.isDeleted, false)));
      return rows.map((r) => r.labelId);
    });
  }
}
```

- [ ] **Step 7: Create `task.dto.ts`**

```ts
import { IsString, IsNumber, IsOptional, IsBoolean, IsArray, IsIn, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { INewTask, IUpdateTask, TaskPriority } from './task.interface';

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none'];

export class NewTaskDTO implements INewTask {
  @ApiProperty() @IsNumber() initiativeId!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() parentId?: number | null;
  @ApiProperty() @IsString() @MinLength(1) title!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string | null;
  @ApiProperty({ enum: PRIORITIES }) @IsIn(PRIORITIES) priority!: TaskPriority;
  @ApiProperty({ required: false }) @IsOptional() @IsString() startDate?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() targetDate?: string | null;
  @ApiProperty() @IsNumber() createdByPersonId!: number;
}

export class UpdateTaskDTO implements IUpdateTask {
  @ApiProperty() @IsNumber() id!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() initiativeId?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() parentId?: number | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string | null;
  @ApiProperty({ required: false, enum: PRIORITIES }) @IsOptional() @IsIn(PRIORITIES) priority?: TaskPriority;
  @ApiProperty({ required: false }) @IsOptional() @IsString() startDate?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() targetDate?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsString() completedAt?: string | null;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() sortOrder?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() @Type(() => Boolean) isActive?: boolean;
}

export class QueryTaskDTO {
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Type(() => Number) initiativeId?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Type(() => Number) parentId?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() priority?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() status?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Type(() => Number) page?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Type(() => Number) pageSize?: number;
}

export class FindTaskByIdDTO {
  @ApiProperty() @IsNumber() @Type(() => Number) id!: number;
}
export class FindTaskBySlugDTO {
  @ApiProperty() @IsString() slug!: string;
}
export class TaskAssigneeDTO {
  @ApiProperty() @IsNumber() personId!: number;
}
export class TaskLabelDTO {
  @ApiProperty() @IsNumber() labelId!: number;
}
```

- [ ] **Step 8: Run the repo test to verify it passes**

Run: `cd backend && yarn test src/modules/business-logic-modules/module-task/task.repo.spec.ts`
Expected: PASS (6 tests) — note the `sequenceId` increment test proves the DB sequence wired in Task 1 works.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/business-logic-modules/module-task/task.interface.ts \
        backend/src/modules/business-logic-modules/module-task/task.util.ts \
        backend/src/modules/business-logic-modules/module-task/task.dto.ts \
        backend/src/modules/business-logic-modules/module-task/task.repo.ts \
        backend/src/modules/business-logic-modules/module-task/task.repo.spec.ts \
        backend/src/utils/env.ts
git commit -m "feat(task): add Task repository, interfaces, DTOs, key helper + TASK_KEY_PREFIX env"
```

---

### Task 5: Task service + controller + module

**Files:**
- Create: `backend/src/modules/business-logic-modules/module-task/task.service.ts`
- Create: `.../module-task/task.service.spec.ts`
- Create: `.../module-task/task.controller.ts`
- Create: `.../module-task/task.module.ts`
- Modify: `backend/src/modules/main.module.ts`

**Interfaces:**
- Consumes: `TaskRepository` (Task 4); `AppAbility`, `assertAbility`, CASL `Task` (Task 2); `DbContextService`, `buildOk`/`buildCreated`, `buildTaskKey`.
- Produces: `TaskService` (`create`, `requireById`, `requireByIdAuthorized`, `requireBySlugAuthorized`, `update`, `remove`, `search`, `summary`, `assign/unassign/addLabel/removeLabel/listAssignees/listLabels`), `TaskModule` (exports `TaskRepository`, `TaskService`) — `TaskRepository` consumed by Task 8 (tracking controller resolves tasks by slug).

- [ ] **Step 1: Write the failing service test**

Create `backend/src/modules/business-logic-modules/module-task/task.service.spec.ts`:

```ts
import { TaskService } from './task.service';
import { defineAbilityFor } from 'src/common/casl/ability.factory';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';

const ctx = { database_uri: 'x', schema_id: 'public', user_id: 7 } as any;
const user = (over: Partial<IUserSession>): IUserSession =>
  ({ id: 7, slug: 's', email: 'e@x.com', role: 'member', departmentId: null, teamId: null, ...over });

describe('TaskService', () => {
  let repo: any;
  let service: TaskService;

  beforeEach(() => {
    repo = {
      create: jest.fn(async (i) => ({ id: 1, slug: 's1', sequenceId: 1, status: 'not_started', ...i })),
      findById: jest.fn(),
      update: jest.fn(async (id, p) => ({ id, ...p })),
      delete: jest.fn(),
      countByInitiative: jest.fn(async () => ({ total: 0, byStatus: {} })),
    };
    service = new TaskService(repo);
  });

  it('create delegates to repo', async () => {
    const out = await service.create({ initiativeId: 1, title: 'T', priority: 'none', createdByPersonId: 7 } as any, ctx);
    expect(out.id).toBe(1);
    expect(repo.create).toHaveBeenCalled();
  });

  it('update forbids a member editing a task they did not create', async () => {
    repo.findById.mockResolvedValue({ id: 1, createdByPersonId: 999, title: 'X' });
    const ability = defineAbilityFor(user({ id: 7, role: 'member' }));
    await expect(service.update(1, { title: 'Y' } as any, ctx, ability)).rejects.toBeDefined();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('update allows a member editing their own task', async () => {
    repo.findById.mockResolvedValue({ id: 1, createdByPersonId: 7, title: 'X' });
    const ability = defineAbilityFor(user({ id: 7, role: 'member' }));
    await service.update(1, { title: 'Y' } as any, ctx, ability);
    expect(repo.update).toHaveBeenCalledWith(1, { title: 'Y' }, ctx);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && yarn test src/modules/business-logic-modules/module-task/task.service.spec.ts`
Expected: FAIL — `Cannot find module './task.service'`.

- [ ] **Step 3: Create `task.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { AppAbility } from 'src/common/casl/ability.types';
import { assertAbility } from 'src/common/casl/assert-ability';
import { IBaseQueryResult } from 'src/utils/shared/interface';
import { TaskRepository } from './task.repo';
import { INewTask, IUpdateTask, ITaskEntity, IQueryTaskParams, ITaskSummary } from './task.interface';

@Injectable()
export class TaskService {
  constructor(private readonly repo: TaskRepository) {}

  async create(item: INewTask, ctx: IDBConfigOptions): Promise<ITaskEntity> {
    return this.repo.create(item, ctx);
  }

  async requireById(id: number, ctx: IDBConfigOptions): Promise<ITaskEntity> {
    const entity = await this.repo.findById(id, ctx);
    if (!entity) AppException.notFound('Task', id);
    return entity!;
  }

  async requireBySlug(slug: string, ctx: IDBConfigOptions): Promise<ITaskEntity> {
    const entity = await this.repo.findBySlug(slug, ctx);
    if (!entity) AppException.notFound('Task', slug);
    return entity!;
  }

  async requireByIdAuthorized(id: number, ctx: IDBConfigOptions, ability: AppAbility): Promise<ITaskEntity> {
    const entity = await this.requireById(id, ctx);
    assertAbility(ability, 'read', 'Task', entity, 'You cannot view this task');
    return entity;
  }

  async requireBySlugAuthorized(slug: string, ctx: IDBConfigOptions, ability: AppAbility): Promise<ITaskEntity> {
    const entity = await this.requireBySlug(slug, ctx);
    assertAbility(ability, 'read', 'Task', entity, 'You cannot view this task');
    return entity;
  }

  async update(id: number, payload: IUpdateTask, ctx: IDBConfigOptions, ability: AppAbility): Promise<ITaskEntity> {
    const existing = await this.requireById(id, ctx);
    assertAbility(ability, 'update', 'Task', existing, 'You cannot update this task');
    return this.repo.update(id, payload, ctx);
  }

  async remove(id: number, ctx: IDBConfigOptions, ability: AppAbility): Promise<void> {
    const existing = await this.requireById(id, ctx);
    assertAbility(ability, 'delete', 'Task', existing, 'You cannot delete this task');
    await this.repo.delete(id, ctx);
  }

  async search(params: IQueryTaskParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    return this.repo.query(params, ctx);
  }

  async summary(initiativeId: number, ctx: IDBConfigOptions): Promise<ITaskSummary> {
    return this.repo.countByInitiative(initiativeId, ctx);
  }

  async assign(taskId: number, personId: number, ctx: IDBConfigOptions): Promise<void> {
    return this.repo.linkAssignee(taskId, personId, ctx);
  }
  async unassign(taskId: number, personId: number, ctx: IDBConfigOptions): Promise<void> {
    return this.repo.unlinkAssignee(taskId, personId, ctx);
  }
  async listAssignees(taskId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return this.repo.findAssigneeIds(taskId, ctx);
  }
  async addLabel(taskId: number, labelId: number, ctx: IDBConfigOptions): Promise<void> {
    return this.repo.addLabel(taskId, labelId, ctx);
  }
  async removeLabel(taskId: number, labelId: number, ctx: IDBConfigOptions): Promise<void> {
    return this.repo.removeLabel(taskId, labelId, ctx);
  }
  async listLabels(taskId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return this.repo.findLabelIds(taskId, ctx);
  }
}
```

- [ ] **Step 4: Run the service test to verify it passes**

Run: `cd backend && yarn test src/modules/business-logic-modules/module-task/task.service.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Create `task.controller.ts`**

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TaskService } from './task.service';
import {
  NewTaskDTO, UpdateTaskDTO, QueryTaskDTO, FindTaskByIdDTO, FindTaskBySlugDTO, TaskAssigneeDTO, TaskLabelDTO,
} from './task.dto';
import { buildTaskKey } from './task.util';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { CheckPolicies } from 'src/common/casl/policy.types';
import { CurrentAbility } from 'src/common/casl/current-ability.decorator';
import { AppAbility } from 'src/common/casl/ability.types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('tasks')
@Controller('tasks')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly ctx: DbContextService,
  ) {}

  @Post()
  @CheckPolicies((a) => a.can('create', 'Task'))
  @ApiOperation({ summary: 'Create a task' })
  async create(@CurrentUser() user: IUserSession, @Body() dto: NewTaskDTO): Promise<IBaseResponse> {
    const created = await this.taskService.create(dto, this.ctx.forUser(user.id));
    return buildCreated({ ...created, key: buildTaskKey(created.sequenceId) }, 'Task created successfully');
  }

  @Post('search')
  @CheckPolicies((a) => a.can('read', 'Task'))
  @ApiOperation({ summary: 'Search tasks with filters' })
  async search(@CurrentUser() user: IUserSession, @Body() params: QueryTaskDTO): Promise<IBaseQueryResult> {
    return this.taskService.search(params as any, this.ctx.forUser(user.id));
  }

  @Get('summary')
  @CheckPolicies((a) => a.can('read', 'Task'))
  @ApiOperation({ summary: 'Task roll-up counts for an initiative' })
  async summary(@CurrentUser() user: IUserSession, @Query('initiativeId') initiativeId: string): Promise<IBaseResponse> {
    const data = await this.taskService.summary(Number(initiativeId), this.ctx.forUser(user.id));
    return buildOk(data, 'Task summary retrieved');
  }

  @Get('slug/:slug')
  @CheckPolicies((a) => a.can('read', 'Task'))
  @ApiOperation({ summary: 'Get a task by slug' })
  async getBySlug(@CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility, @Param() params: FindTaskBySlugDTO): Promise<IBaseResponse> {
    const result = await this.taskService.requireBySlugAuthorized(params.slug, this.ctx.forUser(user.id), ability);
    return buildOk({ ...result, key: buildTaskKey(result.sequenceId) }, 'Task found');
  }

  @Patch(':id')
  @CheckPolicies((a) => a.can('update', 'Task'))
  @ApiOperation({ summary: 'Update a task' })
  async update(@CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility, @Param() params: FindTaskByIdDTO, @Body() dto: UpdateTaskDTO): Promise<IBaseResponse> {
    const updated = await this.taskService.update(params.id, dto, this.ctx.forUser(user.id), ability);
    return buildOk(updated, 'Task updated successfully');
  }

  @Delete(':id')
  @CheckPolicies((a) => a.can('delete', 'Task'))
  @ApiOperation({ summary: 'Soft-delete a task' })
  async remove(@CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility, @Param() params: FindTaskByIdDTO): Promise<IBaseResponse> {
    await this.taskService.remove(params.id, this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Task deleted successfully');
  }

  // --- assignees + labels (resolve by slug, mutate join tables) ------------
  @Post(':slug/assignees')
  @CheckPolicies((a) => a.can('update', 'Task'))
  @ApiOperation({ summary: 'Assign a person to a task' })
  async assign(@CurrentUser() user: IUserSession, @Param('slug') slug: string, @Body() dto: TaskAssigneeDTO): Promise<IBaseResponse> {
    const t = await this.taskService.requireBySlug(slug, this.ctx.forUser(user.id));
    await this.taskService.assign(t.id, dto.personId, this.ctx.forUser(user.id));
    return buildOk(null, 'Assignee added');
  }

  @Delete(':slug/assignees/:personId')
  @CheckPolicies((a) => a.can('update', 'Task'))
  @ApiOperation({ summary: 'Unassign a person from a task' })
  async unassign(@CurrentUser() user: IUserSession, @Param('slug') slug: string, @Param('personId') personId: string): Promise<IBaseResponse> {
    const t = await this.taskService.requireBySlug(slug, this.ctx.forUser(user.id));
    await this.taskService.unassign(t.id, Number(personId), this.ctx.forUser(user.id));
    return buildOk(null, 'Assignee removed');
  }

  @Post(':slug/labels')
  @CheckPolicies((a) => a.can('update', 'Task'))
  @ApiOperation({ summary: 'Add a label to a task' })
  async addLabel(@CurrentUser() user: IUserSession, @Param('slug') slug: string, @Body() dto: TaskLabelDTO): Promise<IBaseResponse> {
    const t = await this.taskService.requireBySlug(slug, this.ctx.forUser(user.id));
    await this.taskService.addLabel(t.id, dto.labelId, this.ctx.forUser(user.id));
    return buildOk(null, 'Label added');
  }

  @Delete(':slug/labels/:labelId')
  @CheckPolicies((a) => a.can('update', 'Task'))
  @ApiOperation({ summary: 'Remove a label from a task' })
  async removeLabel(@CurrentUser() user: IUserSession, @Param('slug') slug: string, @Param('labelId') labelId: string): Promise<IBaseResponse> {
    const t = await this.taskService.requireBySlug(slug, this.ctx.forUser(user.id));
    await this.taskService.removeLabel(t.id, Number(labelId), this.ctx.forUser(user.id));
    return buildOk(null, 'Label removed');
  }

  @Get(':id')
  @CheckPolicies((a) => a.can('read', 'Task'))
  @ApiOperation({ summary: 'Get a task by ID' })
  async getById(@CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility, @Param() params: FindTaskByIdDTO): Promise<IBaseResponse> {
    const result = await this.taskService.requireByIdAuthorized(params.id, this.ctx.forUser(user.id), ability);
    return buildOk({ ...result, key: buildTaskKey(result.sequenceId) }, 'Task found');
  }
}
```

> Route order note: `search`, `summary`, and `slug/:slug` are declared **before** `:id` so the literal paths are not captured by the `:id` param route (mirrors `InitiativeController`, where `slug/:slug` precedes `:id`).

- [ ] **Step 6: Create `task.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskRepository } from './task.repo';
import { TaskService } from './task.service';

@Module({
  controllers: [TaskController],
  providers: [TaskRepository, TaskService],
  exports: [TaskRepository, TaskService],
})
export class TaskModule {}
```

- [ ] **Step 7: Register in `main.module.ts`**

Add the import and include `TaskModule` in the `imports` array of `backend/src/modules/main.module.ts`:

```ts
import { TaskModule } from './business-logic-modules/module-task/task.module';
```
(add `TaskModule,` to the `imports: [...]` list)

- [ ] **Step 8: Run tests + build**

Run: `cd backend && yarn test src/modules/business-logic-modules/module-task && yarn build`
Expected: PASS + clean build.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/business-logic-modules/module-task/ backend/src/modules/main.module.ts
git commit -m "feat(task): add Task service + controller (CRUD, assignees, labels, summary) + module wiring"
```

---

### Task 6: TaskState projection (repo + projector)

**Files:**
- Create: `backend/src/modules/business-logic-modules/module-tracking/projection/task-state.repo.ts`
- Create: `.../module-tracking/projection/task-state.projector.ts`
- Create: `.../module-tracking/projection/task-state.projector.spec.ts`

**Interfaces:**
- Consumes: `taskState` table (Task 1); `IActivityEventEntity`, `DbExecutor`, `runQuery`.
- Produces: `TaskStateRepository` (`findByTaskId`, `upsert(taskId, patch, ctx, executor?)`), `TaskStateProjector` (`apply(event, ctx, executor?)` — no-ops unless `event.subjectType === 'task'`) — consumed by Task 7/8.

- [ ] **Step 1: Write the failing projector test**

Create `backend/src/modules/business-logic-modules/module-tracking/projection/task-state.projector.spec.ts`:

```ts
import { TaskStateProjector } from './task-state.projector';

const ev = (over: any) => ({
  id: 1, slug: 's', occurredAt: '2026-06-28T00:00:00Z', recordedAt: null, actorPersonId: 1,
  subjectType: 'task', subjectId: 42, type: 'started', payload: {}, source: 'human',
  confidence: null, rawInputId: null, correlationId: null, ...over,
});

describe('TaskStateProjector', () => {
  let repo: any;
  let projector: TaskStateProjector;
  beforeEach(() => {
    repo = { upsert: jest.fn(), findByTaskId: jest.fn() };
    projector = new TaskStateProjector(repo);
  });

  it('ignores non-task events', async () => {
    await projector.apply(ev({ subjectType: 'initiative' }) as any, {} as any);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('started → status in_progress', async () => {
    await projector.apply(ev({ type: 'started' }) as any, {} as any);
    expect(repo.upsert).toHaveBeenCalledWith(42, expect.objectContaining({ status: 'in_progress' }), expect.anything(), undefined);
  });

  it('blocked → status blocked + blockedSince', async () => {
    await projector.apply(ev({ type: 'blocked', occurredAt: '2026-06-28T01:00:00Z' }) as any, {} as any);
    expect(repo.upsert).toHaveBeenCalledWith(42, expect.objectContaining({ status: 'blocked', blockedSince: '2026-06-28T01:00:00Z' }), expect.anything(), undefined);
  });

  it('time_logged → accumulates totalTimeLoggedMinutes', async () => {
    repo.findByTaskId.mockResolvedValue({ totalTimeLoggedMinutes: 30 });
    await projector.apply(ev({ type: 'time_logged', payload: { minutes: 15 } }) as any, {} as any);
    expect(repo.upsert).toHaveBeenCalledWith(42, expect.objectContaining({ totalTimeLoggedMinutes: 45 }), expect.anything(), undefined);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && yarn test src/modules/business-logic-modules/module-tracking/projection/task-state.projector.spec.ts`
Expected: FAIL — `Cannot find module './task-state.projector'`.

- [ ] **Step 3: Create `task-state.repo.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import ApplicationDBProvider, { DbExecutor } from 'src/infra/application-db/db-connection';
import { runQuery } from 'src/infra/application-db/query-runner';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { taskState } from 'src/infra/application-db/schema/task.schema';

export interface ITaskStateRow {
  taskId: number;
  status: string;
  totalTimeLoggedMinutes: number;
  blockedSince: string | null;
  lastEventAt: string | null;
}

type TaskStatePatch = Partial<{
  status: string;
  totalTimeLoggedMinutes: number;
  blockedSince: string | null;
  lastEventAt: string | null;
}>;

@Injectable()
export class TaskStateRepository {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async findByTaskId(taskId: number, ctx: IDBConfigOptions, executor?: DbExecutor): Promise<ITaskStateRow | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db.select().from(taskState).where(eq(taskState.taskId, taskId));
      return (rows[0] as ITaskStateRow) ?? null;
    }, executor);
  }

  async upsert(taskId: number, patch: TaskStatePatch, ctx: IDBConfigOptions, executor?: DbExecutor): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db
        .insert(taskState)
        .values({ taskId, ...(patch as object) })
        .onConflictDoUpdate({
          target: taskState.taskId,
          set: { ...(patch as object), updatedAt: new Date().toISOString() },
        });
    }, executor);
  }
}
```

- [ ] **Step 4: Create `task-state.projector.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { DbExecutor } from 'src/infra/application-db/db-connection';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { IActivityEventEntity } from '../tracking.interface';
import { TaskStateRepository } from './task-state.repo';

/**
 * Projects task activity events onto the task read model. `apply` runs inside
 * the same transaction that appends the event (invoked by TrackingService), so
 * the event log and this projection can never diverge. No-ops for any event
 * whose subjectType is not 'task'.
 */
@Injectable()
export class TaskStateProjector {
  constructor(private readonly repo: TaskStateRepository) {}

  async apply(event: IActivityEventEntity, ctx: IDBConfigOptions, executor?: DbExecutor): Promise<void> {
    if (event.subjectType !== 'task') return;

    const baseFields = { lastEventAt: event.occurredAt };

    switch (event.type) {
      case 'started':
        await this.repo.upsert(event.subjectId, { status: 'in_progress', ...baseFields }, ctx, executor);
        break;
      case 'resumed':
      case 'unblocked':
        await this.repo.upsert(event.subjectId, { status: 'in_progress', blockedSince: null, ...baseFields }, ctx, executor);
        break;
      case 'paused':
        await this.repo.upsert(event.subjectId, { status: 'paused', ...baseFields }, ctx, executor);
        break;
      case 'blocked':
        await this.repo.upsert(event.subjectId, { status: 'blocked', blockedSince: event.occurredAt, ...baseFields }, ctx, executor);
        break;
      case 'completed':
        await this.repo.upsert(event.subjectId, { status: 'completed', ...baseFields }, ctx, executor);
        break;
      case 'cancelled':
        await this.repo.upsert(event.subjectId, { status: 'cancelled', ...baseFields }, ctx, executor);
        break;
      case 'time_logged': {
        const current = await this.repo.findByTaskId(event.subjectId, ctx, executor);
        const existing = current?.totalTimeLoggedMinutes ?? 0;
        const added = Number(event.payload?.minutes ?? 0);
        await this.repo.upsert(event.subjectId, { totalTimeLoggedMinutes: existing + added, ...baseFields }, ctx, executor);
        break;
      }
      default:
        // created / reason_recorded / outcome_recorded / note_added — only touch lastEventAt
        await this.repo.upsert(event.subjectId, { ...baseFields }, ctx, executor);
        break;
    }
  }
}
```

- [ ] **Step 5: Run the projector test to verify it passes**

Run: `cd backend && yarn test src/modules/business-logic-modules/module-tracking/projection/task-state.projector.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/business-logic-modules/module-tracking/projection/task-state.repo.ts \
        backend/src/modules/business-logic-modules/module-tracking/projection/task-state.projector.ts \
        backend/src/modules/business-logic-modules/module-tracking/projection/task-state.projector.spec.ts
git commit -m "feat(tracking): add TaskStateProjector + repo (task read-model projection)"
```

---

### Task 7: TrackingService task lifecycle + projector dispatch

**Files:**
- Modify: `backend/src/modules/business-logic-modules/module-tracking/tracking.interface.ts:19`
- Modify: `.../module-tracking/activity-event.repo.ts:48`
- Modify: `.../module-tracking/tracking.service.ts`
- Modify: `.../module-tracking/tracking.service.spec.ts`

**Interfaces:**
- Consumes: `TaskStateProjector` (Task 6); existing `ActivityEventRepository`, `InitiativeStateProjector`, `withTenantTransaction`.
- Produces: `TrackingService.startTask/pauseTask/resumeTask/blockTask/unblockTask/completeTask/cancelTask(taskId, actorId, ctx, payload?)` and `logTaskTime(taskId, actorId, minutes, ctx)` — all returning `IActivityEventEntity`. Consumed by Task 8.

- [ ] **Step 1: Widen the `subjectType` unions**

In `backend/src/modules/business-logic-modules/module-tracking/tracking.interface.ts`, change the `IActivityEventInput.subjectType` field (line 19):

```ts
  subjectType: 'initiative' | 'key_result' | 'objective' | 'task';
```

In `backend/src/modules/business-logic-modules/module-tracking/activity-event.repo.ts`, change the `listBySubject` parameter type (line 48):

```ts
    subjectType: 'initiative' | 'key_result' | 'objective' | 'task',
```

- [ ] **Step 2: Write the failing service test**

Append to `backend/src/modules/business-logic-modules/module-tracking/tracking.service.spec.ts` a block that drives a task lifecycle. Match the existing harness in that file for constructing `TrackingService` (same mocked `ActivityEventRepository`, `EventEmitter2`, `KeyResultMeasurementRepository`, `KeyResultRepository`, `ApplicationDBProvider`, `InitiativeStateProjector`), and add the new `TaskStateProjector` mock to the constructor:

```ts
describe('task lifecycle', () => {
  it('startTask appends a task-subject "started" event and projects task state', async () => {
    // Arrange: withTenantTransaction invokes its callback with a fake tx executor;
    // activityEvents.append returns an event echoing the input; both projectors are spies.
    const appended: any[] = [];
    const activityEvents = { append: jest.fn(async (input: any) => { const e = { id: 1, occurredAt: '2026-06-28T00:00:00Z', ...input }; appended.push(e); return e; }) };
    const initiativeProjector = { apply: jest.fn() };
    const taskProjector = { apply: jest.fn() };
    const dbProvider = { withTenantTransaction: jest.fn(async (_ctx: any, work: any) => work({} as any)) };
    const emitter = { emit: jest.fn() };
    const service = new (require('./tracking.service').TrackingService)(
      activityEvents, emitter, { add: jest.fn() }, { updateCurrentValue: jest.fn() }, dbProvider, initiativeProjector, taskProjector,
    );

    const event = await service.startTask(42, 7, { database_uri: 'x', schema_id: 'public', user_id: 7 } as any);

    expect(activityEvents.append).toHaveBeenCalledWith(expect.objectContaining({ subjectType: 'task', subjectId: 42, type: 'started', actorPersonId: 7 }), expect.anything(), expect.anything());
    expect(taskProjector.apply).toHaveBeenCalled();
    expect(event.subjectType).toBe('task');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd backend && yarn test src/modules/business-logic-modules/module-tracking/tracking.service.spec.ts -t "task lifecycle"`
Expected: FAIL — `service.startTask is not a function` / constructor arity mismatch (no `taskProjector`).

- [ ] **Step 4: Inject `TaskStateProjector` and apply both projectors**

In `backend/src/modules/business-logic-modules/module-tracking/tracking.service.ts`:

Add the import:

```ts
import { TaskStateProjector } from './projection/task-state.projector';
```

Add the constructor parameter (after the existing `projector: InitiativeStateProjector`):

```ts
    private readonly taskProjector: TaskStateProjector,
```

Change `appendAndProject` so both projectors run on the same transaction (each no-ops on a non-matching subjectType):

```ts
  private async appendAndProject(
    tx: DbExecutor,
    input: IActivityEventInput,
    ctx: IDBConfigOptions,
  ): Promise<IActivityEventEntity> {
    const event = await this.activityEvents.append(input, ctx, tx);
    await this.projector.apply(event, ctx, tx);
    await this.taskProjector.apply(event, ctx, tx);
    return event;
  }
```

- [ ] **Step 5: Extract `emitLifecycle` and add task methods**

Still in `tracking.service.ts`, add a private generic emitter (place it next to `emit`):

```ts
  /** Emit a lifecycle event for any subject type and project it. */
  private async emitLifecycle(
    subjectType: 'initiative' | 'task',
    subjectId: number,
    type: IActivityEventInput['type'],
    actorId: number,
    ctx: IDBConfigOptions,
    payload?: Record<string, unknown>,
  ): Promise<IActivityEventEntity> {
    return this.emit({ subjectType, subjectId, type, actorPersonId: actorId, payload }, ctx);
  }
```

Add the public task methods (place them after the initiative lifecycle methods):

```ts
  async startTask(taskId: number, actorId: number, ctx: IDBConfigOptions, payload?: Record<string, unknown>) {
    return this.emitLifecycle('task', taskId, 'started', actorId, ctx, payload);
  }
  async pauseTask(taskId: number, actorId: number, ctx: IDBConfigOptions, payload?: Record<string, unknown>) {
    return this.emitLifecycle('task', taskId, 'paused', actorId, ctx, payload);
  }
  async resumeTask(taskId: number, actorId: number, ctx: IDBConfigOptions, payload?: Record<string, unknown>) {
    return this.emitLifecycle('task', taskId, 'resumed', actorId, ctx, payload);
  }
  async blockTask(taskId: number, actorId: number, ctx: IDBConfigOptions, payload?: Record<string, unknown>) {
    return this.emitLifecycle('task', taskId, 'blocked', actorId, ctx, payload);
  }
  async unblockTask(taskId: number, actorId: number, ctx: IDBConfigOptions, payload?: Record<string, unknown>) {
    return this.emitLifecycle('task', taskId, 'unblocked', actorId, ctx, payload);
  }
  async completeTask(taskId: number, actorId: number, ctx: IDBConfigOptions, payload?: Record<string, unknown>) {
    return this.emitLifecycle('task', taskId, 'completed', actorId, ctx, payload);
  }
  async cancelTask(taskId: number, actorId: number, ctx: IDBConfigOptions, payload?: Record<string, unknown>) {
    return this.emitLifecycle('task', taskId, 'cancelled', actorId, ctx, payload);
  }
  async logTaskTime(taskId: number, actorId: number, minutes: number, ctx: IDBConfigOptions) {
    return this.emitLifecycle('task', taskId, 'time_logged', actorId, ctx, { minutes });
  }
```

- [ ] **Step 6: Run the service test to verify it passes**

Run: `cd backend && yarn test src/modules/business-logic-modules/module-tracking/tracking.service.spec.ts`
Expected: PASS — the new task-lifecycle case plus all existing initiative cases (unchanged behavior; `taskProjector.apply` no-ops on initiative events).

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/business-logic-modules/module-tracking/tracking.interface.ts \
        backend/src/modules/business-logic-modules/module-tracking/activity-event.repo.ts \
        backend/src/modules/business-logic-modules/module-tracking/tracking.service.ts \
        backend/src/modules/business-logic-modules/module-tracking/tracking.service.spec.ts
git commit -m "feat(tracking): task lifecycle methods + dual-projector dispatch (event-sourced task state)"
```

---

### Task 8: Tracking controller task endpoints + module wiring

**Files:**
- Modify: `backend/src/modules/business-logic-modules/module-tracking/tracking.module.ts`
- Modify: `.../module-tracking/tracking.controller.ts`
- Create/Modify: `.../module-tracking/tracking.integration.spec.ts` (add a task case)

**Interfaces:**
- Consumes: `TaskRepository` (Task 5, via `TaskModule`), `TaskStateProjector`/`TaskStateRepository` (Task 6), `TrackingService` task methods (Task 7).
- Produces: REST endpoints `POST /tracking/tasks/:slug/{start|pause|resume|block|unblock|complete|cancel|time}` and `GET /tracking/tasks/:slug/timeline`.

- [ ] **Step 1: Wire providers + TaskModule into `tracking.module.ts`**

Update `backend/src/modules/business-logic-modules/module-tracking/tracking.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { InitiativeModule } from '../module-initiative/initiative.module';
import { KeyResultModule } from '../module-key-result/key-result.module';
import { TaskModule } from '../module-task/task.module';
import { ActivityEventRepository } from './activity-event.repo';
import { InitiativeStateRepository } from './projection/initiative-state.repo';
import { InitiativeStateProjector } from './projection/initiative-state.projector';
import { TaskStateRepository } from './projection/task-state.repo';
import { TaskStateProjector } from './projection/task-state.projector';
import { KeyResultMeasurementRepository } from './projection/key-result-measurement.repo';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';

@Module({
  imports: [InitiativeModule, KeyResultModule, TaskModule],
  controllers: [TrackingController],
  providers: [
    ActivityEventRepository,
    InitiativeStateRepository,
    InitiativeStateProjector,
    TaskStateRepository,
    TaskStateProjector,
    KeyResultMeasurementRepository,
    TrackingService,
  ],
  exports: [
    ActivityEventRepository,
    InitiativeStateRepository,
    TaskStateRepository,
    KeyResultMeasurementRepository,
    TrackingService,
  ],
})
export class TrackingModule {}
```

- [ ] **Step 2: Add task lifecycle endpoints to `tracking.controller.ts`**

Add `TaskRepository` to the constructor injection:

```ts
import { TaskRepository } from '../module-task/task.repo';
```
```ts
    private readonly taskRepo: TaskRepository,
```

Add a resolver helper (next to `resolveInitiative`):

```ts
  private async resolveTask(slug: string, ctx: ReturnType<DbContextService['forUser']>) {
    const t = await this.taskRepo.findBySlug(slug, ctx);
    if (!t) AppException.notFound('Task', slug);
    return t!;
  }
```

Add the endpoints (new section in the controller):

```ts
  // -------------------------------------------------------------------------
  // Task lifecycle
  // -------------------------------------------------------------------------

  @Post('tasks/:slug/start')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Start a task' })
  async startTask(@CurrentUser() user: IUserSession, @Param('slug') slug: string, @Body() dto: LifecyclePayloadDTO): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const event = await this.trackingService.startTask(t.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Task started');
  }

  @Post('tasks/:slug/pause')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Pause a task' })
  async pauseTask(@CurrentUser() user: IUserSession, @Param('slug') slug: string, @Body() dto: LifecyclePayloadDTO): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const event = await this.trackingService.pauseTask(t.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Task paused');
  }

  @Post('tasks/:slug/resume')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Resume a task' })
  async resumeTask(@CurrentUser() user: IUserSession, @Param('slug') slug: string, @Body() dto: LifecyclePayloadDTO): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const event = await this.trackingService.resumeTask(t.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Task resumed');
  }

  @Post('tasks/:slug/block')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Block a task' })
  async blockTask(@CurrentUser() user: IUserSession, @Param('slug') slug: string, @Body() dto: LifecyclePayloadDTO): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const event = await this.trackingService.blockTask(t.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Task blocked');
  }

  @Post('tasks/:slug/unblock')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Unblock a task' })
  async unblockTask(@CurrentUser() user: IUserSession, @Param('slug') slug: string, @Body() dto: LifecyclePayloadDTO): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const event = await this.trackingService.unblockTask(t.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Task unblocked');
  }

  @Post('tasks/:slug/complete')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Complete a task' })
  async completeTask(@CurrentUser() user: IUserSession, @Param('slug') slug: string, @Body() dto: LifecyclePayloadDTO): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const event = await this.trackingService.completeTask(t.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Task completed');
  }

  @Post('tasks/:slug/cancel')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Cancel a task' })
  async cancelTask(@CurrentUser() user: IUserSession, @Param('slug') slug: string, @Body() dto: LifecyclePayloadDTO): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const event = await this.trackingService.cancelTask(t.id, user.id, tenancy, dto.payload);
    return buildOk(event, 'Task cancelled');
  }

  @Post('tasks/:slug/time')
  @CheckPolicies((a) => a.can('create', 'ActivityEvent'))
  @ApiOperation({ summary: 'Log time on a task' })
  async logTaskTime(@CurrentUser() user: IUserSession, @Param('slug') slug: string, @Body() dto: LogTimeDTO): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const event = await this.trackingService.logTaskTime(t.id, user.id, dto.minutes, tenancy);
    return buildOk(event, 'Time logged');
  }

  @Get('tasks/:slug/timeline')
  @CheckPolicies((a) => a.can('read', 'ActivityEvent'))
  @ApiOperation({ summary: 'Get activity timeline for a task' })
  async getTaskTimeline(@CurrentUser() user: IUserSession, @Param('slug') slug: string): Promise<IBaseResponse> {
    const tenancy = this.ctx.forUser(user.id);
    const t = await this.resolveTask(slug, tenancy);
    const events = await this.activityEventRepo.listBySubject('task', t.id, tenancy);
    return buildOk(events, 'Timeline retrieved');
  }
```

- [ ] **Step 3: Add a real-DB integration test for task lifecycle**

Add a case to `backend/src/modules/business-logic-modules/module-tracking/tracking.integration.spec.ts` mirroring its existing initiative flow (it uses `useTestSchema()` + constructs the service with real repos/projectors). Create a task via `TaskRepository`, drive a lifecycle event via `TrackingService.startTask`, then assert the projection:

```ts
it('startTask appends event and projects task_state = in_progress', async () => {
  const ctx = getCtx();
  // taskRepo + trackingService are built in this suite's setup (mirror the
  // initiative wiring already present, adding TaskStateRepository/TaskStateProjector).
  const created = await taskRepo.create(
    { initiativeId: 1, title: 'Integration Task', priority: 'none', createdByPersonId: 1 },
    ctx,
  );
  const event = await trackingService.startTask(created.id, 1, ctx);
  expect(event.subjectType).toBe('task');

  const state = await taskStateRepo.findByTaskId(created.id, ctx);
  expect(state?.status).toBe('in_progress');
  expect(state?.lastEventAt).toBe(event.occurredAt);
});
```

> Setup note: extend this suite's `beforeAll`/factory wiring to instantiate `TaskRepository`, `TaskStateRepository`, `TaskStateProjector`, and pass the task projector as the 7th `TrackingService` constructor argument — matching the order defined in Task 7 Step 4.

- [ ] **Step 4: Run the integration spec + full suite**

Run: `cd backend && yarn test src/modules/business-logic-modules/module-tracking`
Expected: PASS — initiative + task tracking integration green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/business-logic-modules/module-tracking/tracking.module.ts \
        backend/src/modules/business-logic-modules/module-tracking/tracking.controller.ts \
        backend/src/modules/business-logic-modules/module-tracking/tracking.integration.spec.ts
git commit -m "feat(tracking): expose task lifecycle endpoints + wire TaskModule/TaskStateProjector"
```

---

### Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `cd backend && yarn test`
Expected: PASS — all prior specs + every new spec (schema, casl, label repo, task repo, task service, task-state projector, tracking task lifecycle/integration).

- [ ] **Step 2: Type-check / build**

Run: `cd backend && yarn build`
Expected: clean `nest build` (no TS errors). Confirms `TaskModule` + `LabelModule` resolve in the Nest dependency graph and `TrackingController` injects `TaskRepository`.

- [ ] **Step 3: Lint**

Run: `cd backend && yarn lint`
Expected: no errors (auto-fixes applied).

- [ ] **Step 4: Smoke-check the API surface (optional, manual)**

Run: `cd backend && yarn start:dev`, open Swagger at `http://localhost:9100/` (or configured docs path), and confirm the new tags appear: `tasks`, `labels`, and the `tracking` task endpoints (`POST /tracking/tasks/{slug}/start`, etc.). Create a task → start it → `GET /tracking/tasks/{slug}/timeline` shows the `started` event; `GET /tasks/{id}` shows `key: "TASK-1"`.

- [ ] **Step 5: Commit (if Step 3 auto-fixed anything)**

```bash
git add -A
git commit -m "chore(task): lint + final verification for task-tracking core"
```

---

## Self-Review (author's pass)

**Spec coverage:** §4 schema → Task 1. §4.4 enum → Task 1. §5 event-sourcing → Tasks 6–8. §6 logic flows (CRUD/assign/label/lifecycle/sub-tasks/roll-up) → Tasks 4 (repo), 5 (service/controller/summary), 7 (lifecycle). §7 human IDs → Task 1 (sequence) + Task 4 (`buildTaskKey`). §8 authz → Task 2. §10 module structure → Tasks 3, 5, 6, 8. All spec sections map to a task.

**Deferred (per spec §9), intentionally absent:** comments, attachments, links, relations, subscribers, cycles, estimates, task types, views, AI intake. Not in this plan by design.

**Type consistency:** `ITaskEntity`/`INewTask`/`IUpdateTask`/`IQueryTaskParams`/`ITaskSummary`, `TaskStatus`, `TaskPriority` defined in Task 4 and consumed unchanged in Tasks 5/8. `TrackingService` constructor arg order (…, `InitiativeStateProjector`, `TaskStateProjector`) is fixed in Task 7 Step 4 and relied on by the test wiring in Tasks 7/8. `TaskRepository` method names (`linkAssignee`/`findAssigneeIds`/`addLabel`/`findLabelIds`/`countByInitiative`/`findChildren`) are identical across Tasks 4, 5, 8.

**Open questions carried from spec §11 (resolve during execution):** (A1) `initiativeId` NOT NULL — assumed; revisit if a backlog of un-laddered tasks is needed. Roll-up endpoint chosen as `GET /tasks/summary?initiativeId=`. No `created` event emitted on task creation (matches initiatives).
