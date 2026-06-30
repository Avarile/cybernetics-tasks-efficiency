# User Profile Expansion + Per-User Knowledge Base — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the `person` table with profile fields (incl. avatar) and add a per-user knowledge base (rich notes + attachments + links) with private/shared/organization visibility, attachable to tasks.

**Architecture:** Mirror the existing `controller → service → repo` stack with `runQuery(dbProvider, ctx, fn)` data access, soft-delete `defaultFields`, plain-integer FKs, and CASL row-level authorization. A new `module-knowledge` (cloned from `module-task`) owns the knowledge entity and all its junctions. Visibility-aware reads combine CASL row rules with service-layer share/task-grant checks. Avatars and knowledge file attachments reuse the already-implemented `module-file-management` (`FileService`/`FileStorageService`).

**Tech Stack:** NestJS 10, Drizzle ORM (node-postgres), CASL (`@casl/ability`, `createMongoAbility`), class-validator, Jest. Spec: `docs/superpowers/specs/2026-06-30-user-knowledge-base-design.md`.

## Global Constraints

- Files stay **under 500 lines**; one responsibility per file.
- **No new runtime dependencies** — everything used here already exists in the repo.
- **No `Co-Authored-By` trailer** on commits (project CLAUDE.md; attribution not enabled).
- **Read a file before editing it.** Follow existing patterns: `module-task` (structure, junctions) and `module-person` (profile).
- All repo methods take `ctx: IDBConfigOptions` and run via `runQuery(this.dbProvider, ctx, fn, executor?)`.
- Errors raise via `AppException.throw('<CODE>', message?)` or `AppException.notFound(entity, idOrSlug)`; **never** throw raw `HttpException`.
- Row-level authorization lives in the **service** via `assertAbility(ability, action, 'Subject', entity, msg)`; controllers only carry `@CheckPolicies(...)` type-level guards.
- **Destructive git is forbidden:** no `git reset`, `git checkout <ref>`, `git clean`, `git stash`, `git rebase`, or `git add -A`/`git add .`. Stage explicit paths only, then commit.
- All commands run **from `backend/`**. Test runner: `npx jest <path>` (jest `rootDir` is `backend/`, `testRegex` `.*\.spec\.ts$`). Build: `npm run build`. Lint: `npm run lint`.
- Migrations: `npm run db:generate` (drizzle-kit; reads `schema/index.ts`, writes a new numbered SQL file to `src/infra/application-db/migrations/`). Additive changes are non-interactive. **Do not run `db:push`/`db:migrate`** as part of this plan.
- Real-DB specs (`*.repo.spec.ts`) build an isolated schema by replaying the committed `*.sql` migrations (`test/db-setup.ts`), so the migration file must exist (and be committed) **before** the dependent repo spec runs. They require the dev Postgres in `backend/.env` to be reachable.
- `subject('Name', entity)` from `@casl/ability` is required for row-level `ability.can/cannot` checks against plain rows.

## File Structure

| File | Responsibility |
|---|---|
| `src/infra/application-db/schema/identity.schema.ts` | **edit** — add 8 `person` columns |
| `src/infra/application-db/schema/knowledge.schema.ts` | **new** — `knowledge` + 4 junction tables + `knowledge_visibility` enum |
| `src/infra/application-db/schema/index.ts` | **edit** — export knowledge schema |
| `src/modules/business-logic-modules/module-person/person.interface.ts` | **edit** — profile fields |
| `src/modules/business-logic-modules/module-person/person.dto.ts` | **edit** — DTO fields |
| `src/modules/business-logic-modules/module-person/person.service.ts` | **edit** — inject `FileService`, `attachAvatarUrl` |
| `src/modules/business-logic-modules/module-person/person.controller.ts` | **edit** — resolve avatar on single-person reads |
| `src/modules/business-logic-modules/module-person/person.module.ts` | **edit** — import `FileManagementModule` |
| `src/modules/module-file-management/file.repo.ts` | **edit** — `findByIds` |
| `src/modules/module-file-management/file.service.ts` | **edit** — `getLinkByIds` |
| `src/modules/business-logic-modules/module-knowledge/knowledge.interface.ts` | **new** — types |
| `src/modules/business-logic-modules/module-knowledge/knowledge.repo.ts` | **new** — data access + junctions |
| `src/modules/business-logic-modules/module-knowledge/knowledge.service.ts` | **new** — orchestration + authorization |
| `src/modules/business-logic-modules/module-knowledge/knowledge.dto.ts` | **new** — request DTOs |
| `src/modules/business-logic-modules/module-knowledge/knowledge.controller.ts` | **new** — HTTP routes |
| `src/modules/business-logic-modules/module-knowledge/knowledge.module.ts` | **new** — wiring |
| `src/common/casl/ability.types.ts` | **edit** — add `'Knowledge'` |
| `src/common/casl/ability.factory.ts` | **edit** — `cannot` + per-role Knowledge rules |
| `src/modules/main.module.ts` | **edit** — import `KnowledgeModule` |
| `src/modules/business-logic-modules/module-task/task.controller.ts` | **edit** — `GET /tasks/:slug/knowledge` |
| `src/modules/business-logic-modules/module-task/task.module.ts` | **edit** — import `KnowledgeModule` |

**Module wiring note (avoids a circular dependency):** `KnowledgeModule` does **not** import `TaskModule` or `PersonModule`; it *provides* `TaskRepository` and `PersonRepository` directly (each only needs the global `ApplicationDBProvider`), exactly as `TaskModule` already provides `PersonRepository` directly. `TaskModule` imports `KnowledgeModule` (one-way) for the `GET /tasks/:slug/knowledge` route.

---

### Task 1: Person profile expansion (schema, interface, DTO, migration)

**Files:**
- Modify: `src/infra/application-db/schema/identity.schema.ts`
- Modify: `src/modules/business-logic-modules/module-person/person.interface.ts`
- Modify: `src/modules/business-logic-modules/module-person/person.dto.ts`
- Modify: `src/infra/application-db/schema/identity.schema.spec.ts`
- Test (existing, extended): `src/modules/business-logic-modules/module-person/person.repo.spec.ts`

**Interfaces:**
- Produces: `person` columns `firstName`, `lastName`, `position`, `avatarAttachmentId`, `description`, `note`, `phone`, `timezone`; `IPersonProfile` gains the same optional fields (so `IPersonEntity` and `IUpdatePerson` inherit them).

- [ ] **Step 1: Read the files to edit**

Read `identity.schema.ts`, `identity.schema.spec.ts`, `person.interface.ts`, `person.dto.ts`.

- [ ] **Step 2: Extend the schema-spec test (failing)**

In `src/infra/application-db/schema/identity.schema.spec.ts`, add (inside the existing `describe`, adapting the import if `getTableConfig`/`person` aren't imported yet):
```ts
import { getTableConfig } from 'drizzle-orm/pg-core';
import { person } from './identity.schema';

it('person has the expanded profile columns', () => {
  const names = getTableConfig(person).columns.map((c) => c.name);
  expect(names).toEqual(
    expect.arrayContaining([
      'first_name', 'last_name', 'position', 'avatar_attachment_id',
      'description', 'note', 'phone', 'timezone',
    ]),
  );
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/infra/application-db/schema/identity.schema.spec.ts`
Expected: FAIL — the new columns are not present.

- [ ] **Step 4: Add the columns to `person`**

In `src/infra/application-db/schema/identity.schema.ts`, replace the `person` table definition. Keep `name`, `email`, `passwordHash`, `role`, `departmentId`, `teamId`, the `...defaultFields`, and both indexes; add the eight new columns. Ensure `text` and `integer` are imported (they already are). Remove the stale `// expansion required` comment block above `person`:
```ts
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
```

- [ ] **Step 5: Run the schema-spec test to verify it passes**

Run: `npx jest src/infra/application-db/schema/identity.schema.spec.ts`
Expected: PASS.

- [ ] **Step 6: Extend `IPersonProfile`**

In `src/modules/business-logic-modules/module-person/person.interface.ts`, add the optional fields to `IPersonProfile`:
```ts
export interface IPersonProfile {
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'member' | 'executive';
  departmentId?: number | null;
  teamId?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  position?: string | null;
  avatarAttachmentId?: number | null;
  description?: string | null;
  note?: string | null;
  phone?: string | null;
  timezone?: string | null;
}
```
(`INewPerson`, `IUpdatePerson`, `IQueryPersonParams`, `IPersonEntity` all derive from `IPersonProfile`, so they inherit the new fields automatically.)

- [ ] **Step 7: Add the new fields to `UpdatePersonDTO`**

In `src/modules/business-logic-modules/module-person/person.dto.ts`, add these properties to `UpdatePersonDTO` (after the existing `teamId` property, before `isActive`):
```ts
  @ApiProperty({ description: 'First name', required: false })
  @IsOptional() @IsString() firstName?: string | null;

  @ApiProperty({ description: 'Last name', required: false })
  @IsOptional() @IsString() lastName?: string | null;

  @ApiProperty({ description: 'Job title / position (free text)', required: false })
  @IsOptional() @IsString() position?: string | null;

  @ApiProperty({ description: 'Avatar attachment id', required: false })
  @IsOptional() @IsNumber() avatarAttachmentId?: number | null;

  @ApiProperty({ description: 'Self-description / bio', required: false })
  @IsOptional() @IsString() description?: string | null;

  @ApiProperty({ description: 'Free-form note', required: false })
  @IsOptional() @IsString() note?: string | null;

  @ApiProperty({ description: 'Phone number', required: false })
  @IsOptional() @IsString() phone?: string | null;

  @ApiProperty({ description: 'IANA timezone', required: false })
  @IsOptional() @IsString() timezone?: string | null;
```
(No new imports needed — `IsOptional`, `IsString`, `IsNumber`, `ApiProperty` are already imported.)

- [ ] **Step 8: Add a round-trip test for the new fields (failing until migration exists)**

`person.repo.spec.ts` already exposes `getCtx` (from `useTestSchema()`) and a `repo: PersonRepository`. Add this `it(...)` inside the existing `describe('PersonRepository (real DB)', ...)` block:
```ts
it('round-trips the expanded profile fields through update', async () => {
  const ctx = getCtx();
  const created = await repo.create(
    { name: 'Jo', email: `jo-${Date.now()}@x.com`, role: 'member' },
    ctx,
  );
  const updated = await repo.update(
    created.id,
    { firstName: 'Jo', lastName: 'Lee', position: 'CTO', description: 'bio', note: 'n', phone: '+100', timezone: 'UTC', avatarAttachmentId: 0 },
    ctx,
  );
  expect(updated.firstName).toBe('Jo');
  expect(updated.position).toBe('CTO');
  expect(updated.timezone).toBe('UTC');
});
```

- [ ] **Step 9: Generate the migration**

Run: `npm run db:generate`
Expected: a new `src/infra/application-db/migrations/00XX_*.sql` containing `ALTER TABLE "person" ADD COLUMN "first_name" ...` (and the other seven columns). All columns are nullable → safe on existing data.

- [ ] **Step 10: Run the person repo spec to verify it passes**

Run: `npx jest src/modules/business-logic-modules/module-person/person.repo.spec.ts`
Expected: PASS (existing tests + the new round-trip).

- [ ] **Step 11: Build**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 12: Commit**

```bash
git add src/infra/application-db/schema/identity.schema.ts src/infra/application-db/schema/identity.schema.spec.ts src/modules/business-logic-modules/module-person/person.interface.ts src/modules/business-logic-modules/module-person/person.dto.ts src/modules/business-logic-modules/module-person/person.repo.spec.ts src/infra/application-db/migrations
git commit -m "feat(person): expand profile (firstName/lastName/position/avatar/description/note/phone/timezone)"
```

---

### Task 2: File-management helper — `getLinkByIds` + `findByIds`

**Files:**
- Modify: `src/modules/module-file-management/file.repo.ts`
- Modify: `src/modules/module-file-management/file.service.ts`
- Test (existing, extended): `src/modules/module-file-management/file.repo.spec.ts`, `src/modules/module-file-management/file.service.spec.ts`

**Interfaces:**
- Consumes: `FileRepository`, `FileStorageService`, `IAttachmentEntity` (existing).
- Produces:
  - `FileRepository.findByIds(ids: number[], ctx: IDBConfigOptions): Promise<IAttachmentEntity[]>`
  - `FileService.getLinkByIds(ids: number[], ctx: IDBConfigOptions): Promise<Array<{ id: number; slug: string; url: string; mimetype: string; thumbnailPath: string | null }>>` — resolves attachment ids to preview URLs **without** a per-attachment CASL check (the caller has already authorized access at its own level).

- [ ] **Step 1: Add the failing repo test**

In `src/modules/module-file-management/file.repo.spec.ts`, add:
```ts
it('findByIds returns only the requested live rows', async () => {
  const ctx = getCtx();
  const a = await repo.create(base('tok-ids-1'), ctx);
  const b = await repo.create(base('tok-ids-2'), ctx);
  const rows = await repo.findByIds([a.id, b.id, 999999], ctx);
  expect(rows.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
});
```

- [ ] **Step 2: Run the repo test to verify it fails**

Run: `npx jest src/modules/module-file-management/file.repo.spec.ts -t findByIds`
Expected: FAIL — `repo.findByIds is not a function`.

- [ ] **Step 3: Implement `findByIds`**

In `src/modules/module-file-management/file.repo.ts`, ensure `inArray` is imported (it is) and add this method (e.g. after `findByToken`):
```ts
  async findByIds(ids: number[], ctx: IDBConfigOptions): Promise<IAttachmentEntity[]> {
    if (!ids.length) return [];
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db
        .select({ ...getTableColumns(attachment) })
        .from(attachment)
        .where(and(inArray(attachment.id, ids), eq(attachment.isDeleted, false)));
      return rows as IAttachmentEntity[];
    });
  }
```

- [ ] **Step 4: Run the repo test to verify it passes**

Run: `npx jest src/modules/module-file-management/file.repo.spec.ts -t findByIds`
Expected: PASS.

- [ ] **Step 5: Add the failing service test**

In `src/modules/module-file-management/file.service.spec.ts`, add inside the `describe('FileService', ...)` block:
```ts
it('getLinkByIds resolves ids to preview urls with no per-attachment CASL', async () => {
  repo.findByIds = jest.fn(async () => [
    { id: 3, slug: 'sl-3', bucket: 'private', path: 'general/x', token: 'tk', mimetype: 'image/png', thumbnailPath: '{"sm":"s"}' },
  ]);
  const out = await svc.getLinkByIds([3], ctx);
  expect(out).toEqual([
    { id: 3, slug: 'sl-3', url: 'signed://url', mimetype: 'image/png', thumbnailPath: '{"sm":"s"}' },
  ]);
  expect(storageSvc.getPreviewUrlByPath).toHaveBeenCalledWith(
    'public', 'private', 'general/x', 'tk', undefined, { 'Content-Type': 'image/png' },
  );
});
```
(`storageSvc.getPreviewUrlByPath` already returns `'signed://url'` in the existing `beforeEach`; `ctx.schema_id` is `'public'`.)

- [ ] **Step 6: Run the service test to verify it fails**

Run: `npx jest src/modules/module-file-management/file.service.spec.ts -t getLinkByIds`
Expected: FAIL — `svc.getLinkByIds is not a function`.

- [ ] **Step 7: Implement `getLinkByIds`**

In `src/modules/module-file-management/file.service.ts`, add this method to `FileService` (it already injects `this.repo` and `this.storage`):
```ts
  /**
   * Resolve attachment ids to preview URLs WITHOUT a per-attachment CASL check.
   * The caller (person/knowledge service) has already authorized access at its
   * own level, so re-checking the owner-only `read Attachment` rule here would
   * wrongly reject teammates who can see a shared note but did not upload it.
   */
  async getLinkByIds(
    ids: number[],
    ctx: IDBConfigOptions,
  ): Promise<Array<{ id: number; slug: string; url: string; mimetype: string; thumbnailPath: string | null }>> {
    const rows = await this.repo.findByIds(ids, ctx);
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        slug: r.slug,
        mimetype: r.mimetype,
        thumbnailPath: r.thumbnailPath,
        url: await this.storage.getPreviewUrlByPath(
          ctx.schema_id, r.bucket, r.path, r.token, undefined, { 'Content-Type': r.mimetype },
        ),
      })),
    );
  }
```

- [ ] **Step 8: Run the service test to verify it passes**

Run: `npx jest src/modules/module-file-management/file.service.spec.ts -t getLinkByIds`
Expected: PASS.

- [ ] **Step 9: Build**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add src/modules/module-file-management/file.repo.ts src/modules/module-file-management/file.repo.spec.ts src/modules/module-file-management/file.service.ts src/modules/module-file-management/file.service.spec.ts
git commit -m "feat(file-management): getLinkByIds + findByIds for id-keyed url resolution"
```

---

### Task 3: Wire avatar URL resolution into `module-person`

**Files:**
- Modify: `src/modules/business-logic-modules/module-person/person.service.ts`
- Modify: `src/modules/business-logic-modules/module-person/person.controller.ts`
- Modify: `src/modules/business-logic-modules/module-person/person.module.ts`
- Test (existing, extended): `src/modules/business-logic-modules/module-person/person.service.spec.ts`

**Interfaces:**
- Consumes: `FileService.getLinkByIds` (Task 2); `FileManagementModule`.
- Produces: `PersonService.attachAvatarUrl<T extends { avatarAttachmentId?: number | null }>(entity: T, ctx): Promise<T & { avatarUrl: string | null }>` — used on single-person read responses.

- [ ] **Step 1: Read the files to edit** (`person.service.ts`, `person.controller.ts`, `person.module.ts`, `person.service.spec.ts`).

- [ ] **Step 2: Add the failing service test**

The spec uses a `setup()` helper that currently does `new PersonService(repo, cache)` and returns `{ service, repo, cache }`, plus a module-level `CTX` constant. Because Task 3 adds a required third constructor arg, **first update `setup()`** so the existing two tests keep compiling, then add the new `describe`:
```ts
// --- in setup(), add a files mock and pass it as the 3rd arg ---
  const cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() } as any;
  const files = { getLinkByIds: jest.fn() } as any;
  const service = new PersonService(repo, cache, files);
  return { service, repo, cache, files };
```
```ts
// --- new describe block ---
describe('PersonService avatar resolution', () => {
  beforeEach(() => jest.clearAllMocks());

  it('attachAvatarUrl resolves the avatar attachment to a url', async () => {
    const { service, files } = setup();
    files.getLinkByIds.mockResolvedValue([{ id: 9, slug: 's', url: 'pic://9', mimetype: 'image/png', thumbnailPath: null }]);
    const out = await service.attachAvatarUrl({ id: 1, avatarAttachmentId: 9 } as any, CTX);
    expect(out.avatarUrl).toBe('pic://9');
    expect(files.getLinkByIds).toHaveBeenCalledWith([9], CTX);
  });

  it('attachAvatarUrl returns null when no avatar is set', async () => {
    const { service, files } = setup();
    const out = await service.attachAvatarUrl({ id: 1, avatarAttachmentId: null } as any, CTX);
    expect(out.avatarUrl).toBeNull();
    expect(files.getLinkByIds).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the service test to verify it fails**

Run: `npx jest src/modules/business-logic-modules/module-person/person.service.spec.ts -t attachAvatarUrl`
Expected: FAIL — `attachAvatarUrl` does not exist / constructor arity mismatch.

- [ ] **Step 4: Inject `FileService` and add `attachAvatarUrl`**

In `src/modules/business-logic-modules/module-person/person.service.ts`:
- Add the import: `import { FileService } from 'src/modules/module-file-management/file.service';`
- Add the constructor parameter (after the cache):
```ts
  constructor(
    private readonly repo: PersonRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly files: FileService,
  ) {}
```
- Add the method:
```ts
  async attachAvatarUrl<T extends { avatarAttachmentId?: number | null }>(
    entity: T,
    ctx: IDBConfigOptions,
  ): Promise<T & { avatarUrl: string | null }> {
    if (!entity.avatarAttachmentId) return { ...entity, avatarUrl: null };
    const [resolved] = await this.files.getLinkByIds([entity.avatarAttachmentId], ctx);
    return { ...entity, avatarUrl: resolved?.url ?? null };
  }
```

- [ ] **Step 5: Resolve avatar on single-person controller reads**

In `src/modules/business-logic-modules/module-person/person.controller.ts`, wrap the result of the four single-person responses with `attachAvatarUrl`. For each of `updatePerson`, `getPersonByName`, `getPersonBySlug`, `getPersonById`, change the returned data. Example for `getPersonById`:
```ts
  async getPersonById(@CurrentUser() user: IUserSession, @Param() params: FindPersonByIdDTO): Promise<IBaseResponse> {
    const ctx = this.ctx.forUser(user.id);
    const result = await this.personService.requireById(params.id, ctx);
    return buildOk(await this.personService.attachAvatarUrl(result, ctx), 'Person found');
  }
```
Apply the same pattern (compute `ctx` once, wrap the entity in `attachAvatarUrl(result, ctx)`) to `getPersonByName`, `getPersonBySlug`, and `updatePerson`. Leave `getAllPersons`/`searchPersons` unchanged (list endpoints return `avatarAttachmentId` without resolving — avoids N+1; clients resolve per-avatar or via a future batch endpoint).

- [ ] **Step 6: Import `FileManagementModule` into `PersonModule`**

In `src/modules/business-logic-modules/module-person/person.module.ts`:
```ts
import { FileManagementModule } from 'src/modules/module-file-management/file.module';
// ...
@Module({
  imports: [AuthModule, FileManagementModule],
  controllers: [PersonController],
  providers: [PersonRepository, PersonService],
  exports: [PersonRepository, PersonService],
})
export class PersonModule {}
```

- [ ] **Step 7: Run the service test to verify it passes**

Run: `npx jest src/modules/business-logic-modules/module-person/person.service.spec.ts`
Expected: PASS (existing + new).

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: no TypeScript errors. (If Nest reports an injection error for `FileService`, confirm `FileManagementModule` is imported and that it exports `FileService` — it does.)

- [ ] **Step 9: Commit**

```bash
git add src/modules/business-logic-modules/module-person/person.service.ts src/modules/business-logic-modules/module-person/person.service.spec.ts src/modules/business-logic-modules/module-person/person.controller.ts src/modules/business-logic-modules/module-person/person.module.ts
git commit -m "feat(person): resolve avatar attachment to a preview url on profile reads"
```

---

### Task 4: Knowledge schema, interfaces & migration

**Files:**
- Create: `src/infra/application-db/schema/knowledge.schema.ts`
- Modify: `src/infra/application-db/schema/index.ts`
- Create: `src/infra/application-db/schema/knowledge.schema.spec.ts`
- Create: `src/modules/business-logic-modules/module-knowledge/knowledge.interface.ts`

**Interfaces:**
- Produces: tables `knowledge`, `knowledgeShare`, `knowledgeLink`, `knowledgeAttachment`, `taskKnowledge`; enum `knowledgeVisibility`; types `KnowledgeVisibility`, `IKnowledgeProfile`, `INewKnowledge`, `IUpdateKnowledge`, `IKnowledgeEntity`, `IQueryKnowledgeParams`, `IKnowledgeLink`, `IKnowledgeAttachmentRef`.

- [ ] **Step 1: Write the failing schema spec**

Create `src/infra/application-db/schema/knowledge.schema.spec.ts`:
```ts
import { getTableConfig } from 'drizzle-orm/pg-core';
import { knowledge, knowledgeShare, knowledgeLink, knowledgeAttachment, taskKnowledge } from './knowledge.schema';

describe('knowledge schema', () => {
  it('knowledge has core columns', () => {
    const { name, columns } = getTableConfig(knowledge);
    expect(name).toBe('knowledge');
    expect(columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(['title', 'body', 'owner_person_id', 'visibility', 'id', 'slug', 'is_deleted']),
    );
  });

  it('junction tables map to the expected names', () => {
    expect(getTableConfig(knowledgeShare).name).toBe('knowledge_share');
    expect(getTableConfig(knowledgeLink).name).toBe('knowledge_link');
    expect(getTableConfig(knowledgeAttachment).name).toBe('knowledge_attachment');
    expect(getTableConfig(taskKnowledge).name).toBe('task_knowledge');
  });

  it('task_knowledge records who attached', () => {
    const names = getTableConfig(taskKnowledge).columns.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['task_id', 'knowledge_id', 'attached_by_person_id']));
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx jest src/infra/application-db/schema/knowledge.schema.spec.ts`
Expected: FAIL — `Cannot find module './knowledge.schema'`.

- [ ] **Step 3: Create the schema**

Create `src/infra/application-db/schema/knowledge.schema.ts`:
```ts
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
```

- [ ] **Step 4: Export the schema**

In `src/infra/application-db/schema/index.ts`, add at the end:
```ts
export * from './knowledge.schema';
```

- [ ] **Step 5: Run the spec to verify it passes**

Run: `npx jest src/infra/application-db/schema/knowledge.schema.spec.ts`
Expected: PASS.

- [ ] **Step 6: Create the interfaces**

Create `src/modules/business-logic-modules/module-knowledge/knowledge.interface.ts`:
```ts
import { DefaultFields, IBaseQueryParams, UpdatableDefaultFields } from 'src/utils/shared/interface';

export type KnowledgeVisibility = 'private' | 'shared' | 'organization';

export interface IKnowledgeProfile {
  title: string;
  body?: string | null;
  ownerPersonId: number;
  visibility: KnowledgeVisibility;
}

export interface INewKnowledge {
  title: string;
  body?: string | null;
  ownerPersonId: number;
  visibility?: KnowledgeVisibility;
}

export interface IUpdateKnowledge
  extends Partial<Pick<IKnowledgeProfile, 'title' | 'body' | 'visibility'>>,
    UpdatableDefaultFields {}

export interface IKnowledgeEntity extends DefaultFields, IKnowledgeProfile {
  body: string | null;
}

export interface IQueryKnowledgeParams extends Partial<IBaseQueryParams> {
  title?: string;
  ownerPersonId?: number;
  visibility?: KnowledgeVisibility;
  // Authorization-aware filtering, computed by the service before querying.
  requesterId?: number;
  sharedIds?: number[];
  unrestricted?: boolean;
}

export interface IKnowledgeLink {
  id: number;
  knowledgeId: number;
  url: string;
  title: string | null;
}

export interface IKnowledgeAttachmentRef {
  id: number;
  slug: string;
  url: string;
  mimetype: string;
  thumbnailPath: string | null;
}
```

- [ ] **Step 7: Generate the migration**

Run: `npm run db:generate`
Expected: a new `00XX_*.sql` containing `CREATE TYPE "public"."knowledge_visibility"` and `CREATE TABLE "knowledge"`, `"knowledge_share"`, `"knowledge_link"`, `"knowledge_attachment"`, `"task_knowledge"` plus their indexes.

- [ ] **Step 8: Build**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add src/infra/application-db/schema/knowledge.schema.ts src/infra/application-db/schema/knowledge.schema.spec.ts src/infra/application-db/schema/index.ts src/modules/business-logic-modules/module-knowledge/knowledge.interface.ts src/infra/application-db/migrations
git commit -m "feat(knowledge): schema (knowledge + share/link/attachment/task junctions), interfaces, migration"
```

---

### Task 5: CASL — `Knowledge` subject + per-role rules

**Files:**
- Modify: `src/common/casl/ability.types.ts`
- Modify: `src/common/casl/ability.factory.ts`
- Test (existing, extended): `src/common/casl/ability.factory.spec.ts`

**Interfaces:**
- Produces: `'Knowledge'` in `AppSubjectName`; per-role Knowledge rules — admin full; exec read org-only (+ own); manager read org-only (+ own) and manage own; member manage own + read org.

- [ ] **Step 1: Add the failing CASL tests**

In `src/common/casl/ability.factory.spec.ts`, add these tests (the file already imports `subject` and the `user(...)` helper):
```ts
it('admin can read others private knowledge', () => {
  const a = defineAbilityFor(user({ role: 'admin' }));
  expect(a.can('read', subject('Knowledge', { ownerPersonId: 8, visibility: 'private' }))).toBe(true);
});

it('executive reads organization knowledge and own, not others private/shared', () => {
  const a = defineAbilityFor(user({ id: 1, role: 'executive' }));
  expect(a.can('read', subject('Knowledge', { ownerPersonId: 9, visibility: 'organization' }))).toBe(true);
  expect(a.can('read', subject('Knowledge', { ownerPersonId: 1, visibility: 'private' }))).toBe(true);
  expect(a.can('read', subject('Knowledge', { ownerPersonId: 9, visibility: 'private' }))).toBe(false);
  expect(a.can('read', subject('Knowledge', { ownerPersonId: 9, visibility: 'shared' }))).toBe(false);
  expect(a.can('create', 'Knowledge')).toBe(false);
  expect(a.can('update', subject('Knowledge', { ownerPersonId: 1 }))).toBe(false);
});

it('manager manages own knowledge and reads org, not others private/shared', () => {
  const a = defineAbilityFor(user({ id: 5, role: 'manager' }));
  expect(a.can('update', subject('Knowledge', { ownerPersonId: 5 }))).toBe(true);
  expect(a.can('read', subject('Knowledge', { ownerPersonId: 9, visibility: 'organization' }))).toBe(true);
  expect(a.can('read', subject('Knowledge', { ownerPersonId: 9, visibility: 'private' }))).toBe(false);
  expect(a.can('read', subject('Knowledge', { ownerPersonId: 9, visibility: 'shared' }))).toBe(false);
});

it('member manages own knowledge and reads only org for others', () => {
  const a = defineAbilityFor(user({ id: 7, role: 'member' }));
  expect(a.can('create', 'Knowledge')).toBe(true);
  expect(a.can('update', subject('Knowledge', { ownerPersonId: 7 }))).toBe(true);
  expect(a.can('update', subject('Knowledge', { ownerPersonId: 8 }))).toBe(false);
  expect(a.can('read', subject('Knowledge', { ownerPersonId: 9, visibility: 'organization' }))).toBe(true);
  expect(a.can('read', subject('Knowledge', { ownerPersonId: 9, visibility: 'private' }))).toBe(false);
});
```

- [ ] **Step 2: Run the CASL spec to verify it fails**

Run: `npx jest src/common/casl/ability.factory.spec.ts`
Expected: FAIL — the new Knowledge expectations don't hold yet.

- [ ] **Step 3: Add `'Knowledge'` to the subject union**

In `src/common/casl/ability.types.ts`, add `'Knowledge'` to `AppSubjectName` (e.g. after `'Attachment'`):
```ts
  | 'Attachment'
  | 'Knowledge'
  | 'all';
```

- [ ] **Step 4: Add `cannot` to the builder and the per-role rules**

In `src/common/casl/ability.factory.ts`:
- Change the destructure to include `cannot`:
```ts
  const { can, cannot, build } = new AbilityBuilder<AnyAbility>(createMongoAbility);
```
- In the `executive` case, after `can('read', 'all');` add:
```ts
      cannot('read', 'Knowledge', { visibility: { $ne: 'organization' } });
      can('read', 'Knowledge', { ownerPersonId: user.id });
```
- In the `manager` case, after its existing `can('create', 'ActivityEvent', ...)` line (i.e. at the end of the manager block, before `break;`) add:
```ts
      cannot('read', 'Knowledge', { visibility: { $ne: 'organization' } });
      can('manage', 'Knowledge', { ownerPersonId: user.id });
```
- In the `member` case, after `can('read', 'ActivityEvent', { actorPersonId: user.id });` add:
```ts
      can('manage', 'Knowledge', { ownerPersonId: user.id });
      can('read', 'Knowledge', { visibility: 'organization' });
```
(admin already has `manage all` — no change.)

Rule-ordering rationale: CASL applies the last matching rule. The conditional `cannot('read','Knowledge',{visibility:{$ne:'organization'}})` denies any non-organization entry; the subsequent `can('read'/'manage','Knowledge',{ownerPersonId})` re-permits the requester's own entries. `manage` (owner) implies `read`/`update`/`delete`/`create`. Type-level checks (no instance) ignore conditions, so `can('read'|'create'|'update','Knowledge')` stay true for the relevant roles, keeping controller guards passable; per-row enforcement happens in the service.

- [ ] **Step 5: Run the CASL spec to verify it passes**

Run: `npx jest src/common/casl/ability.factory.spec.ts`
Expected: PASS (existing + new).

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/common/casl/ability.types.ts src/common/casl/ability.factory.ts src/common/casl/ability.factory.spec.ts
git commit -m "feat(casl): Knowledge subject + privacy rules (admin all; manager/exec org-only)"
```

---

### Task 6: KnowledgeRepository

**Files:**
- Create: `src/modules/business-logic-modules/module-knowledge/knowledge.repo.ts`
- Create: `src/modules/business-logic-modules/module-knowledge/knowledge.repo.spec.ts`

**Interfaces:**
- Consumes: `knowledge`, `knowledgeShare`, `knowledgeLink`, `knowledgeAttachment`, `taskKnowledge` (Task 4); `runQuery`, `ApplicationDBProvider`, `BaseRepo`, `withPagination`, `IDBConfigOptions`; knowledge interface types.
- Produces: `class KnowledgeRepository implements BaseRepo<IKnowledgeEntity>` with `create`, `findById`, `findBySlug`, `findByIds`, `update`, `delete`, `countAll`, `query`, `findAll`; junctions: `linkShare`, `unlinkShare`, `findShareePersonIds`, `findSharedKnowledgeIdsForPerson`, `addLink`, `removeLink`, `findLinks`, `linkAttachment`, `unlinkAttachment`, `findAttachmentIds`, `linkTask`, `unlinkTask`, `findTaskIds`, `findKnowledgeIdsForTask`.

- [ ] **Step 1: Write the failing repo spec** (requires dev Postgres)

Create `src/modules/business-logic-modules/module-knowledge/knowledge.repo.spec.ts`:
```ts
import 'dotenv/config';
import { useTestSchema } from '../../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { KnowledgeRepository } from './knowledge.repo';

describe('KnowledgeRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: KnowledgeRepository;
  beforeAll(() => { repo = new KnowledgeRepository(new ApplicationDBProvider()); });

  it('create then findBySlug / findById round-trips', async () => {
    const ctx = getCtx();
    const row = await repo.create({ title: 'Note A', body: 'hello', ownerPersonId: 1 }, ctx);
    expect(row.slug).toBeTruthy();
    expect(row.visibility).toBe('private');
    expect((await repo.findBySlug(row.slug, ctx))!.id).toBe(row.id);
    expect((await repo.findById(row.id, ctx))!.title).toBe('Note A');
  });

  it('share link/unlink + lookups', async () => {
    const ctx = getCtx();
    const k = await repo.create({ title: 'B', ownerPersonId: 1 }, ctx);
    await repo.linkShare(k.id, 2, ctx);
    await repo.linkShare(k.id, 2, ctx); // idempotent
    expect(await repo.findShareePersonIds(k.id, ctx)).toEqual([2]);
    expect(await repo.findSharedKnowledgeIdsForPerson(2, ctx)).toContain(k.id);
    await repo.unlinkShare(k.id, 2, ctx);
    expect(await repo.findShareePersonIds(k.id, ctx)).toEqual([]);
  });

  it('links add/remove/list', async () => {
    const ctx = getCtx();
    const k = await repo.create({ title: 'C', ownerPersonId: 1 }, ctx);
    const link = await repo.addLink(k.id, 'https://x.test', 'X', ctx);
    expect((await repo.findLinks(k.id, ctx)).map((l) => l.url)).toEqual(['https://x.test']);
    await repo.removeLink(k.id, link.id, ctx);
    expect(await repo.findLinks(k.id, ctx)).toEqual([]);
  });

  it('attachments link/unlink + list ids', async () => {
    const ctx = getCtx();
    const k = await repo.create({ title: 'D', ownerPersonId: 1 }, ctx);
    await repo.linkAttachment(k.id, 55, ctx);
    expect(await repo.findAttachmentIds(k.id, ctx)).toEqual([55]);
    await repo.unlinkAttachment(k.id, 55, ctx);
    expect(await repo.findAttachmentIds(k.id, ctx)).toEqual([]);
  });

  it('task link/unlink + both-direction lookups', async () => {
    const ctx = getCtx();
    const k = await repo.create({ title: 'E', ownerPersonId: 1 }, ctx);
    await repo.linkTask(100, k.id, 1, ctx);
    expect(await repo.findTaskIds(k.id, ctx)).toEqual([100]);
    expect(await repo.findKnowledgeIdsForTask(100, ctx)).toContain(k.id);
    await repo.unlinkTask(100, k.id, ctx);
    expect(await repo.findTaskIds(k.id, ctx)).toEqual([]);
  });

  it('update changes visibility; delete soft-deletes', async () => {
    const ctx = getCtx();
    const k = await repo.create({ title: 'F', ownerPersonId: 1 }, ctx);
    const u = await repo.update(k.id, { visibility: 'organization' }, ctx);
    expect(u.visibility).toBe('organization');
    await repo.delete(k.id, ctx);
    expect(await repo.findById(k.id, ctx)).toBeNull();
  });

  it('findByIds returns requested live rows', async () => {
    const ctx = getCtx();
    const a = await repo.create({ title: 'G', ownerPersonId: 1 }, ctx);
    const b = await repo.create({ title: 'H', ownerPersonId: 1 }, ctx);
    const rows = await repo.findByIds([a.id, b.id], ctx);
    expect(rows.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx jest src/modules/business-logic-modules/module-knowledge/knowledge.repo.spec.ts`
Expected: FAIL — `Cannot find module './knowledge.repo'`.

- [ ] **Step 3: Implement the repository**

Create `src/modules/business-logic-modules/module-knowledge/knowledge.repo.ts`:
```ts
import { HttpStatus, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, inArray, or, SQL, getTableColumns } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { runQuery } from 'src/infra/application-db/query-runner';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import {
  knowledge, knowledgeShare, knowledgeLink, knowledgeAttachment, taskKnowledge,
} from 'src/infra/application-db/schema/knowledge.schema';
import { AppException } from 'src/utils/exception.provider';
import { BaseRepo } from 'src/utils/shared/base.abstract';
import { IBaseQueryResult } from 'src/utils/shared/interface';
import { withPagination } from 'src/utils/shared/query';
import {
  IKnowledgeEntity, IKnowledgeLink, INewKnowledge, IQueryKnowledgeParams, IUpdateKnowledge,
} from './knowledge.interface';

@Injectable()
export class KnowledgeRepository implements BaseRepo<IKnowledgeEntity> {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async create(item: INewKnowledge, ctx: IDBConfigOptions): Promise<IKnowledgeEntity> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db.insert(knowledge).values({
        title: item.title,
        body: item.body ?? null,
        ownerPersonId: item.ownerPersonId,
        visibility: item.visibility ?? 'private',
      }).returning();
      return row as IKnowledgeEntity;
    });
  }

  async findById(id: string | number, ctx: IDBConfigOptions): Promise<IKnowledgeEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db.select({ ...getTableColumns(knowledge) }).from(knowledge)
        .where(and(eq(knowledge.id, Number(id)), eq(knowledge.isDeleted, false)));
      return (row as IKnowledgeEntity) || null;
    });
  }

  async findBySlug(slug: string, ctx: IDBConfigOptions): Promise<IKnowledgeEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db.select({ ...getTableColumns(knowledge) }).from(knowledge)
        .where(and(eq(knowledge.slug, slug), eq(knowledge.isDeleted, false)));
      return (row as IKnowledgeEntity) || null;
    });
  }

  async findByIds(ids: number[], ctx: IDBConfigOptions): Promise<IKnowledgeEntity[]> {
    if (!ids.length) return [];
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db.select({ ...getTableColumns(knowledge) }).from(knowledge)
        .where(and(inArray(knowledge.id, ids), eq(knowledge.isDeleted, false)));
      return rows as IKnowledgeEntity[];
    });
  }

  async update(id: string | number, payload: IUpdateKnowledge, ctx: IDBConfigOptions): Promise<IKnowledgeEntity> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [existing] = await db.select({ id: knowledge.id }).from(knowledge)
        .where(and(eq(knowledge.id, Number(id)), eq(knowledge.isDeleted, false)));
      if (!existing) AppException.notFound('Knowledge', id);
      const { id: _i, slug: _s, createdAt: _c, updatedAt: _u, isDeleted: _d, deletedAt: _dt, ...rest } = payload as Record<string, unknown>;
      const [row] = await db.update(knowledge)
        .set({ ...rest, updatedAt: new Date().toISOString() })
        .where(eq(knowledge.id, Number(id))).returning();
      return row as IKnowledgeEntity;
    });
  }

  async delete(id: string | number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db.update(knowledge)
        .set({ isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(knowledge.id, Number(id)));
    });
  }

  async countAll(ctx: IDBConfigOptions, where?: SQL): Promise<number> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [{ c }] = await db.select({ c: count() }).from(knowledge).where(where ?? eq(knowledge.isDeleted, false));
      return Number(c);
    });
  }

  async query(params: IQueryKnowledgeParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    const {
      title, ownerPersonId, visibility, requesterId, sharedIds, unrestricted,
      id, ids, slug, page = 1, pageSize = 50, isDeleted,
      sortOptions = [{ SortBy: 'createdAt', sortOrder: 'desc' }],
    } = params;

    const conditions: SQL[] = [eq(knowledge.isDeleted, isDeleted ?? false)];
    if (id) conditions.push(eq(knowledge.id, id));
    if (ids?.length) conditions.push(inArray(knowledge.id, ids));
    if (slug) conditions.push(eq(knowledge.slug, slug));
    if (title) conditions.push(ilike(knowledge.title, `%${title}%`));
    if (ownerPersonId) conditions.push(eq(knowledge.ownerPersonId, ownerPersonId));
    if (visibility) conditions.push(eq(knowledge.visibility, visibility));

    // Authorization-aware visibility scope (skipped when unrestricted, e.g. admin).
    if (!unrestricted && requesterId != null) {
      const scope: SQL[] = [eq(knowledge.ownerPersonId, requesterId), eq(knowledge.visibility, 'organization')];
      if (sharedIds?.length) scope.push(inArray(knowledge.id, sharedIds));
      conditions.push(or(...scope) as SQL);
    }

    const where = and(...conditions);

    return runQuery(this.dbProvider, ctx, async (db) => {
      const columnMap: Record<string, PgColumn> = {
        id: knowledge.id as unknown as PgColumn,
        title: knowledge.title as unknown as PgColumn,
        createdAt: knowledge.createdAt as unknown as PgColumn,
        updatedAt: knowledge.updatedAt as unknown as PgColumn,
      };
      const order = sortOptions.map((o) => {
        const col = columnMap[o.SortBy] ?? columnMap.createdAt;
        return o.sortOrder === 'asc' ? asc(col) : desc(col);
      });
      const q = db.select({ ...getTableColumns(knowledge) }).from(knowledge).where(where).orderBy(...order).$dynamic();
      const data = await withPagination(q, page, pageSize);
      const total = await this.countAll(ctx, where);
      return {
        data: data as IKnowledgeEntity[],
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        status_code: HttpStatus.OK, message: 'Knowledge query successful', timestamp: new Date(), error: null,
      };
    });
  }

  async findAll(params: IQueryKnowledgeParams, ctx: IDBConfigOptions): Promise<IKnowledgeEntity[]> {
    const res = await this.query(params, ctx);
    return res.data as IKnowledgeEntity[];
  }

  // --- shares --------------------------------------------------------------
  async linkShare(knowledgeId: number, personId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const existing = await db.select({ id: knowledgeShare.id }).from(knowledgeShare)
        .where(and(eq(knowledgeShare.knowledgeId, knowledgeId), eq(knowledgeShare.personId, personId), eq(knowledgeShare.isDeleted, false)));
      if (existing.length > 0) return;
      await db.insert(knowledgeShare).values({ knowledgeId, personId });
    });
  }

  async unlinkShare(knowledgeId: number, personId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db.update(knowledgeShare)
        .set({ isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(and(eq(knowledgeShare.knowledgeId, knowledgeId), eq(knowledgeShare.personId, personId)));
    });
  }

  async findShareePersonIds(knowledgeId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db.select({ personId: knowledgeShare.personId }).from(knowledgeShare)
        .where(and(eq(knowledgeShare.knowledgeId, knowledgeId), eq(knowledgeShare.isDeleted, false)));
      return rows.map((r) => r.personId);
    });
  }

  async findSharedKnowledgeIdsForPerson(personId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db.select({ knowledgeId: knowledgeShare.knowledgeId }).from(knowledgeShare)
        .where(and(eq(knowledgeShare.personId, personId), eq(knowledgeShare.isDeleted, false)));
      return rows.map((r) => r.knowledgeId);
    });
  }

  // --- links ---------------------------------------------------------------
  async addLink(knowledgeId: number, url: string, title: string | null, ctx: IDBConfigOptions): Promise<IKnowledgeLink> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db.insert(knowledgeLink).values({ knowledgeId, url, title: title ?? null }).returning();
      return { id: row.id, knowledgeId: row.knowledgeId, url: row.url, title: row.title } as IKnowledgeLink;
    });
  }

  async removeLink(knowledgeId: number, linkId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db.update(knowledgeLink)
        .set({ isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(and(eq(knowledgeLink.id, linkId), eq(knowledgeLink.knowledgeId, knowledgeId)));
    });
  }

  async findLinks(knowledgeId: number, ctx: IDBConfigOptions): Promise<IKnowledgeLink[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db.select({ id: knowledgeLink.id, knowledgeId: knowledgeLink.knowledgeId, url: knowledgeLink.url, title: knowledgeLink.title })
        .from(knowledgeLink)
        .where(and(eq(knowledgeLink.knowledgeId, knowledgeId), eq(knowledgeLink.isDeleted, false)));
      return rows as IKnowledgeLink[];
    });
  }

  // --- attachments ---------------------------------------------------------
  async linkAttachment(knowledgeId: number, attachmentId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const existing = await db.select({ id: knowledgeAttachment.id }).from(knowledgeAttachment)
        .where(and(eq(knowledgeAttachment.knowledgeId, knowledgeId), eq(knowledgeAttachment.attachmentId, attachmentId), eq(knowledgeAttachment.isDeleted, false)));
      if (existing.length > 0) return;
      await db.insert(knowledgeAttachment).values({ knowledgeId, attachmentId });
    });
  }

  async unlinkAttachment(knowledgeId: number, attachmentId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db.update(knowledgeAttachment)
        .set({ isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(and(eq(knowledgeAttachment.knowledgeId, knowledgeId), eq(knowledgeAttachment.attachmentId, attachmentId)));
    });
  }

  async findAttachmentIds(knowledgeId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db.select({ attachmentId: knowledgeAttachment.attachmentId }).from(knowledgeAttachment)
        .where(and(eq(knowledgeAttachment.knowledgeId, knowledgeId), eq(knowledgeAttachment.isDeleted, false)));
      return rows.map((r) => r.attachmentId);
    });
  }

  // --- task links ----------------------------------------------------------
  async linkTask(taskId: number, knowledgeId: number, attachedByPersonId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const existing = await db.select({ id: taskKnowledge.id }).from(taskKnowledge)
        .where(and(eq(taskKnowledge.taskId, taskId), eq(taskKnowledge.knowledgeId, knowledgeId), eq(taskKnowledge.isDeleted, false)));
      if (existing.length > 0) return;
      await db.insert(taskKnowledge).values({ taskId, knowledgeId, attachedByPersonId });
    });
  }

  async unlinkTask(taskId: number, knowledgeId: number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db.update(taskKnowledge)
        .set({ isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(and(eq(taskKnowledge.taskId, taskId), eq(taskKnowledge.knowledgeId, knowledgeId)));
    });
  }

  async findTaskIds(knowledgeId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db.select({ taskId: taskKnowledge.taskId }).from(taskKnowledge)
        .where(and(eq(taskKnowledge.knowledgeId, knowledgeId), eq(taskKnowledge.isDeleted, false)));
      return rows.map((r) => r.taskId);
    });
  }

  async findKnowledgeIdsForTask(taskId: number, ctx: IDBConfigOptions): Promise<number[]> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const rows = await db.select({ knowledgeId: taskKnowledge.knowledgeId }).from(taskKnowledge)
        .where(and(eq(taskKnowledge.taskId, taskId), eq(taskKnowledge.isDeleted, false)));
      return rows.map((r) => r.knowledgeId);
    });
  }
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest src/modules/business-logic-modules/module-knowledge/knowledge.repo.spec.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Build + lint**

Run: `npm run build && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/business-logic-modules/module-knowledge/knowledge.repo.ts src/modules/business-logic-modules/module-knowledge/knowledge.repo.spec.ts
git commit -m "feat(knowledge): repository (CRUD + share/link/attachment/task junctions)"
```

---

### Task 7: KnowledgeService — CRUD, read authorization, search

**Files:**
- Create: `src/modules/business-logic-modules/module-knowledge/knowledge.service.ts`
- Create: `src/modules/business-logic-modules/module-knowledge/knowledge.service.spec.ts`

**Interfaces:**
- Consumes: `KnowledgeRepository` (Task 6); `PersonRepository`, `TaskRepository`, `FileService` (injected); `assertAbility`, `subject`, `AppAbility`, `IUserSession`, `IDBConfigOptions`, `AppException`.
- Produces (this task): `create`, `requireById`, `requireBySlug`, `requireReadableById`, `requireReadableBySlug`, `requireReadable`, `requireWritable`, `update`, `remove`, `search`. (Link/attach methods are added in Task 8.)

- [ ] **Step 1: Write the failing service spec**

Create `src/modules/business-logic-modules/module-knowledge/knowledge.service.spec.ts`:
```ts
import { defineAbilityFor } from 'src/common/casl/ability.factory';
import { KnowledgeService } from './knowledge.service';

const ctx = { database_uri: 'x', schema_id: 'public', user_id: 7 } as any;
const userSession = (over: any = {}) => ({ id: 7, slug: 's', email: 'e@x.com', role: 'member', departmentId: null, teamId: null, ...over });

const makeRepo = () => ({
  create: jest.fn(async (i) => ({ id: 1, slug: 'k-1', visibility: i.visibility ?? 'private', ...i })),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  findByIds: jest.fn(async () => []),
  update: jest.fn(async (_id, p) => ({ id: 1, slug: 'k-1', title: 'T', ownerPersonId: 7, visibility: 'private', ...p })),
  delete: jest.fn(),
  query: jest.fn(async () => ({ data: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 }, error: null })),
  findShareePersonIds: jest.fn(async () => []),
  findSharedKnowledgeIdsForPerson: jest.fn(async () => []),
  findTaskIds: jest.fn(async () => []),
});

describe('KnowledgeService — read authorization', () => {
  let repo: any; let personRepo: any; let taskRepo: any; let files: any; let svc: KnowledgeService;
  beforeEach(() => {
    repo = makeRepo();
    personRepo = { findById: jest.fn(async () => ({ id: 2 })) };
    taskRepo = { findById: jest.fn() };
    files = { getLinkByIds: jest.fn(async () => []) };
    svc = new KnowledgeService(repo, personRepo, taskRepo, files);
  });

  const knol = (over: any) => ({ id: 1, slug: 'k-1', title: 'T', body: null, ownerPersonId: 1, visibility: 'private', ...over });

  it('owner can read own private knowledge', async () => {
    const ability = defineAbilityFor(userSession({ id: 9, role: 'member' }));
    await expect(svc.requireReadable(knol({ ownerPersonId: 9 }), ctx, ability, userSession({ id: 9 }))).resolves.toBeTruthy();
  });

  it('non-owner cannot read others private knowledge', async () => {
    const ability = defineAbilityFor(userSession({ id: 9, role: 'member' }));
    await expect(svc.requireReadable(knol({ ownerPersonId: 1, visibility: 'private' }), ctx, ability, userSession({ id: 9 }))).rejects.toBeDefined();
  });

  it('organization knowledge is readable by any member', async () => {
    const ability = defineAbilityFor(userSession({ id: 9, role: 'member' }));
    await expect(svc.requireReadable(knol({ ownerPersonId: 1, visibility: 'organization' }), ctx, ability, userSession({ id: 9 }))).resolves.toBeTruthy();
  });

  it('shared knowledge is readable by an explicit grantee (service-layer)', async () => {
    repo.findShareePersonIds.mockResolvedValue([9]);
    const ability = defineAbilityFor(userSession({ id: 9, role: 'member' }));
    await expect(svc.requireReadable(knol({ ownerPersonId: 1, visibility: 'shared' }), ctx, ability, userSession({ id: 9 }))).resolves.toBeTruthy();
  });

  it('shared knowledge is NOT readable by a non-grantee', async () => {
    repo.findShareePersonIds.mockResolvedValue([3]);
    const ability = defineAbilityFor(userSession({ id: 9, role: 'member' }));
    await expect(svc.requireReadable(knol({ ownerPersonId: 1, visibility: 'shared' }), ctx, ability, userSession({ id: 9 }))).rejects.toBeDefined();
  });

  it('private knowledge attached to a readable task grants task-scoped read', async () => {
    repo.findTaskIds.mockResolvedValue([100]);
    taskRepo.findById.mockResolvedValue({ id: 100, createdByPersonId: 9 }); // member can read any Task
    const ability = defineAbilityFor(userSession({ id: 9, role: 'member' }));
    await expect(svc.requireReadable(knol({ ownerPersonId: 1, visibility: 'private' }), ctx, ability, userSession({ id: 9 }))).resolves.toBeTruthy();
  });

  it('update is rejected for a non-owner member', async () => {
    repo.findBySlug.mockResolvedValue(knol({ ownerPersonId: 1 }));
    const ability = defineAbilityFor(userSession({ id: 9, role: 'member' }));
    await expect(svc.update('k-1', { title: 'New' }, ctx, ability)).rejects.toBeDefined();
  });

  it('create sets the owner from the session', async () => {
    await svc.create({ title: 'X' }, 7, ctx);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'X', ownerPersonId: 7 }), ctx);
  });

  it('search computes shared ids and unrestricted=false for members', async () => {
    repo.findSharedKnowledgeIdsForPerson.mockResolvedValue([5]);
    await svc.search({}, ctx, userSession({ id: 7, role: 'member' }));
    expect(repo.query).toHaveBeenCalledWith(expect.objectContaining({ requesterId: 7, sharedIds: [5], unrestricted: false }), ctx);
  });

  it('search is unrestricted for admin', async () => {
    await svc.search({}, ctx, userSession({ id: 7, role: 'admin' }));
    expect(repo.query).toHaveBeenCalledWith(expect.objectContaining({ unrestricted: true }), ctx);
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx jest src/modules/business-logic-modules/module-knowledge/knowledge.service.spec.ts`
Expected: FAIL — `Cannot find module './knowledge.service'`.

- [ ] **Step 3: Implement the service (CRUD + authorization + search)**

Create `src/modules/business-logic-modules/module-knowledge/knowledge.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { subject } from '@casl/ability';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { AppException } from 'src/utils/exception.provider';
import { AppAbility } from 'src/common/casl/ability.types';
import { assertAbility } from 'src/common/casl/assert-ability';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { IBaseQueryResult } from 'src/utils/shared/interface';
import { FileService } from 'src/modules/module-file-management/file.service';
import { PersonRepository } from '../module-person/person.repo';
import { TaskRepository } from '../module-task/task.repo';
import { KnowledgeRepository } from './knowledge.repo';
import {
  IKnowledgeEntity, IQueryKnowledgeParams, IUpdateKnowledge,
} from './knowledge.interface';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly repo: KnowledgeRepository,
    private readonly personRepo: PersonRepository,
    private readonly taskRepo: TaskRepository,
    private readonly files: FileService,
  ) {}

  async create(
    item: { title: string; body?: string | null; visibility?: 'private' | 'shared' | 'organization' },
    ownerPersonId: number,
    ctx: IDBConfigOptions,
  ): Promise<IKnowledgeEntity> {
    return this.repo.create({ ...item, ownerPersonId }, ctx);
  }

  async requireById(id: number, ctx: IDBConfigOptions): Promise<IKnowledgeEntity> {
    const entity = await this.repo.findById(id, ctx);
    if (!entity) AppException.notFound('Knowledge', id);
    return entity!;
  }

  async requireBySlug(slug: string, ctx: IDBConfigOptions): Promise<IKnowledgeEntity> {
    const entity = await this.repo.findBySlug(slug, ctx);
    if (!entity) AppException.notFound('Knowledge', slug);
    return entity!;
  }

  /**
   * Authorize a read. Readable if ANY of:
   *  1. CASL row rule allows it (owner / organization / admin),
   *  2. visibility='shared' AND the user is an explicit grantee,
   *  3. the entry is attached to a task the user can read.
   */
  async requireReadable(
    entity: IKnowledgeEntity, ctx: IDBConfigOptions, ability: AppAbility, user: IUserSession,
  ): Promise<IKnowledgeEntity> {
    if (ability.can('read', subject('Knowledge', entity as unknown as Record<string, unknown>))) return entity;

    if (entity.visibility === 'shared') {
      const grantees = await this.repo.findShareePersonIds(entity.id, ctx);
      if (grantees.includes(user.id)) return entity;
    }

    const taskIds = await this.repo.findTaskIds(entity.id, ctx);
    if (taskIds.length) {
      const tasks = await Promise.all(taskIds.map((id) => this.taskRepo.findById(id, ctx)));
      const readable = tasks.some(
        (t) => t && ability.can('read', subject('Task', t as unknown as Record<string, unknown>)),
      );
      if (readable) return entity;
    }

    AppException.throw('FORBIDDEN', 'You cannot view this knowledge');
  }

  async requireReadableById(id: number, ctx: IDBConfigOptions, ability: AppAbility, user: IUserSession): Promise<IKnowledgeEntity> {
    return this.requireReadable(await this.requireById(id, ctx), ctx, ability, user);
  }

  async requireReadableBySlug(slug: string, ctx: IDBConfigOptions, ability: AppAbility, user: IUserSession): Promise<IKnowledgeEntity> {
    return this.requireReadable(await this.requireBySlug(slug, ctx), ctx, ability, user);
  }

  /** Load by slug and assert the caller may write (owner or admin). */
  async requireWritableBySlug(slug: string, ctx: IDBConfigOptions, ability: AppAbility): Promise<IKnowledgeEntity> {
    const entity = await this.requireBySlug(slug, ctx);
    assertAbility(ability, 'update', 'Knowledge', entity, 'You cannot modify this knowledge');
    return entity;
  }

  async update(slug: string, payload: IUpdateKnowledge, ctx: IDBConfigOptions, ability: AppAbility): Promise<IKnowledgeEntity> {
    const existing = await this.requireWritableBySlug(slug, ctx, ability);
    return this.repo.update(existing.id, payload, ctx);
  }

  async remove(slug: string, ctx: IDBConfigOptions, ability: AppAbility): Promise<void> {
    const existing = await this.requireBySlug(slug, ctx);
    assertAbility(ability, 'delete', 'Knowledge', existing, 'You cannot delete this knowledge');
    await this.repo.delete(existing.id, ctx);
  }

  async search(params: IQueryKnowledgeParams, ctx: IDBConfigOptions, user: IUserSession): Promise<IBaseQueryResult> {
    const unrestricted = user.role === 'admin';
    const sharedIds = unrestricted ? [] : await this.repo.findSharedKnowledgeIdsForPerson(user.id, ctx);
    return this.repo.query({ ...params, requesterId: user.id, sharedIds, unrestricted }, ctx);
  }
}
```
Note: `update`/`remove`/`requireWritableBySlug` key off `slug` (the public id used by routes). `requireReadable*` likewise. The CASL `update`/`delete` checks reject `executive`/`manager`/`member` for entries they don't own (admin passes via `manage all`).

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest src/modules/business-logic-modules/module-knowledge/knowledge.service.spec.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/business-logic-modules/module-knowledge/knowledge.service.ts src/modules/business-logic-modules/module-knowledge/knowledge.service.spec.ts
git commit -m "feat(knowledge): service CRUD + read authorization + scoped search"
```

---

### Task 8: KnowledgeService — shares, links, attachments, task attach/detach

**Files:**
- Modify: `src/modules/business-logic-modules/module-knowledge/knowledge.service.ts`
- Modify: `src/modules/business-logic-modules/module-knowledge/knowledge.service.spec.ts`

**Interfaces:**
- Produces: `addShare`, `removeShare`, `addLink`, `removeLink`, `listLinks`, `attachFile`, `detachFile`, `listAttachments`, `attachToTask`, `detachFromTask`, `listForTask`. Adding the first share auto-promotes a `private` entry to `shared`.

- [ ] **Step 1: Add failing tests for sharing/auto-promote and attach**

In `src/modules/business-logic-modules/module-knowledge/knowledge.service.spec.ts`, add a new describe block (reusing the module-level `ctx`, `userSession`, and the existing top-of-file imports of `KnowledgeService` and `defineAbilityFor` from Task 7 — do **not** add new imports or `require`):
```ts
describe('KnowledgeService — shares & task attach', () => {
  let repo: any; let personRepo: any; let taskRepo: any; let files: any; let svc: KnowledgeService;
  const knol = (over: any) => ({ id: 1, slug: 'k-1', title: 'T', body: null, ownerPersonId: 7, visibility: 'private', ...over });

  beforeEach(() => {
    repo = {
      findBySlug: jest.fn(async () => knol({})),
      findById: jest.fn(async () => knol({})),
      update: jest.fn(async (_i: number, p: any) => knol(p)),
      linkShare: jest.fn(), unlinkShare: jest.fn(),
      addLink: jest.fn(async () => ({ id: 11, knowledgeId: 1, url: 'u', title: null })),
      removeLink: jest.fn(), findLinks: jest.fn(async () => []),
      linkAttachment: jest.fn(), unlinkAttachment: jest.fn(), findAttachmentIds: jest.fn(async () => [5]),
      linkTask: jest.fn(), unlinkTask: jest.fn(),
      findKnowledgeIdsForTask: jest.fn(async () => [1]), findByIds: jest.fn(async () => [knol({})]),
      findShareePersonIds: jest.fn(async () => []), findTaskIds: jest.fn(async () => []),
    };
    personRepo = { findById: jest.fn(async () => ({ id: 2 })) };
    taskRepo = { findById: jest.fn(async () => ({ id: 100, createdByPersonId: 7 })) };
    files = { getLinkByIds: jest.fn(async () => [{ id: 5, slug: 'a5', url: 'pic://5', mimetype: 'image/png', thumbnailPath: null }]) };
    svc = new KnowledgeService(repo, personRepo, taskRepo, files);
  });

  it('addShare on a private entry auto-promotes it to shared', async () => {
    const ability = defineAbilityFor(userSession({ id: 7, role: 'member' }));
    await svc.addShare('k-1', 2, ctx, ability);
    expect(personRepo.findById).toHaveBeenCalledWith(2, ctx);
    expect(repo.linkShare).toHaveBeenCalledWith(1, 2, ctx);
    expect(repo.update).toHaveBeenCalledWith(1, { visibility: 'shared' }, ctx);
  });

  it('addShare rejects a non-owner', async () => {
    repo.findBySlug.mockResolvedValue(knol({ ownerPersonId: 1 }));
    const ability = defineAbilityFor(userSession({ id: 7, role: 'member' }));
    await expect(svc.addShare('k-1', 2, ctx, ability)).rejects.toBeDefined();
  });

  it('listAttachments resolves attachment ids to urls', async () => {
    const ability = defineAbilityFor(userSession({ id: 7, role: 'member' }));
    const out = await svc.listAttachments('k-1', ctx, ability, userSession({ id: 7 }));
    expect(files.getLinkByIds).toHaveBeenCalledWith([5], ctx);
    expect(out[0].url).toBe('pic://5');
  });

  it('attachToTask records who attached', async () => {
    const ability = defineAbilityFor(userSession({ id: 7, role: 'member' }));
    await svc.attachToTask('k-1', 100, ctx, ability, userSession({ id: 7 }));
    expect(repo.linkTask).toHaveBeenCalledWith(100, 1, 7, ctx);
  });

  it('listForTask returns attached knowledge rows', async () => {
    const out = await svc.listForTask(100, ctx);
    expect(repo.findKnowledgeIdsForTask).toHaveBeenCalledWith(100, ctx);
    expect(out.map((k: any) => k.id)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/modules/business-logic-modules/module-knowledge/knowledge.service.spec.ts -t "shares & task attach"`
Expected: FAIL — methods undefined.

- [ ] **Step 3: Add the methods to `KnowledgeService`**

Append these methods inside the `KnowledgeService` class in `src/modules/business-logic-modules/module-knowledge/knowledge.service.ts`. Also add the import:
```ts
import { IKnowledgeAttachmentRef, IKnowledgeLink } from './knowledge.interface';
```
Methods:
```ts
  // --- shares (owner/admin only; first share promotes private → shared) -----
  async addShare(slug: string, personId: number, ctx: IDBConfigOptions, ability: AppAbility): Promise<void> {
    const entity = await this.requireWritableBySlug(slug, ctx, ability);
    const person = await this.personRepo.findById(personId, ctx);
    if (!person) AppException.notFound('Person', personId);
    await this.repo.linkShare(entity.id, personId, ctx);
    if (entity.visibility === 'private') {
      await this.repo.update(entity.id, { visibility: 'shared' }, ctx);
    }
  }

  async removeShare(slug: string, personId: number, ctx: IDBConfigOptions, ability: AppAbility): Promise<void> {
    const entity = await this.requireWritableBySlug(slug, ctx, ability);
    await this.repo.unlinkShare(entity.id, personId, ctx);
  }

  // --- links (owner/admin only) --------------------------------------------
  async addLink(slug: string, url: string, title: string | null, ctx: IDBConfigOptions, ability: AppAbility): Promise<IKnowledgeLink> {
    const entity = await this.requireWritableBySlug(slug, ctx, ability);
    return this.repo.addLink(entity.id, url, title, ctx);
  }

  async removeLink(slug: string, linkId: number, ctx: IDBConfigOptions, ability: AppAbility): Promise<void> {
    const entity = await this.requireWritableBySlug(slug, ctx, ability);
    await this.repo.removeLink(entity.id, linkId, ctx);
  }

  async listLinks(slug: string, ctx: IDBConfigOptions, ability: AppAbility, user: IUserSession): Promise<IKnowledgeLink[]> {
    const entity = await this.requireReadableBySlug(slug, ctx, ability, user);
    return this.repo.findLinks(entity.id, ctx);
  }

  // --- attachments (owner/admin to write; readable to list) ----------------
  async attachFile(slug: string, attachmentId: number, ctx: IDBConfigOptions, ability: AppAbility): Promise<void> {
    const entity = await this.requireWritableBySlug(slug, ctx, ability);
    const [att] = await this.files.getLinkByIds([attachmentId], ctx);
    if (!att) AppException.notFound('Attachment', attachmentId);
    await this.repo.linkAttachment(entity.id, attachmentId, ctx);
  }

  async detachFile(slug: string, attachmentId: number, ctx: IDBConfigOptions, ability: AppAbility): Promise<void> {
    const entity = await this.requireWritableBySlug(slug, ctx, ability);
    await this.repo.unlinkAttachment(entity.id, attachmentId, ctx);
  }

  async listAttachments(slug: string, ctx: IDBConfigOptions, ability: AppAbility, user: IUserSession): Promise<IKnowledgeAttachmentRef[]> {
    const entity = await this.requireReadableBySlug(slug, ctx, ability, user);
    const ids = await this.repo.findAttachmentIds(entity.id, ctx);
    return this.files.getLinkByIds(ids, ctx);
  }

  // --- task attach (read knowledge + read task to attach) ------------------
  async attachToTask(slug: string, taskId: number, ctx: IDBConfigOptions, ability: AppAbility, user: IUserSession): Promise<void> {
    const entity = await this.requireReadableBySlug(slug, ctx, ability, user);
    const task = await this.taskRepo.findById(taskId, ctx);
    if (!task) AppException.notFound('Task', taskId);
    assertAbility(ability, 'read', 'Task', task as unknown as object, 'You cannot attach to this task');
    await this.repo.linkTask(taskId, entity.id, user.id, ctx);
  }

  // --- task detach (knowledge owner/admin OR can update the task) ----------
  async detachFromTask(slug: string, taskId: number, ctx: IDBConfigOptions, ability: AppAbility): Promise<void> {
    const entity = await this.requireBySlug(slug, ctx);
    const task = await this.taskRepo.findById(taskId, ctx);
    if (!task) AppException.notFound('Task', taskId);
    const canByKnowledge = ability.can('update', subject('Knowledge', entity as unknown as Record<string, unknown>));
    const canByTask = ability.can('update', subject('Task', task as unknown as Record<string, unknown>));
    if (!canByKnowledge && !canByTask) {
      AppException.throw('FORBIDDEN', 'You cannot detach this knowledge from the task');
    }
    await this.repo.unlinkTask(taskId, entity.id, ctx);
  }

  /** Knowledge attached to a task. Caller must already be authorized to read the task. */
  async listForTask(taskId: number, ctx: IDBConfigOptions): Promise<IKnowledgeEntity[]> {
    const ids = await this.repo.findKnowledgeIdsForTask(taskId, ctx);
    return this.repo.findByIds(ids, ctx);
  }
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest src/modules/business-logic-modules/module-knowledge/knowledge.service.spec.ts`
Expected: PASS (Task 7 + Task 8 tests).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/business-logic-modules/module-knowledge/knowledge.service.ts src/modules/business-logic-modules/module-knowledge/knowledge.service.spec.ts
git commit -m "feat(knowledge): shares (auto-promote), links, attachments, task attach/detach"
```

---

### Task 9: Knowledge DTOs, controller & module wiring

**Files:**
- Create: `src/modules/business-logic-modules/module-knowledge/knowledge.dto.ts`
- Create: `src/modules/business-logic-modules/module-knowledge/knowledge.controller.ts`
- Create: `src/modules/business-logic-modules/module-knowledge/knowledge.module.ts`
- Modify: `src/modules/main.module.ts`

**Interfaces:**
- Consumes: `KnowledgeService` (Tasks 7-8); `PersonRepository`, `TaskRepository`, `FileManagementModule`.
- Produces: `KnowledgeController` routes under `/api/knowledge`; `KnowledgeModule` (exports `KnowledgeService`, `KnowledgeRepository`).

Controllers in this repo are thin delegators and are **not** unit-tested (no controller `.spec.ts` exists for person/task); behavior is covered by the service/repo specs. This task is verified by `npm run build` + `npm run lint` + the app booting without DI errors.

- [ ] **Step 1: Create the DTOs**

Create `src/modules/business-logic-modules/module-knowledge/knowledge.dto.ts`:
```ts
import { IsString, IsNumber, IsOptional, IsIn, IsUrl, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { KnowledgeVisibility } from './knowledge.interface';

const VISIBILITIES: KnowledgeVisibility[] = ['private', 'shared', 'organization'];

export class NewKnowledgeDTO {
  @ApiProperty() @IsString() @MinLength(1) title!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() body?: string | null;
  @ApiProperty({ required: false, enum: VISIBILITIES }) @IsOptional() @IsIn(VISIBILITIES) visibility?: KnowledgeVisibility;
}

export class UpdateKnowledgeDTO {
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() body?: string | null;
  @ApiProperty({ required: false, enum: VISIBILITIES }) @IsOptional() @IsIn(VISIBILITIES) visibility?: KnowledgeVisibility;
}

export class QueryKnowledgeDTO {
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Type(() => Number) ownerPersonId?: number;
  @ApiProperty({ required: false, enum: VISIBILITIES }) @IsOptional() @IsIn(VISIBILITIES) visibility?: KnowledgeVisibility;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Type(() => Number) page?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Type(() => Number) pageSize?: number;
}

export class FindKnowledgeBySlugDTO {
  @ApiProperty() @IsString() slug!: string;
}

export class KnowledgeShareDTO {
  @ApiProperty() @IsNumber() personId!: number;
}

export class KnowledgeLinkDTO {
  @ApiProperty() @IsUrl() url!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string | null;
}

export class KnowledgeAttachmentDTO {
  @ApiProperty() @IsNumber() attachmentId!: number;
}

export class AttachTaskDTO {
  @ApiProperty() @IsNumber() taskId!: number;
}
```

- [ ] **Step 2: Create the controller**

Create `src/modules/business-logic-modules/module-knowledge/knowledge.controller.ts`:
```ts
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import {
  NewKnowledgeDTO, UpdateKnowledgeDTO, QueryKnowledgeDTO, FindKnowledgeBySlugDTO,
  KnowledgeShareDTO, KnowledgeLinkDTO, KnowledgeAttachmentDTO, AttachTaskDTO,
} from './knowledge.dto';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { CheckPolicies } from 'src/common/casl/policy.types';
import { CurrentAbility } from 'src/common/casl/current-ability.decorator';
import { AppAbility } from 'src/common/casl/ability.types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('knowledge')
@Controller('knowledge')
export class KnowledgeController {
  constructor(
    private readonly service: KnowledgeService,
    private readonly ctx: DbContextService,
  ) {}

  @Post()
  @CheckPolicies((a) => a.can('create', 'Knowledge'))
  @ApiOperation({ summary: 'Create a knowledge entry' })
  async create(@CurrentUser() user: IUserSession, @Body() dto: NewKnowledgeDTO): Promise<IBaseResponse> {
    const created = await this.service.create(dto, user.id, this.ctx.forUser(user.id));
    return buildCreated(created, 'Knowledge created');
  }

  @Post('search')
  @CheckPolicies((a) => a.can('read', 'Knowledge'))
  @ApiOperation({ summary: 'Search knowledge visible to the current user' })
  async search(@CurrentUser() user: IUserSession, @Body() params: QueryKnowledgeDTO): Promise<IBaseQueryResult> {
    return this.service.search(params as any, this.ctx.forUser(user.id), user);
  }

  @Get(':slug')
  @CheckPolicies((a) => a.can('read', 'Knowledge'))
  @ApiOperation({ summary: 'Get a knowledge entry by slug' })
  async getBySlug(
    @CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility, @Param() params: FindKnowledgeBySlugDTO,
  ): Promise<IBaseResponse> {
    const result = await this.service.requireReadableBySlug(params.slug, this.ctx.forUser(user.id), ability, user);
    return buildOk(result, 'Knowledge found');
  }

  @Patch(':slug')
  @CheckPolicies((a) => a.can('update', 'Knowledge'))
  @ApiOperation({ summary: 'Update a knowledge entry (owner/admin)' })
  async update(
    @CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string, @Body() dto: UpdateKnowledgeDTO,
  ): Promise<IBaseResponse> {
    const updated = await this.service.update(slug, dto, this.ctx.forUser(user.id), ability);
    return buildOk(updated, 'Knowledge updated');
  }

  @Delete(':slug')
  @CheckPolicies((a) => a.can('delete', 'Knowledge'))
  @ApiOperation({ summary: 'Soft-delete a knowledge entry (owner/admin)' })
  async remove(
    @CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility, @Param('slug') slug: string,
  ): Promise<IBaseResponse> {
    await this.service.remove(slug, this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Knowledge deleted');
  }

  // --- shares ---------------------------------------------------------------
  @Post(':slug/shares')
  @CheckPolicies((a) => a.can('update', 'Knowledge'))
  @ApiOperation({ summary: 'Share a knowledge entry with a person' })
  async addShare(
    @CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string, @Body() dto: KnowledgeShareDTO,
  ): Promise<IBaseResponse> {
    await this.service.addShare(slug, dto.personId, this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Shared');
  }

  @Delete(':slug/shares/:personId')
  @CheckPolicies((a) => a.can('update', 'Knowledge'))
  @ApiOperation({ summary: 'Revoke a share' })
  async removeShare(
    @CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string, @Param('personId') personId: string,
  ): Promise<IBaseResponse> {
    await this.service.removeShare(slug, Number(personId), this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Share revoked');
  }

  // --- links ----------------------------------------------------------------
  @Post(':slug/links')
  @CheckPolicies((a) => a.can('update', 'Knowledge'))
  @ApiOperation({ summary: 'Add an external link' })
  async addLink(
    @CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string, @Body() dto: KnowledgeLinkDTO,
  ): Promise<IBaseResponse> {
    const link = await this.service.addLink(slug, dto.url, dto.title ?? null, this.ctx.forUser(user.id), ability);
    return buildCreated(link, 'Link added');
  }

  @Delete(':slug/links/:linkId')
  @CheckPolicies((a) => a.can('update', 'Knowledge'))
  @ApiOperation({ summary: 'Remove an external link' })
  async removeLink(
    @CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string, @Param('linkId') linkId: string,
  ): Promise<IBaseResponse> {
    await this.service.removeLink(slug, Number(linkId), this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Link removed');
  }

  @Get(':slug/links')
  @CheckPolicies((a) => a.can('read', 'Knowledge'))
  @ApiOperation({ summary: 'List external links' })
  async listLinks(
    @CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility, @Param('slug') slug: string,
  ): Promise<IBaseResponse> {
    const links = await this.service.listLinks(slug, this.ctx.forUser(user.id), ability, user);
    return buildOk(links, 'Links retrieved');
  }

  // --- attachments ----------------------------------------------------------
  @Post(':slug/attachments')
  @CheckPolicies((a) => a.can('update', 'Knowledge'))
  @ApiOperation({ summary: 'Attach an uploaded file' })
  async attachFile(
    @CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string, @Body() dto: KnowledgeAttachmentDTO,
  ): Promise<IBaseResponse> {
    await this.service.attachFile(slug, dto.attachmentId, this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Attachment added');
  }

  @Delete(':slug/attachments/:attachmentId')
  @CheckPolicies((a) => a.can('update', 'Knowledge'))
  @ApiOperation({ summary: 'Detach a file' })
  async detachFile(
    @CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string, @Param('attachmentId') attachmentId: string,
  ): Promise<IBaseResponse> {
    await this.service.detachFile(slug, Number(attachmentId), this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Attachment removed');
  }

  @Get(':slug/attachments')
  @CheckPolicies((a) => a.can('read', 'Knowledge'))
  @ApiOperation({ summary: 'List attachments with resolved preview URLs' })
  async listAttachments(
    @CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility, @Param('slug') slug: string,
  ): Promise<IBaseResponse> {
    const items = await this.service.listAttachments(slug, this.ctx.forUser(user.id), ability, user);
    return buildOk(items, 'Attachments retrieved');
  }

  // --- task attach/detach ---------------------------------------------------
  @Post(':slug/tasks')
  @CheckPolicies((a) => a.can('read', 'Knowledge'))
  @ApiOperation({ summary: 'Attach this knowledge to a task' })
  async attachToTask(
    @CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string, @Body() dto: AttachTaskDTO,
  ): Promise<IBaseResponse> {
    await this.service.attachToTask(slug, dto.taskId, this.ctx.forUser(user.id), ability, user);
    return buildOk(null, 'Attached to task');
  }

  @Delete(':slug/tasks/:taskId')
  @CheckPolicies((a) => a.can('read', 'Knowledge'))
  @ApiOperation({ summary: 'Detach this knowledge from a task' })
  async detachFromTask(
    @CurrentUser() user: IUserSession, @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string, @Param('taskId') taskId: string,
  ): Promise<IBaseResponse> {
    await this.service.detachFromTask(slug, Number(taskId), this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Detached from task');
  }
}
```

- [ ] **Step 3: Create the module**

Create `src/modules/business-logic-modules/module-knowledge/knowledge.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeRepository } from './knowledge.repo';
import { KnowledgeService } from './knowledge.service';
import { PersonRepository } from '../module-person/person.repo';
import { TaskRepository } from '../module-task/task.repo';
import { FileManagementModule } from 'src/modules/module-file-management/file.module';

@Module({
  imports: [FileManagementModule],
  controllers: [KnowledgeController],
  // PersonRepository/TaskRepository provided directly (each needs only the
  // global ApplicationDBProvider) to avoid importing PersonModule/TaskModule
  // and creating a cycle with TaskModule, which imports KnowledgeModule.
  providers: [KnowledgeRepository, KnowledgeService, PersonRepository, TaskRepository],
  exports: [KnowledgeService, KnowledgeRepository],
})
export class KnowledgeModule {}
```

- [ ] **Step 4: Wire into the app**

In `src/modules/main.module.ts`, import and register `KnowledgeModule`:
```ts
import { KnowledgeModule } from './business-logic-modules/module-knowledge/knowledge.module';
```
Add `KnowledgeModule,` to the `imports` array (e.g. after `TaskModule`).

- [ ] **Step 5: Build + lint**

Run: `npm run build && npm run lint`
Expected: no errors (compiles, DI graph resolves at module level).

- [ ] **Step 6: Boot check (DI graph resolves at runtime)**

Run: `npm run build` then confirm the app module instantiates without provider errors. If a quick smoke is desired and the dev DB/redis are up: `node dist/main` and confirm it logs startup, then stop it. (Skip if infra isn't available — the build + module wiring is the gate.)

- [ ] **Step 7: Commit**

```bash
git add src/modules/business-logic-modules/module-knowledge/knowledge.dto.ts src/modules/business-logic-modules/module-knowledge/knowledge.controller.ts src/modules/business-logic-modules/module-knowledge/knowledge.module.ts src/modules/main.module.ts
git commit -m "feat(knowledge): DTOs, controller, module wiring (/api/knowledge)"
```

---

### Task 10: Task-side route — `GET /tasks/:slug/knowledge`

**Files:**
- Modify: `src/modules/business-logic-modules/module-task/task.controller.ts`
- Modify: `src/modules/business-logic-modules/module-task/task.module.ts`

**Interfaces:**
- Consumes: `KnowledgeService.listForTask` (Task 8); `KnowledgeModule`.
- Produces: `GET /api/tasks/:slug/knowledge` returning knowledge attached to the task (task read is the gate; attaching already granted task-scoped read).

- [ ] **Step 1: Import `KnowledgeModule` into `TaskModule`**

In `src/modules/business-logic-modules/module-task/task.module.ts`:
```ts
import { KnowledgeModule } from '../module-knowledge/knowledge.module';
// ...
@Module({
  imports: [InitiativeModule, LabelModule, KnowledgeModule],
  controllers: [TaskController],
  providers: [TaskRepository, TaskService, PersonRepository],
  exports: [TaskRepository, TaskService],
})
export class TaskModule {}
```
(`KnowledgeModule` exports `KnowledgeService`. It does not import `TaskModule`, so there is no cycle.)

- [ ] **Step 2: Add the route to `TaskController`**

In `src/modules/business-logic-modules/module-task/task.controller.ts`:
- Add the import: `import { KnowledgeService } from '../module-knowledge/knowledge.service';`
- Inject it in the constructor:
```ts
  constructor(
    private readonly taskService: TaskService,
    private readonly knowledgeService: KnowledgeService,
    private readonly ctx: DbContextService,
  ) {}
```
- Add the handler (place it near the other `:slug` routes, **before** the `@Get(':id')` route so the literal path segment matches first):
```ts
  @Get('slug/:slug/knowledge')
  @CheckPolicies((a) => a.can('read', 'Task'))
  @ApiOperation({ summary: 'List knowledge attached to a task' })
  async listKnowledge(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param('slug') slug: string,
  ): Promise<IBaseResponse> {
    const ctx = this.ctx.forUser(user.id);
    const task = await this.taskService.requireBySlugAuthorized(slug, ctx, ability);
    const items = await this.knowledgeService.listForTask(task.id, ctx);
    return buildOk(items, 'Task knowledge retrieved');
  }
```
Route is `GET /api/tasks/slug/:slug/knowledge` — using the existing `slug/:slug` prefix convention already present on `TaskController` (`getBySlug` uses `@Get('slug/:slug')`), which avoids colliding with the numeric `@Get(':id')` route.

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint`
Expected: no errors; DI resolves (`KnowledgeService` available via `KnowledgeModule`).

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all specs pass (schema, casl, file-management, person, knowledge).

- [ ] **Step 5: Commit**

```bash
git add src/modules/business-logic-modules/module-task/task.controller.ts src/modules/business-logic-modules/module-task/task.module.ts
git commit -m "feat(task): GET /tasks/slug/:slug/knowledge (attached knowledge listing)"
```

---

## Final Verification

- [ ] **Build clean:** `npm run build` (from `backend/`) — no TypeScript errors.
- [ ] **Lint clean:** `npm run lint`.
- [ ] **All tests pass:** `npm test`.
- [ ] **Migrations present & committed:** two new `src/infra/application-db/migrations/00XX_*.sql` files — one altering `person`, one creating the knowledge tables + `knowledge_visibility` type.
- [ ] **Spec coverage:** person fields (Task 1), avatar resolution (Tasks 2-3), knowledge schema (Task 4), CASL privacy (Task 5), repo (Task 6), service auth + sharing/auto-promote + attach (Tasks 7-8), API surface (Task 9), task-side read route (Task 10).
