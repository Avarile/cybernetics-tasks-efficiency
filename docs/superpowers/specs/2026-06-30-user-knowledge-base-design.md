# User Profile Expansion + Per-User Knowledge Base — Design Spec

- **Date:** 2026-06-30
- **Status:** Draft (awaiting user review → implementation plan)
- **Related:** [[cybernetic-project-overview]]; [[cybernetic-convention-reference]]; [[cybernetic-authz-role-matrix]]; [[cybernetic-task-tracking]]; file-management spec `2026-06-29-file-management-design.md`

## 1. Summary

Two deliverables for the Cybernetic backend (NestJS 10 + Drizzle + CASL):

1. **Person profile expansion** — add common profile fields (`firstName`, `lastName`, `position`, `avatar`, `description`, `note`, `phone`, `timezone`) to the existing `person` table and surface them through `module-person`.
2. **Per-user knowledge base** — a new `module-knowledge` where a person keeps rich notes (markdown body + optional file attachments + external links), controls who can read each note (`private` / `shared` / `organization`), and attaches notes to tasks. Attaching a note to a task grants task-scoped read access to anyone who can view that task.

Both follow the repo's established `controller → service → repo` layering, `runQuery(dbProvider, ctx, fn)` data access, soft-delete `defaultFields`, plain-integer FKs (no DB-level referential constraints), and CASL row-level authorization. `module-task` is the structural template.

**File-management is already implemented** at `backend/src/modules/module-file-management/` (`FileManagementModule` exports `FileService` and `FileStorageService`). Avatars and knowledge file attachments are therefore a direct integration, not a deferred dependency — see §7.

## 2. Scope

### In scope (v1)
- Person columns: `firstName`, `lastName`, `position` (free-text), `avatarAttachmentId`, `description`, `note`, `phone`, `timezone`. `name` is **kept** unchanged.
- Person DTO/interface/service updates so a user can edit these via the existing `PATCH /persons/:id` (self-edit already authorized by `can('update','Person',{id:user.id})`).
- `knowledge` entity: `title` + markdown `body` + `ownerPersonId` + `visibility`.
- `knowledge_share` (per-person read grants), `knowledge_link` (external URLs), `knowledge_attachment` (→ `attachment`), `task_knowledge` (task link with `attachedByPersonId`).
- New `module-knowledge` with full CRUD, sharing management, link management, attachment linking, and task attach/detach.
- Visibility-aware read authorization combining CASL row rules + service-layer share/task checks.
- CASL `'Knowledge'` subject with privacy carve-outs (admin sees all; manager/exec do **not** see others' private/shared).

### Out of scope (v1 / future)
- **Edit/collaborator sharing** — shares are read-only in v1; only the owner (and admin) can edit/delete a knowledge entry. A `permission` column on `knowledge_share` is the additive future path.
- **Knowledge categorization/labels** — not requested; `module-label` could later be reused via a `knowledge_label` junction.
- **Versioning / revision history** of knowledge bodies.
- **Full-text / semantic search** over bodies (current `query` does `ilike` on title only, matching `task.query`).
- **Avatar/attachment upload** reuses the existing file-management endpoints (presigned `signature` → `notify`); this work does not add new upload routes. URL resolution is wired through `FileStorageService` — see §7.

## 3. Person profile expansion

### 3.1 Schema — `schema/identity.schema.ts`

Add columns to the existing `person` table (keep all current columns and indexes):

```ts
export const person = pgTable('person', {
  name: varchar('name', { length: 255 }).notNull(),       // KEPT — display/full name (used by auth)
  firstName: varchar('first_name', { length: 128 }),       // new
  lastName: varchar('last_name', { length: 128 }),         // new
  position: varchar('position', { length: 128 }),          // new — free-text job title (CTO, CEO, ...)
  avatarAttachmentId: integer('avatar_attachment_id'),     // new — references attachment.id (no DB FK)
  description: text('description'),                         // new — user-authored bio/description
  note: text('note'),                                      // new
  phone: varchar('phone', { length: 40 }),                 // new
  timezone: varchar('timezone', { length: 64 }),           // new
  email: varchar('email', { length: 320 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  role: personRole('role').notNull().default('member'),
  departmentId: integer('department_id'),
  teamId: integer('team_id'),
  ...defaultFields,
}, (t) => [
  uniqueIndex('person_email_index').on(t.email),
  index('person_role_index').on(t.role),
]);
```

Rationale:
- **Keep `name`** (`notNull`, used by auth/session). `firstName`/`lastName` are additive, nullable, so existing rows and the auth flow are unaffected. The frontend may compose a display name from first/last and fall back to `name`.
- **`position` is free-text** (`varchar(128)`), not a `pgEnum` — job titles are open-ended.
- **`avatarAttachmentId` is a plain integer** (consistent with all FKs in this repo, e.g. `departmentId`). The column ships in this deliverable; resolving it to a previewable URL uses `FileStorageService` (§7).

### 3.2 Module changes — `business-logic-modules/module-person`
- `person.interface.ts`: add the new fields to `IPersonProfile` as optional/nullable: `avatarAttachmentId?: number | null`, and the rest (`firstName`, `lastName`, `position`, `description`, `note`, `phone`, `timezone`) as `?: string | null`.
- `person.dto.ts`: add the new fields to `UpdatePersonDTO` (and `NewPersonDTO` where sensible) — `@IsOptional()` + `@IsString()` / `@IsNumber()`. `phone` validated as a string (no strict format in v1).
- `person.repo.ts`: column-driven `update` already spreads `...rest`; confirm new columns flow through. No structural change.
- `person.service.ts`: unchanged logic (update already authorized + cache-invalidated).
- **No new endpoints.** Self-edit is the existing `PATCH /persons/:id`.

### 3.3 Migration
`npm run db:generate` (from `backend/`) produces an `ALTER TABLE "person" ADD COLUMN ...` migration. All new columns are nullable → safe on existing data.

## 4. Knowledge data model — `schema/knowledge.schema.ts`

New schema file, re-exported from `schema/index.ts`. All tables use `defaultFields` (serial `id`, uuid `slug`, soft-delete timestamps/flags).

```ts
export const knowledgeVisibility = pgEnum('knowledge_visibility', ['private', 'shared', 'organization']);

export const knowledge = pgTable('knowledge', {
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body'),                                       // markdown — primary content
  ownerPersonId: integer('owner_person_id').notNull(),
  visibility: knowledgeVisibility('visibility').notNull().default('private'),
  ...defaultFields,
}, (t) => [
  index('knowledge_owner_index').on(t.ownerPersonId),
  index('knowledge_visibility_index').on(t.visibility),
]);

export const knowledgeShare = pgTable('knowledge_share', {
  knowledgeId: integer('knowledge_id').notNull(),
  personId: integer('person_id').notNull(),                 // grantee (read-only in v1)
  ...defaultFields,
}, (t) => [
  index('knowledge_share_knowledge_index').on(t.knowledgeId),
  index('knowledge_share_person_index').on(t.personId),
  uniqueIndex('knowledge_share_unique').on(t.knowledgeId, t.personId).where(sql`${t.isDeleted} = false`),
]);

export const knowledgeLink = pgTable('knowledge_link', {
  knowledgeId: integer('knowledge_id').notNull(),
  url: varchar('url', { length: 2048 }).notNull(),
  title: varchar('title', { length: 255 }),
  ...defaultFields,
}, (t) => [
  index('knowledge_link_knowledge_index').on(t.knowledgeId),
]);

export const knowledgeAttachment = pgTable('knowledge_attachment', {
  knowledgeId: integer('knowledge_id').notNull(),
  attachmentId: integer('attachment_id').notNull(),         // references attachment.id (no DB FK)
  ...defaultFields,
}, (t) => [
  index('knowledge_attachment_knowledge_index').on(t.knowledgeId),
  index('knowledge_attachment_attachment_index').on(t.attachmentId),
  uniqueIndex('knowledge_attachment_unique').on(t.knowledgeId, t.attachmentId).where(sql`${t.isDeleted} = false`),
]);

export const taskKnowledge = pgTable('task_knowledge', {
  taskId: integer('task_id').notNull(),
  knowledgeId: integer('knowledge_id').notNull(),
  attachedByPersonId: integer('attached_by_person_id').notNull(),
  ...defaultFields,
}, (t) => [
  index('task_knowledge_task_index').on(t.taskId),
  index('task_knowledge_knowledge_index').on(t.knowledgeId),
  uniqueIndex('task_knowledge_unique').on(t.taskId, t.knowledgeId).where(sql`${t.isDeleted} = false`),
]);
```

All junctions mirror `task_label` / `task_assignee` / `initiative_key_result`: FK indexes + a unique index partial on `is_deleted = false` (so a soft-deleted link can be recreated). `task_knowledge` lives in `knowledge.schema.ts` (the knowledge module owns the link table).

## 5. Module structure — `business-logic-modules/module-knowledge`

Cloned from `module-task`'s shape:

| File | Responsibility |
|---|---|
| `knowledge.interface.ts` | `KnowledgeVisibility`, `IKnowledgeProfile`, `INewKnowledge`, `IUpdateKnowledge`, `IKnowledgeEntity`, `IQueryKnowledgeParams`, share/link/attachment payload types |
| `knowledge.dto.ts` | `NewKnowledgeDTO`, `UpdateKnowledgeDTO`, `QueryKnowledgeDTO`, `FindKnowledgeBySlugDTO`/`ById`, `KnowledgeShareDTO`, `KnowledgeLinkDTO`, `KnowledgeAttachmentDTO`, `AttachTaskDTO` |
| `knowledge.repo.ts` | `implements BaseRepo<IKnowledgeEntity>`; CRUD via `runQuery`; junction link/unlink for share/link/attachment/task_knowledge; `query` (`ilike` title, paginated); `findReadableShareIds`, `findTaskIds`, `findAttachmentIds`, `findLinks` |
| `knowledge.service.ts` | orchestration + `requireReadable(...)` authorization (§6); existence checks (person/task/attachment) before linking |
| `knowledge.controller.ts` | HTTP routes (§5.1) with `@CheckPolicies` + `@CurrentUser` + `@CurrentAbility` + `DbContextService.forUser` |
| `knowledge.module.ts` | wiring; provides `KnowledgeRepository`/`KnowledgeService`; imports `PersonRepository`, `TaskRepository` (existence checks) and `FileManagementModule` (attachment URL resolution) |
| `*.spec.ts` | colocated repo (real-DB) + service (mocked) specs, matching existing convention |

Wiring: register `KnowledgeModule` in `src/modules/main.module.ts`. `module-task` imports `KnowledgeModule` (or `KnowledgeService`) only for the one convenience read route (§5.1).

### 5.1 API surface

Base `@Controller('knowledge')` → `/api/knowledge` (global prefix).

| Method | Route | Policy (guard) | Notes |
|---|---|---|---|
| POST | `/knowledge` | `create Knowledge` | body: title, body?, visibility?; owner = current user |
| POST | `/knowledge/search` | `read Knowledge` | paginated; results additionally filtered by `requireReadable` semantics |
| GET | `/knowledge/:slug` | `read Knowledge` | `service.requireReadable(...)` enforces visibility/share/task rules |
| PATCH | `/knowledge/:id` | `update Knowledge` | owner/admin only |
| DELETE | `/knowledge/:id` | `delete Knowledge` | owner/admin only (soft delete) |
| POST | `/knowledge/:slug/shares` | `update Knowledge` | body: personId; owner/admin |
| DELETE | `/knowledge/:slug/shares/:personId` | `update Knowledge` | owner/admin |
| POST | `/knowledge/:slug/links` | `update Knowledge` | body: url, title? |
| DELETE | `/knowledge/:slug/links/:linkId` | `update Knowledge` | |
| POST | `/knowledge/:slug/attachments` | `update Knowledge` | body: attachmentId; verifies attachment exists |
| DELETE | `/knowledge/:slug/attachments/:attachmentId` | `update Knowledge` | |
| POST | `/knowledge/:slug/tasks` | (see §6) | body: taskId; attach — requires read-task + read-knowledge |
| DELETE | `/knowledge/:slug/tasks/:taskId` | (see §6) | detach — knowledge owner OR can-update-task |
| GET | `/tasks/:slug/knowledge` | `read Task` | **on `TaskController`** — lists knowledge attached to a task (each item re-checked via `requireReadable`) |

Controllers return `buildOk`/`buildCreated` (`IBaseResponse`); global `ResponseInterceptor` + `GlobalExceptionFilter` apply. Setting `visibility='shared'` is what surfaces shares; adding a share row while `visibility='private'` should either auto-promote to `shared` or be rejected — **decision: auto-promote to `shared` on first share, and the owner may set visibility explicitly via PATCH.**

## 6. Visibility & authorization

### 6.1 Read rule (`KnowledgeService.requireReadable(entity, ctx, ability, user)`)
A knowledge entry is readable if ANY holds:
1. `ability.can('read', subject('Knowledge', entity))` — covers admin (`manage all`), owner, and `visibility='organization'` for all roles, and the manager/exec carve-outs below.
2. `entity.visibility === 'shared'` AND a live `knowledge_share` row exists for `(entity.id, user.id)`.
3. A live `task_knowledge` row links `entity.id` to a task `t` where `ability.can('read', subject('Task', t))`.

Rules 2 and 3 are service-layer because CASL conditions cannot query junction tables. This mirrors `task.requireBySlugAuthorized` (CASL check + entity load). `search` applies the same predicate to filter the page after the repo query.

### 6.2 Write rule
Edit/delete and all share/link/attachment mutations require `ability.can('update'|'delete', subject('Knowledge', entity))` → owner (`{ownerPersonId:user.id}`) or admin (`manage all`). Read-only sharing in v1.

### 6.3 Task attach/detach authorization
- **Attach** (`POST /knowledge/:slug/tasks`): caller must `requireReadable` the knowledge AND `can('read', Task)` for the target task. The `task_knowledge` row records `attachedByPersonId = user.id`. Attaching is itself the sharing action — no change to the knowledge's `visibility`.
- **Detach** (`DELETE /knowledge/:slug/tasks/:taskId`): caller must be the knowledge owner/admin OR `can('update', Task)`.

### 6.4 CASL changes — `ability.types.ts` + `ability.factory.ts`
Add `'Knowledge'` to `AppSubjectName`. Add `cannot` to the `AbilityBuilder` destructure. Per-role:

```ts
// admin: manage all                      // unchanged — full access incl. private Knowledge

// executive:
can('read', 'all');                                              // existing
cannot('read', 'Knowledge', { visibility: { $ne: 'organization' } }); // hide non-org entries
can('read', 'Knowledge', { ownerPersonId: user.id });            // but own entries are readable

// manager: (same privacy posture as exec) +
can('read', 'all');                                              // existing
cannot('read', 'Knowledge', { visibility: { $ne: 'organization' } });
can('manage', 'Knowledge', { ownerPersonId: user.id });          // full control of own (implies read)

// member:
can('manage', 'Knowledge', { ownerPersonId: user.id });
can('read', 'Knowledge', { visibility: 'organization' });
```

CASL semantics relied upon: later-defined rules win; conditional `cannot` only denies matching instances; subject-type-only checks (e.g. the `read Knowledge` guard on list endpoints) ignore conditions, so `read all`/`manage own` keep the guard passable and per-row filtering happens in the service. The `{ $ne: 'organization' }` condition covers both `private` and `shared`, preventing a blanket leak of `shared` entries to managers/execs who are not actual grantees (their access then comes only via rule 2/3 in §6.1).

## 7. File-management integration (avatar + knowledge attachments)

The file-management module is **already implemented** at `backend/src/modules/module-file-management/`. `FileManagementModule` exports `FileService` and `FileStorageService`. This is a direct integration — no deferred dependency.

### 7.1 What file-management already provides
- **Upload** (reused as-is, no new routes here): `POST /api/files/signature` (presigned handle) → client PUTs bytes → `POST /api/files/notify/:token` persists an `attachment` row and returns `{ slug, token, url, presignedUrl, ... }`. The attachment carries an internal integer `id` and a public `slug` (uuid).
- **Resolve**: `FileStorageService.getPreviewUrlByPath(schema, bucket, path, token, expiresIn?, respHeaders?)` returns a cached, time-limited preview URL (presigned GET for MinIO; signed read route for local).
- `FileService.getLink(slug, ctx, ability)` resolves by slug **with** a `read Attachment` CASL check (owner-only by default).

### 7.2 How we store the link
We persist the attachment's **integer `id`** (`person.avatarAttachmentId`, `knowledge_attachment.attachmentId`) — consistent with every other FK in the repo (`departmentId`, `ownerPersonId`, …). The columns/link tables and their CRUD are owned by this work.

### 7.3 How we resolve to a URL (the one small addition)
`getLink` resolves by **slug** and enforces the owner-only `read Attachment` rule. We store **ids**, and for *knowledge* attachments the owner-only check is wrong — a teammate who is authorized to read a `shared`/`organization` knowledge entry (or via a task) is usually **not** the attachment's creator, so `read Attachment {createdByPersonId:user.id}` would reject them even though the knowledge-level read check (§6.1) already authorized them.

Therefore add one helper to `FileService` (a thin addition to the finished module):
```ts
// Resolves attachment ids → preview URLs WITHOUT a per-attachment CASL check.
// The caller (person/knowledge service) has already authorized access at its own level.
async getLinkByIds(ids: number[], ctx: IDBConfigOptions):
  Promise<Array<{ id: number; slug: string; url: string; mimetype: string; thumbnailPath: string | null }>>
```
It loads rows via `FileRepository.findByIds`/`findById` and calls `FileStorageService.getPreviewUrlByPath(...)` per row. (`FileRepository` stays internal to the module; only the new `FileService` method is exposed.)

### 7.4 Consumers
- `module-person` imports `FileManagementModule`; the person service resolves `avatarAttachmentId` → preview URL via `getLinkByIds([avatarAttachmentId])` when building a profile response. (Avatars may be uploaded with `purpose='public'` for unsigned URLs — an upload-time choice; resolution is identical.)
- `module-knowledge` imports `FileManagementModule`; the knowledge service resolves `knowledge_attachment` ids → `{ slug, url, mimetype, thumbnailPath }` for the detail response, only after `requireReadable` (§6.1) passes.

This makes file-management's already-noted "avatar → public bucket" extension concrete; this design is its first consumer.

## 8. Testing strategy

Mirror the repo's colocated `.spec.ts` convention (`npx jest <path>`):
- `identity.schema.spec.ts` — extend to assert new `person` columns exist.
- `knowledge.schema.spec.ts` — table/column/enum assertions for all five tables (pattern: `getTableConfig`).
- `person.service.spec.ts` / `person.repo.spec.ts` — new fields round-trip through update.
- `knowledge.repo.spec.ts` (real DB) — knowledge CRUD + soft delete; share/link/attachment/task_knowledge link & unlink & list; uniqueness on re-link.
- `knowledge.service.spec.ts` (mocked repo + ability) — `requireReadable` truth table across roles × visibility × share × task-grant; write-authorization; auto-promote-to-shared on first share; attach/detach authorization.
- `ability.factory.spec.ts` — extend with Knowledge cases: admin reads others' private; exec/manager denied others' private and others' `shared`, allowed `organization` and own; member own + org only.
- Build + lint clean: `npm run build && npm test` (commands run from `backend/`).

## 9. Migrations & wiring checklist
- `schema/index.ts`: `export * from './knowledge.schema'`.
- `npm run db:generate`: one migration for `ALTER TABLE person` + `CREATE TYPE knowledge_visibility` + `CREATE TABLE knowledge/knowledge_share/knowledge_link/knowledge_attachment/task_knowledge`.
- `ability.types.ts`: add `'Knowledge'`.
- `ability.factory.ts`: add `cannot` to builder + per-role Knowledge rules.
- `module-file-management`: add `FileService.getLinkByIds(ids, ctx)` (+ `FileRepository.findByIds`); `FileManagementModule` already exports `FileService`.
- `main.module.ts`: import `KnowledgeModule`; `module-task` imports `KnowledgeService` for `GET /tasks/:slug/knowledge`.
- `module-knowledge` and `module-person` import `FileManagementModule` for attachment/avatar URL resolution.

## 10. File inventory (all < 500 lines)

| File | Est. lines | Role |
|---|---|---|
| `schema/knowledge.schema.ts` | ~75 | 5 tables + enum |
| `schema/identity.schema.ts` | edit | +8 person columns |
| `module-knowledge/knowledge.interface.ts` | ~70 | types |
| `module-knowledge/knowledge.dto.ts` | ~180 | request DTOs |
| `module-knowledge/knowledge.repo.ts` | ~280 | data access + junctions |
| `module-knowledge/knowledge.service.ts` | ~180 | orchestration + authorization |
| `module-knowledge/knowledge.controller.ts` | ~170 | HTTP routes |
| `module-knowledge/knowledge.module.ts` | ~30 | wiring |
| `module-person/*` | edits | interface/dto fields; import `FileManagementModule`; resolve avatar URL |
| `module-task/task.controller.ts` (+service/module) | edits | `GET /tasks/:slug/knowledge` |
| `module-file-management/file.service.ts` (+`file.repo.ts`) | edits | `getLinkByIds` + `findByIds` |
| `casl/ability.types.ts`, `casl/ability.factory.ts` | edits | `Knowledge` subject + rules |
| `schema/index.ts`, `main.module.ts` | edits | exports/wiring |
| `*.spec.ts` | — | colocated tests |
