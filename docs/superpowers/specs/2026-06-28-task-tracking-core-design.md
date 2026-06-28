# Task Tracking (Core) — Design Spec

**Status:** Approved (design) · **Date:** 2026-06-28 · **Branch:** `feat-task-management`
**Related:** [OKR/AI System Design](2026-06-27-cybernetic-okr-ai-system-design.md) · reference: [Plane models](https://github.com/makeplane/plane/tree/preview/apps/api/plane/db/models)

## 1. Context & Goal

Cybernetic models work as `objective → key_result → initiative`, where the **Initiative** is a coarse, OKR-aligned work item with a single `ownerPersonId`, a free-text `priority`, and a status **derived from an append-only `activity_event` log** via the `InitiativeStateProjector` (the AI-efficiency substrate).

It lacks the granular task-tracking layer that mature trackers (Plane) provide: sub-tasks, multiple assignees, labels, workflow priority, manual ordering, and human-readable IDs.

**Goal:** introduce a granular **Task** layer *beneath* Initiative — the Plane *Issue* analog — bringing Plane-grade structure while **preserving Cybernetic's event-sourced lifecycle** and OKR laddering. This is **v1 (Core)**; collaboration/planning features are deferred (§9).

## 2. Decisions

Settled with the user (2026-06-28):

| # | Decision | Choice |
|---|----------|--------|
| D1 | Task ↔ Initiative relationship | **New `task` layer under Initiative.** Initiative stays the OKR bucket (≈ Plane *Module*); Task is the Plane *Issue*. Task → Initiative → KR → Objective. |
| D2 | v1 scope | **Core only** — task + sub-tasks + priority enum + multi-assignee + labels + event-sourced lifecycle + roll-up + authz. |
| D3 | Lifecycle/state model | **Keep event-sourced** (enum-derived). Lifecycle flows through `activity_event` → projection. No mutable per-deployment state table in v1. |
| D4 | Human-readable IDs | **Org-wide sequence** → `TASK-123`. |

Defaults baked into this spec (vetoable):

| # | Default | Rationale |
|---|---------|-----------|
| A1 | `task.initiativeId` is **NOT NULL** | Enforce that all work ladders to an OKR outcome. (Alternative: nullable "backlog".) |
| A2 | **Reuse** the existing `initiativeStatus` pg enum for task status | Tasks share the exact lifecycle; reuse keeps the projector logic and semantics identical. May be generalized to `work_status` later. |
| A3 | Assignee/label changes are **plain CRUD** in v1 (not events) | Lifecycle stays the event-sourced part; structural edits don't need the substrate yet. |
| A4 | Roll-up is a **read-side aggregate** (count by status) | No auto-mutation of initiative status (brittle). Wires into `okr-tree` later. |
| A5 | ID prefix from `env.TASK_KEY_PREFIX` (default `"TASK"`) | Single-tenant; configurable per deployment. |

## 3. Why this shape (vs alternatives)

- **Enrich Initiative (rejected):** conflates strategic work with granular tickets and pollutes the `alignment_link`/`okr-tree` with task-level nodes.
- **Full parallel Plane subsystem (rejected):** ~15+ tables; duplicates the existing `organization/department/team/person` identity layer with Workspace/Project/Member; builds a generic PM SaaS rather than the AI-efficiency engine. Violates YAGNI.
- **Task layer (chosen):** additive; keeps the OKR tree at altitude; yields finer-grained event signal (better substrate); reuses the event pipeline untouched.

**Plane's `IssueActivity` is a dumb audit trail; Cybernetic's `activity_event` is a true event-sourced log.** We borrow Plane's *structure* (hierarchy, labels, assignees, priority, ordering, IDs) and keep Cybernetic's *superior lifecycle mechanics*.

## 4. Schema

All tables follow house conventions: `defaultFields` (serial `id` + uuid `slug` + tz timestamps + `isDeleted`/`isActive`), soft-delete, `pgTable(name, cols, (t) => [indexes])`. New file `task.schema.ts`; one additive change to `tracking.schema.ts`.

### 4.1 New enum + `task`

```ts
// task.schema.ts
import { doublePrecision, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { defaultFields } from './common.schema';
import { initiativeStatus } from './okr.schema';   // reused (A2)

export const taskPriority = pgEnum('task_priority', ['urgent', 'high', 'medium', 'low', 'none']);

export const task = pgTable(
  'task',
  {
    initiativeId: integer('initiative_id').notNull(),          // D1/A1 — ladders to OKR
    parentId: integer('parent_id'),                             // self-FK → sub-tasks
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    priority: taskPriority('priority').notNull().default('none'),
    startDate: timestamp('start_date', { withTimezone: true, mode: 'string' }),
    targetDate: timestamp('target_date', { withTimezone: true, mode: 'string' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
    sortOrder: doublePrecision('sort_order').notNull().default(65535),
    sequenceId: integer('sequence_id'),                         // D4 — set by DB default nextval (§7)
    createdByPersonId: integer('created_by_person_id').notNull(),
    // Denormalized cache; authoritative status is task_state (projection).
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
```

### 4.2 `task_assignee`, `label`, `task_label`

```ts
export const taskAssignee = pgTable(
  'task_assignee',
  { taskId: integer('task_id').notNull(), personId: integer('person_id').notNull(), ...defaultFields },
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
    parentId: integer('parent_id'),                 // self-FK → hierarchy
    sortOrder: doublePrecision('sort_order').notNull().default(65535),
    ...defaultFields,
  },
  (t) => [index('label_name_index').on(t.name), index('label_parent_index').on(t.parentId)],
);

export const taskLabel = pgTable(
  'task_label',
  { taskId: integer('task_id').notNull(), labelId: integer('label_id').notNull(), ...defaultFields },
  (t) => [
    index('task_label_task_index').on(t.taskId),
    index('task_label_label_index').on(t.labelId),
  ],
);
```

Dedup on the join tables follows the existing `initiativeKeyResult` pattern (check-before-insert on `isDeleted=false`), not a DB unique constraint (soft-delete makes a plain unique impractical).

### 4.3 `task_state` (projection — structural twin of `initiative_state`)

```ts
export const taskState = pgTable(
  'task_state',
  {
    taskId: integer('task_id').notNull(),
    status: initiativeStatus('status').notNull().default('not_started'),
    totalTimeLoggedMinutes: integer('total_time_logged_minutes').notNull().default(0),
    blockedSince: timestamp('blocked_since', { withTimezone: true, mode: 'string' }),
    lastEventAt: timestamp('last_event_at', { withTimezone: true, mode: 'string' }),
    ...defaultFields,
  },
  (t) => [uniqueIndex('task_state_task_id_index').on(t.taskId)],
);
```

### 4.4 One change to existing schema (additive)

`tracking.schema.ts` — extend `subjectType`:

```ts
export const subjectType = pgEnum('subject_type', ['initiative', 'key_result', 'objective', 'task']);
```

Nothing else in `okr.schema`, identity, or `activityEventType` changes — the existing event verbs (`started/paused/resumed/blocked/unblocked/completed/cancelled/time_logged/...`) already cover task lifecycle.

## 5. Event-sourcing integration

Tasks reuse the exact pipeline initiatives use:

1. **`tracking.interface.ts`** — add `'task'` to the `IActivityEventInput.subjectType` union and to `listBySubject`'s param type.
2. **`TrackingService`** — generalize the lifecycle emit. Extract a private `emitLifecycle(subjectType, subjectId, type, actorId, ctx, payload)`; existing initiative methods delegate with `'initiative'`; new public task methods (`startTask`, `pauseTask`, `resumeTask`, `blockTask`, `unblockTask`, `completeTask`, `cancelTask`, `logTaskTime`) delegate with `'task'`.
3. **`appendAndProject`** — inject `TaskStateProjector` alongside `InitiativeStateProjector` and apply both in the same transaction; each projector guards on its `subjectType` and no-ops otherwise (mirrors today's `if (event.subjectType !== 'initiative') return;`).
4. **`TaskStateProjector`** — a copy of `InitiativeStateProjector` keyed on `subjectType === 'task'`, upserting `task_state` (same status/time/blockedSince/lastEventAt mapping).

Atomicity is preserved exactly: event append + projection commit on one `withTenantTransaction` connection.

## 6. Logic flows

- **Create / edit** → `TaskRepository.create/update` (DB assigns `sequenceId` via default `nextval`, §7). Optionally emit a `created` event (kept out of v1 critical path; can be added like initiatives).
- **Assign / label** → CRUD on `task_assignee` / `task_label` (check-before-insert dedup; soft-delete on remove). (A3)
- **Lifecycle** → `POST /tracking/tasks/:slug/{start|pause|resume|block|unblock|complete|cancel|time}` → `TrackingService` task method → event + `task_state` projection.
- **Sub-tasks** → `parentId` self-reference; a `findChildren(taskId)` repo method; cycle-guard if depth traversal is ever added (mirror `okr-tree`'s visited-set).
- **Roll-up (A4)** → `TaskRepository.countByInitiative(initiativeId)` returns `{ total, by_status: {...} }`; exposed as `GET /tasks/summary?initiativeId=` (or `GET /initiatives/:slug/task-summary`). Read-only; no initiative mutation.

## 7. Human-readable IDs (org-wide)

- Migration creates a Postgres sequence in the company schema: `CREATE SEQUENCE IF NOT EXISTS task_sequence_seq;` and sets the column default: `ALTER TABLE "task" ALTER COLUMN "sequence_id" SET DEFAULT nextval('task_sequence_seq');`
- `INSERT` omits `sequence_id`; the DB assigns it; `.returning()` yields the value. Gap-tolerant and concurrency-safe.
- Display key = `${env.TASK_KEY_PREFIX}-${sequenceId}` (A5), composed in the response mapper/DTO, not stored.

## 8. Authorization (CASL)

Per [[cybernetic-authz-role-matrix]]:

- `ability.types.ts` — add `'Task'` and `'Label'` to `AppSubjectName`.
- `ability.factory.ts`:
  - **admin** — `manage all` (unchanged).
  - **executive** — `read all` only; **no task writes** (settled "viewer" role).
  - **manager** — `can('manage', 'Task')`, `can('manage', 'Label')`, plus existing `create ActivityEvent {actorPersonId}`.
  - **member** — `can('manage', 'Task', { createdByPersonId: user.id })`, `can('read', 'Task')`, `can('read', 'Label')`, plus existing `create ActivityEvent {actorPersonId}` (assignees drive lifecycle via tracking).
- Controllers use `@CheckPolicies`; row-level checks via `assertAbility` mirror `InitiativeService.requireByIdAuthorized`.

## 9. Out of scope (deferred, not dropped)

- **Phase B (collaboration):** `task_comment` (threaded), `task_attachment`, `task_link`, `task_relation` (`duplicate/relates_to/blocked_by/...`), `task_subscriber`.
- **Phase C (planning):** `cycle` + `cycle_task` (gives `objective.period` real dates), `estimate`/`estimate_point`, `task_type` (bug/story/epic), saved `task_view`.
- **Phase D (AI intake):** wire `raw_input`/Mastra (Phase 2) to create tasks — Plane's *Intake*, done event-sourced.
- **Never:** deploy boards, public members, votes/reactions, themes, a separate Module table (Initiative fills that role).

## 10. Scope of change (honest sizing)

- **New:** `task.schema.ts` (5 tables + 1 enum), `module-task/` (controller/service/repo/dto/interface + projection: `task-state.repo.ts`, `task-state.projector.ts`), `module-label/` (repo/controller/dto/interface), one drizzle migration (+ hand-added sequence SQL), `env.TASK_KEY_PREFIX`.
- **Modified (additive):** `subject_type` enum (+`'task'`), `tracking.interface.ts` (union), `TrackingService` (task methods + 2nd projector), `tracking.module.ts` (providers/imports), `activity-event.repo.ts` (`listBySubject` type), `ability.types.ts` + `ability.factory.ts` (Task/Label), `schema/index.ts` (export `task.schema`), `app.module.ts` (register modules).
- **Untouched:** `objective`, `key_result`, `alignment`, `intervention`, identity tables, and the entire event-sourcing pipeline (reused, not changed).

**Net: ~5 tables, 1 enum value, 2 modules, 1 projector, ~4 CASL lines, 1 migration. Additive — zero rearchitecture.**

## 11. Open questions

- A1: confirm `initiativeId` NOT NULL (vs nullable backlog).
- §6: roll-up endpoint location (`/tasks/summary` vs `/initiatives/:slug/task-summary`).
- §5: emit a `created` event on task creation in v1, or defer? (Initiatives currently do not auto-emit on create.)
