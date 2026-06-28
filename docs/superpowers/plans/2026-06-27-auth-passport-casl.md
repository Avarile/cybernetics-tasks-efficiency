# Authentication & Authorization (Passport + CASL) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the bespoke `jsonwebtoken`/`bcrypt` auth to NestJS Passport (local + jwt) with revocable access+refresh sessions, adopt CASL as the primary RBAC engine with ownership/team rules, close public registration in favor of admin provisioning, and extract `defaultFields` to its own file.

**Architecture:** Authentication = `passport-local` (login) + `passport-jwt` (route protection) + `@nestjs/jwt` (access-token signing); refresh tokens are opaque random strings whose SHA-256 hash is persisted in a new `auth_session` table (rotation + logout + revocation). Authorization = `@casl/ability`: a per-role static ability factory, enforced at the action level by a global `PoliciesGuard` reading `@CheckPolicies(...)`, and at the row level inside ownership-sensitive controller handlers via `ability.cannot(action, subject(Type, entity))` + `AppException`. Existing contracts (`IUserSession`, `@Public()`, `@CurrentUser()`, `Role` enum, response envelope, repo idiom) are preserved.

**Tech Stack:** NestJS 10, Drizzle ORM + PostgreSQL (`pg`), `@nestjs/passport@^10`, `passport-jwt@^4`, `passport-local@^1`, `@nestjs/jwt@^10`, `@casl/ability@^6`, `bcrypt` (already present), Jest + ts-jest.

## Global Constraints

- **Monorepo:** Yarn workspaces. Backend package name is `cybernetic-backend`; deps hoist to the **root** `node_modules`. Add deps with `yarn workspace cybernetic-backend add ...`. Run scripts with `yarn workspace cybernetic-backend <script>` (or `cd backend && yarn <script>`).
- **Repo idiom (every DB method):** acquire `const { dbConnection, client } = await this.<provider>.getTenantDBConnection(ctx)`, run the Drizzle query in `try`, `catch (e) { AppException.throw('DATABASE_QUERY_FAILED', e instanceof Error ? e.message : 'Database operation failed'); }`, `finally { client.release(); }`. Every repo method takes `ctx: IDBConfigOptions` as the last arg.
- **Errors:** raise via `AppException.throw(code, message)` from `src/utils/exception.provider.ts`. Valid codes: `DATABASE_QUERY_FAILED`, `RESOURCE_NOT_FOUND`, `RESOURCE_CONFLICT`, `VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`, `SYSTEM_INTERNAL_ERROR`. Auth failures use `UNAUTHORIZED`; authz failures use `FORBIDDEN`.
- **Controllers** return the `IBaseResponse` envelope via `buildOk(data, msg)` / `buildCreated(data, msg)`.
- **Schema:** Postgres; tables spread `...defaultFields` (serial `id` PK + uuid `slug` + timestamps + `isDeleted`/`isActive`); snake_case DB columns mapped to camelCase TS; timestamps `withTimezone:true, mode:'string'`; indexes named `<table>_<col>_index`. Never hand-write migration SQL — edit schema then `yarn db:generate` + `yarn db:migrate`.
- **DB context:** scope with `this.ctx.forUser(user.id)` (controllers) or `this.ctx.system()` (auth/seeder). `DbContextService` is global.
- **Preserve (no breaking change):** the `IUserSession` field set `{id, slug, email, role}` (new optional fields only), `@Public()`/`IS_PUBLIC_KEY`, `@CurrentUser()`, the `Role` enum, and the response envelope.
- **Tests:** Jest, `testRegex: .*\.spec\.ts$`, `moduleNameMapper: ^src/(.*)$ → <rootDir>/src/$1`. Unit tests mock env with `jest.mock('src/utils/env', () => ({ default: { ...required keys... } }))`. Run with `yarn workspace cybernetic-backend test`.
- **Versions:** keep Nest on the v10 line. Install `@nestjs/passport@^10` and `@nestjs/jwt@^10` (NOT v11).

---

## Task 1: Dependencies + auth env config

**Files:**
- Modify: root `package.json` lockfile (via yarn — do not hand-edit)
- Modify: `backend/src/utils/env.ts`
- Modify: `backend/.env.example`

**Interfaces:**
- Produces: env keys `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `REFRESH_COOKIE_NAME`, `COOKIE_SECURE` (boolean), `COOKIE_DOMAIN?` on the default export of `src/utils/env.ts`.

- [ ] **Step 1: Install runtime + dev dependencies**

```bash
yarn workspace cybernetic-backend add @nestjs/passport@^10 @nestjs/jwt@^10 passport@^0.7 passport-jwt@^4 passport-local@^1 @casl/ability@^6
yarn workspace cybernetic-backend add -D @types/passport-jwt@^4 @types/passport-local@^1
```

- [ ] **Step 2: Add auth/cookie env keys** in `backend/src/utils/env.ts` — replace the `// auth` block (lines 17–22) with:

```ts
  // auth
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('1d'), // legacy; retained so older mocks still parse
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  REFRESH_COOKIE_NAME: z.string().default('cyb_refresh'),
  COOKIE_SECURE: z.string().transform((v) => v === 'true').default('false'),
  COOKIE_DOMAIN: z.string().optional(),
  APP_SALT_ROUNDS: z.coerce.number().default(10),
  ADMIN_ACCOUNT: z.string(),
  ADMIN_ACCOUNT_PASSWORD: z.string(),
```

- [ ] **Step 3: Document the new keys** — append to `backend/.env.example` under the `# Auth` block:

```
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
REFRESH_COOKIE_NAME=cyb_refresh
COOKIE_SECURE=false
# COOKIE_DOMAIN=
```

- [ ] **Step 4: Verify install + env compiles**

Run: `yarn workspace cybernetic-backend build`
Expected: build succeeds; `node -e "require('@casl/ability'); require('@nestjs/passport')"` from repo root resolves with no error.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/env.ts backend/.env.example package.json yarn.lock
git commit -m "chore(auth): add passport/jwt/casl deps and auth env config"
```

---

## Task 2: Extract `defaultFields` into its own schema file

**Files:**
- Create: `backend/src/infra/application-db/schema/common.schema.ts`
- Modify: `backend/src/infra/application-db/schema/identity.schema.ts`
- Modify: `backend/src/infra/application-db/schema/okr.schema.ts:11`
- Modify: `backend/src/infra/application-db/schema/tracking.schema.ts:16`
- Modify: `backend/src/infra/application-db/schema/index.ts`

**Interfaces:**
- Produces: `export const defaultFields` from `schema/common.schema.ts` (identical column set; consumed by all schema files).

This is a pure refactor — `yarn db:generate` must produce **no** DDL diff afterward.

- [ ] **Step 1: Create `common.schema.ts`** with the moved object (verbatim columns):

```ts
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
```

- [ ] **Step 2: Remove `defaultFields` from `identity.schema.ts`** — delete its declaration (the `export const defaultFields = {...};` block) and the now-unused `serial`, `uuid` imports **only if** no longer referenced; add at the top:

```ts
import { defaultFields } from './common.schema';
```

Keep `boolean`, `timestamp`, `sql` imports only if still used elsewhere in the file (they are not after removal — drop unused ones to satisfy lint). Keep `index, integer, pgEnum, pgTable, uniqueIndex, varchar, text`.

- [ ] **Step 3: Repoint `okr.schema.ts:11`** — change `import { defaultFields } from './identity.schema';` to:

```ts
import { defaultFields } from './common.schema';
```

- [ ] **Step 4: Repoint `tracking.schema.ts:16`** — change `import { defaultFields } from './identity.schema';` to:

```ts
import { defaultFields } from './common.schema';
```

(Leave `import { initiativeStatus } from './okr.schema';` untouched.)

- [ ] **Step 5: Export from the barrel** — prepend to `schema/index.ts`:

```ts
export * from './common.schema';
```

- [ ] **Step 6: Verify no DDL drift + build**

Run: `yarn workspace cybernetic-backend build && cd backend && yarn db:generate`
Expected: build passes; drizzle prints `No schema changes, nothing to migrate` (or generates an empty/no migration). If a migration file IS produced, the move changed something — revert and retry. Delete any empty generated artifact.

- [ ] **Step 7: Commit**

```bash
git add backend/src/infra/application-db/schema/
git commit -m "refactor(db): extract defaultFields into common.schema.ts"
```

---

## Task 3: `auth_session` schema + interfaces + migration

**Files:**
- Create: `backend/src/infra/application-db/schema/auth.schema.ts`
- Create: `backend/src/infra/application-db/schema/auth.schema.spec.ts`
- Modify: `backend/src/infra/application-db/schema/index.ts`
- Modify: `backend/src/modules/module-auth/auth.interface.ts`
- Create: migration via `yarn db:generate`

**Interfaces:**
- Produces: `export const authSession` (Drizzle table); `ICreateAuthSession`, `IAuthSessionRecord` (from `auth.interface.ts`).

- [ ] **Step 1: Write a failing schema test** `auth.schema.spec.ts` (mirrors existing `*.schema.spec.ts` shape):

```ts
import { getTableConfig } from 'drizzle-orm/pg-core';
import { authSession } from './auth.schema';

describe('auth_session schema', () => {
  it('maps to the auth_session table with the expected columns', () => {
    const cfg = getTableConfig(authSession);
    expect(cfg.name).toBe('auth_session');
    const cols = cfg.columns.map((c) => c.name);
    expect(cols).toEqual(
      expect.arrayContaining([
        'person_id',
        'refresh_token_hash',
        'user_agent',
        'ip_address',
        'expires_at',
        'revoked_at',
        'id',
        'slug',
      ]),
    );
  });

  it('declares a unique index on refresh_token_hash', () => {
    const cfg = getTableConfig(authSession);
    const unique = cfg.indexes.find((i) => i.config.unique);
    expect(unique?.config.columns.map((c: any) => c.name)).toContain('refresh_token_hash');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn workspace cybernetic-backend test -- auth.schema`
Expected: FAIL — `Cannot find module './auth.schema'`.

- [ ] **Step 3: Create `auth.schema.ts`**

```ts
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
```

- [ ] **Step 4: Export from the barrel** — add to `schema/index.ts`:

```ts
export * from './auth.schema';
```

- [ ] **Step 5: Run the schema test to verify it passes**

Run: `yarn workspace cybernetic-backend test -- auth.schema`
Expected: PASS.

- [ ] **Step 6: Add record interfaces** to `backend/src/modules/module-auth/auth.interface.ts` — append:

```ts
export interface ICreateAuthSession {
  personId: number;
  refreshTokenHash: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: string; // ISO 8601
}

export interface IAuthSessionRecord {
  id: number;
  slug: string;
  personId: number;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
  isDeleted: boolean | null;
  isActive: boolean | null;
}
```

Also extend `IPersonRecord` in the same file to carry org placement (used by the JWT strategy in Task 9). Add these two fields:

```ts
  departmentId: number | null;
  teamId: number | null;
```

- [ ] **Step 7: Generate + apply the migration**

Run: `cd backend && yarn db:generate`
Expected: a new `000X_*.sql` creating `auth_session` with both indexes (and nothing else). Then:
Run: `cd backend && yarn db:migrate`
Expected: `Migrations complete.`; `auth_session` exists in the `COMPANY_SCHEMA` schema.

- [ ] **Step 8: Commit**

```bash
git add backend/src/infra/application-db/schema/ backend/src/modules/module-auth/auth.interface.ts
git commit -m "feat(db): add auth_session table + interfaces + migration"
```

---

## Task 4: Extend `IUserSession` with org placement

**Files:**
- Modify: `backend/src/modules/module-auth/current-user-module/session.interface.ts`

**Interfaces:**
- Produces: `IUserSession` now includes optional `departmentId: number | null` and `teamId: number | null` (consumed by the ability factory in Task 5 and the JWT strategy in Task 9).

- [ ] **Step 1: Extend the interface** (additive — existing fields unchanged):

```ts
export interface IUserSession {
  id: number;
  slug: string;
  email: string;
  role: 'admin' | 'manager' | 'member' | 'executive';
  departmentId?: number | null;
  teamId?: number | null;
}
```

- [ ] **Step 2: Verify build**

Run: `yarn workspace cybernetic-backend build`
Expected: PASS (additive optional fields break nothing).

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/module-auth/current-user-module/session.interface.ts
git commit -m "feat(auth): add departmentId/teamId to IUserSession"
```

---

## Task 5: CASL ability factory + types

**Files:**
- Create: `backend/src/common/casl/ability.types.ts`
- Create: `backend/src/common/casl/ability.factory.ts`
- Create: `backend/src/common/casl/ability.factory.spec.ts`

**Interfaces:**
- Consumes: `IUserSession` (Task 4).
- Produces: `AppAbility`, `AppAction`, `AppSubjectName` (types); `defineAbilityFor(user): AppAbility` (pure fn); `CaslAbilityFactory` (`@Injectable`, method `createForUser(user): AppAbility`).

- [ ] **Step 1: Write failing ability tests** `ability.factory.spec.ts`:

```ts
import { subject } from '@casl/ability';
import { defineAbilityFor } from './ability.factory';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';

const user = (over: Partial<IUserSession>): IUserSession => ({
  id: 1, slug: 's', email: 'e@x.com', role: 'member', departmentId: null, teamId: null, ...over,
});

describe('defineAbilityFor', () => {
  it('admin can manage everything', () => {
    const a = defineAbilityFor(user({ role: 'admin' }));
    expect(a.can('create', 'Objective')).toBe(true);
    expect(a.can('delete', 'Person')).toBe(true);
  });

  it('executive can read but not write', () => {
    const a = defineAbilityFor(user({ role: 'executive' }));
    expect(a.can('read', 'Objective')).toBe(true);
    expect(a.can('create', 'Objective')).toBe(false);
  });

  it('member cannot create objectives', () => {
    const a = defineAbilityFor(user({ role: 'member' }));
    expect(a.can('create', 'Objective')).toBe(false);
    expect(a.can('read', 'Objective')).toBe(true);
  });

  it('member can manage only their own initiatives', () => {
    const a = defineAbilityFor(user({ id: 7, role: 'member' }));
    expect(a.can('update', subject('Initiative', { ownerPersonId: 7 }))).toBe(true);
    expect(a.can('update', subject('Initiative', { ownerPersonId: 8 }))).toBe(false);
    expect(a.can('read', subject('Initiative', { ownerPersonId: 8 }))).toBe(false);
  });

  it('member can read only their own activity events (raw inputs access-controlled)', () => {
    const a = defineAbilityFor(user({ id: 7, role: 'member' }));
    expect(a.can('read', subject('ActivityEvent', { actorPersonId: 7 }))).toBe(true);
    expect(a.can('read', subject('ActivityEvent', { actorPersonId: 8 }))).toBe(false);
  });

  it('manager can manage their own objectives and their team objectives', () => {
    const a = defineAbilityFor(user({ id: 5, role: 'manager', teamId: 42 }));
    expect(a.can('update', subject('Objective', { ownerPersonId: 5 }))).toBe(true);
    expect(a.can('update', subject('Objective', { scope: 'team', scopeRefId: 42 }))).toBe(true);
    expect(a.can('update', subject('Objective', { ownerPersonId: 9, scope: 'org' }))).toBe(false);
    expect(a.can('read', 'ActivityEvent')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn workspace cybernetic-backend test -- ability.factory`
Expected: FAIL — `Cannot find module './ability.factory'`.

- [ ] **Step 3: Create `ability.types.ts`**

```ts
import { MongoAbility } from '@casl/ability';

export type AppAction = 'manage' | 'create' | 'read' | 'update' | 'delete';

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
  | 'all';

export type AppAbility = MongoAbility<[AppAction, AppSubjectName]>;
```

- [ ] **Step 4: Create `ability.factory.ts`** (rules use only real columns: `ownerPersonId` on objective/initiative, `decidedByPersonId` on intervention, `actorPersonId` on activity_event, `scope`/`scopeRefId` on objective, `id`/`teamId` on person):

```ts
import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { AppAbility } from './ability.types';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';

/**
 * Static per-role authorization rules. `manage` = all actions.
 * Conditions are matched against plain Drizzle rows tagged with `subject()`.
 */
export function defineAbilityFor(user: IUserSession): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  switch (user.role) {
    case 'admin':
      can('manage', 'all');
      break;

    case 'executive':
      can('read', 'all');
      break;

    case 'manager':
      can('read', 'all');
      can('manage', 'Objective', { ownerPersonId: user.id });
      if (user.teamId) {
        can('manage', 'Objective', { scope: 'team', scopeRefId: user.teamId });
      }
      can('manage', 'KeyResult');
      can('manage', 'Initiative');
      can('manage', 'AlignmentLink');
      can('manage', 'Intervention', { decidedByPersonId: user.id });
      break;

    case 'member':
      can('read', [
        'Objective',
        'KeyResult',
        'AlignmentLink',
        'Intervention',
        'Organization',
        'Department',
        'Team',
        'Person',
      ]);
      can('manage', 'Initiative', { ownerPersonId: user.id });
      can('create', 'ActivityEvent', { actorPersonId: user.id });
      can('read', 'ActivityEvent', { actorPersonId: user.id });
      can('update', 'Person', { id: user.id });
      break;
  }

  return build();
}

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: IUserSession): AppAbility {
    return defineAbilityFor(user);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn workspace cybernetic-backend test -- ability.factory`
Expected: PASS (all 6).

- [ ] **Step 6: Commit**

```bash
git add backend/src/common/casl/
git commit -m "feat(authz): add CASL ability factory + types"
```

---

## Task 6: `@CheckPolicies` decorator + `PoliciesGuard` + `@CurrentAbility` + `CaslModule`

**Files:**
- Create: `backend/src/common/casl/policy.types.ts`
- Create: `backend/src/common/casl/policies.guard.ts`
- Create: `backend/src/common/casl/policies.guard.spec.ts`
- Create: `backend/src/common/casl/current-ability.decorator.ts`
- Create: `backend/src/common/casl/casl.module.ts`

**Interfaces:**
- Consumes: `CaslAbilityFactory`, `defineAbilityFor`, `AppAbility` (Task 5).
- Produces: `CheckPolicies(...handlers)`, `PolicyHandler`, `CHECK_POLICIES_KEY`; `PoliciesGuard`; `CurrentAbility()` param decorator; `CaslModule` (`@Global`, exports `CaslAbilityFactory`).

- [ ] **Step 1: Create `policy.types.ts`**

```ts
import { SetMetadata } from '@nestjs/common';
import { AppAbility } from './ability.types';

export type PolicyHandler = (ability: AppAbility) => boolean;

export const CHECK_POLICIES_KEY = 'check_policies';

export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
```

- [ ] **Step 2: Write failing guard tests** `policies.guard.spec.ts`:

```ts
import { Reflector } from '@nestjs/core';
import { PoliciesGuard } from './policies.guard';
import { CaslAbilityFactory } from './ability.factory';

jest.mock('src/utils/env', () => ({ default: { JWT_SECRET: 'x' } }));

function ctxFor(user: any) {
  const req: any = { user };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('PoliciesGuard', () => {
  const factory = new CaslAbilityFactory();
  let reflector: jest.Mocked<Reflector>;
  let guard: PoliciesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    guard = new PoliciesGuard(reflector, factory);
  });

  it('allows routes with no @CheckPolicies metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(ctxFor({ role: 'member', id: 1 }))).toBe(true);
  });

  it('allows when every policy handler passes', () => {
    reflector.getAllAndOverride.mockReturnValue([(a: any) => a.can('read', 'Objective')]);
    expect(guard.canActivate(ctxFor({ role: 'member', id: 1 }))).toBe(true);
  });

  it('throws FORBIDDEN when a policy handler fails', () => {
    reflector.getAllAndOverride.mockReturnValue([(a: any) => a.can('create', 'Objective')]);
    expect(() => guard.canActivate(ctxFor({ role: 'member', id: 1 }))).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('throws UNAUTHORIZED when policies are required but req.user is absent', () => {
    reflector.getAllAndOverride.mockReturnValue([(a: any) => a.can('read', 'Objective')]);
    expect(() => guard.canActivate(ctxFor(undefined))).toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `yarn workspace cybernetic-backend test -- policies.guard`
Expected: FAIL — `Cannot find module './policies.guard'`.

- [ ] **Step 4: Create `policies.guard.ts`**

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from './ability.factory';
import { CHECK_POLICIES_KEY, PolicyHandler } from './policy.types';
import { AppException } from 'src/utils/exception.provider';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caslFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const handlers = this.reflector.getAllAndOverride<PolicyHandler[]>(CHECK_POLICIES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!handlers?.length) return true;

    const req = context.switchToHttp().getRequest();
    if (!req.user) AppException.throw('UNAUTHORIZED', 'Authentication required');

    const ability = this.caslFactory.createForUser(req.user);
    req.ability = ability; // cached for @CurrentAbility() row-level checks

    const ok = handlers.every((handler) => handler(ability));
    if (!ok) AppException.throw('FORBIDDEN', 'Insufficient permissions');
    return true;
  }
}
```

- [ ] **Step 5: Run guard tests to verify they pass**

Run: `yarn workspace cybernetic-backend test -- policies.guard`
Expected: PASS (all 4).

- [ ] **Step 6: Create `current-ability.decorator.ts`**

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AppAbility } from './ability.types';
import { defineAbilityFor } from './ability.factory';

/** Returns the request's CASL ability (built by PoliciesGuard, or lazily here). */
export const CurrentAbility = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AppAbility => {
    const req = ctx.switchToHttp().getRequest();
    if (!req.ability) req.ability = defineAbilityFor(req.user);
    return req.ability;
  },
);
```

- [ ] **Step 7: Create `casl.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { CaslAbilityFactory } from './ability.factory';

@Global()
@Module({
  providers: [CaslAbilityFactory],
  exports: [CaslAbilityFactory],
})
export class CaslModule {}
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/common/casl/
git commit -m "feat(authz): add PoliciesGuard, @CheckPolicies, @CurrentAbility, CaslModule"
```

---

## Task 7: `PasswordService`

**Files:**
- Create: `backend/src/modules/module-auth/password.service.ts`
- Create: `backend/src/modules/module-auth/password.service.spec.ts`

**Interfaces:**
- Produces: `PasswordService` (`@Injectable`) with `hash(plain): Promise<string>` and `compare(plain, hash): Promise<boolean>`.

- [ ] **Step 1: Write failing tests** `password.service.spec.ts`:

```ts
jest.mock('src/utils/env', () => ({ default: { APP_SALT_ROUNDS: 10 } }));
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const svc = new PasswordService();

  it('hashes to a non-plaintext value that verifies', async () => {
    const hash = await svc.hash('secret123');
    expect(hash).not.toBe('secret123');
    expect(await svc.compare('secret123', hash)).toBe(true);
  });

  it('returns false for a wrong password', async () => {
    const hash = await svc.hash('secret123');
    expect(await svc.compare('nope', hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn workspace cybernetic-backend test -- password.service`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `password.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import env from 'src/utils/env';

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, env.APP_SALT_ROUNDS);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn workspace cybernetic-backend test -- password.service`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/module-auth/password.service.*
git commit -m "feat(auth): add PasswordService (bcrypt wrapper)"
```

---

## Task 8: `TokenService`

**Files:**
- Create: `backend/src/modules/module-auth/token.service.ts`
- Create: `backend/src/modules/module-auth/token.service.spec.ts`

**Interfaces:**
- Consumes: `JwtService` (`@nestjs/jwt`), `IUserSession`.
- Produces: `TokenService` with `signAccessToken(user): string`, `generateRefreshToken(): { raw, hash }`, `hashRefresh(raw): string`, `refreshExpiryIso(): string`, `refreshTtlMs(): number`.

- [ ] **Step 1: Write failing tests** `token.service.spec.ts`:

```ts
jest.mock('src/utils/env', () => ({
  default: { JWT_SECRET: 'test-secret', JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '7d' },
}));
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';

describe('TokenService', () => {
  const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '15m' } });
  const svc = new TokenService(jwt);

  it('signs a verifiable access token carrying the session claims', () => {
    const token = svc.signAccessToken({ id: 1, slug: 's', email: 'e@x.com', role: 'member' } as any);
    const decoded = jwt.verify(token) as any;
    expect(decoded.id).toBe(1);
    expect(decoded.email).toBe('e@x.com');
    expect(decoded.role).toBe('member');
  });

  it('generates a refresh token whose stored hash is the sha256 of the raw value', () => {
    const { raw, hash } = svc.generateRefreshToken();
    expect(raw).toEqual(expect.any(String));
    expect(hash).toHaveLength(64); // sha256 hex
    expect(svc.hashRefresh(raw)).toBe(hash);
  });

  it('computes a refresh expiry roughly 7 days out', () => {
    const ms = svc.refreshTtlMs();
    expect(ms).toBe(7 * 24 * 60 * 60 * 1000);
    expect(new Date(svc.refreshExpiryIso()).getTime()).toBeGreaterThan(Date.now());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn workspace cybernetic-backend test -- token.service`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `token.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import env from 'src/utils/env';
import { IUserSession } from './current-user-module/session.interface';

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  signAccessToken(user: IUserSession): string {
    return this.jwt.sign({
      id: user.id,
      slug: user.slug,
      email: user.email,
      role: user.role,
    });
  }

  generateRefreshToken(): { raw: string; hash: string } {
    const raw = randomBytes(48).toString('base64url');
    return { raw, hash: this.hashRefresh(raw) };
  }

  hashRefresh(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  refreshTtlMs(): number {
    return this.ttlToMs(env.JWT_REFRESH_TTL);
  }

  refreshExpiryIso(): string {
    return new Date(Date.now() + this.refreshTtlMs()).toISOString();
  }

  private ttlToMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl.trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const n = Number(match[1]);
    const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]]!;
    return n * mult;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn workspace cybernetic-backend test -- token.service`
Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/module-auth/token.service.*
git commit -m "feat(auth): add TokenService (access JWT + opaque refresh hashing)"
```

---

## Task 9: `AuthSessionRepository`

**Files:**
- Create: `backend/src/modules/module-auth/auth-session.repo.ts`

**Interfaces:**
- Consumes: `ApplicationDBProvider`, `IDBConfigOptions`, `authSession` table, `ICreateAuthSession`, `IAuthSessionRecord`.
- Produces: `AuthSessionRepository` with `create(input, ctx)`, `findActiveByHash(hash, ctx)`, `revoke(id, ctx)`, `revokeAllForPerson(personId, ctx)`.

- [ ] **Step 1: Create `auth-session.repo.ts`** (follows the strict repo idiom from Global Constraints):

```ts
import { Injectable, Logger } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { authSession } from 'src/infra/application-db/schema/auth.schema';
import { AppException } from 'src/utils/exception.provider';
import { IAuthSessionRecord, ICreateAuthSession } from './auth.interface';

@Injectable()
export class AuthSessionRepository {
  private readonly logger = new Logger(AuthSessionRepository.name);

  constructor(private readonly db: ApplicationDBProvider) {}

  async create(input: ICreateAuthSession, ctx: IDBConfigOptions): Promise<IAuthSessionRecord> {
    const { dbConnection, client } = await this.db.getTenantDBConnection(ctx);
    try {
      const [row] = await dbConnection
        .insert(authSession)
        .values({
          personId: input.personId,
          refreshTokenHash: input.refreshTokenHash,
          userAgent: input.userAgent ?? null,
          ipAddress: input.ipAddress ?? null,
          expiresAt: input.expiresAt,
        })
        .returning();
      return row as IAuthSessionRecord;
    } catch (e) {
      AppException.throw('DATABASE_QUERY_FAILED', e instanceof Error ? e.message : 'Database operation failed');
    } finally {
      client.release();
    }
  }

  async findActiveByHash(hash: string, ctx: IDBConfigOptions): Promise<IAuthSessionRecord | null> {
    const { dbConnection, client } = await this.db.getTenantDBConnection(ctx);
    try {
      const [row] = await dbConnection
        .select()
        .from(authSession)
        .where(
          and(
            eq(authSession.refreshTokenHash, hash),
            isNull(authSession.revokedAt),
            gt(authSession.expiresAt, new Date().toISOString()),
          ),
        )
        .limit(1);
      return (row as IAuthSessionRecord) ?? null;
    } catch (e) {
      AppException.throw('DATABASE_QUERY_FAILED', e instanceof Error ? e.message : 'Database operation failed');
    } finally {
      client.release();
    }
  }

  async revoke(id: number, ctx: IDBConfigOptions): Promise<void> {
    const { dbConnection, client } = await this.db.getTenantDBConnection(ctx);
    try {
      await dbConnection
        .update(authSession)
        .set({ revokedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(authSession.id, id));
    } catch (e) {
      AppException.throw('DATABASE_QUERY_FAILED', e instanceof Error ? e.message : 'Database operation failed');
    } finally {
      client.release();
    }
  }

  async revokeAllForPerson(personId: number, ctx: IDBConfigOptions): Promise<void> {
    const { dbConnection, client } = await this.db.getTenantDBConnection(ctx);
    try {
      await dbConnection
        .update(authSession)
        .set({ revokedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(and(eq(authSession.personId, personId), isNull(authSession.revokedAt)));
    } catch (e) {
      AppException.throw('DATABASE_QUERY_FAILED', e instanceof Error ? e.message : 'Database operation failed');
    } finally {
      client.release();
    }
  }
}
```

- [ ] **Step 2: Verify build**

Run: `yarn workspace cybernetic-backend build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/module-auth/auth-session.repo.ts
git commit -m "feat(auth): add AuthSessionRepository (create/find/revoke)"
```

---

## Task 10: `JwtStrategy` + `JwtAuthGuard`

**Files:**
- Create: `backend/src/modules/module-auth/strategies/jwt.strategy.ts`
- Create: `backend/src/common/guards/jwt-auth.guard.ts`
- Create: `backend/src/common/guards/jwt-auth.guard.spec.ts`

**Interfaces:**
- Consumes: `PersonAccountRepository.findById`, `DbContextService`, `IUserSession`, `IS_PUBLIC_KEY`.
- Produces: `JwtStrategy` (passport `'jwt'`) returning `IUserSession`; `JwtAuthGuard` (extends `AuthGuard('jwt')`, honors `@Public()`, throws `UNAUTHORIZED`).

- [ ] **Step 1: Create `jwt.strategy.ts`** (reloads the person so deactivation/role changes take effect immediately and to populate `teamId`/`departmentId`):

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import env from 'src/utils/env';
import { AppException } from 'src/utils/exception.provider';
import { DbContextService } from 'src/infra/application-db/db-context';
import { PersonAccountRepository } from '../account.repo';
import { IUserSession } from '../current-user-module/session.interface';

interface IAccessTokenPayload {
  id: number;
  slug: string;
  email: string;
  role: 'admin' | 'manager' | 'member' | 'executive';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly accounts: PersonAccountRepository,
    private readonly ctx: DbContextService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_SECRET,
    });
  }

  async validate(payload: IAccessTokenPayload): Promise<IUserSession> {
    const person = await this.accounts.findById(payload.id, this.ctx.system());
    if (!person || person.isDeleted || !person.isActive) {
      AppException.throw('UNAUTHORIZED', 'Account is not active');
    }
    return {
      id: person!.id,
      slug: person!.slug,
      email: person!.email,
      role: person!.role,
      departmentId: person!.departmentId ?? null,
      teamId: person!.teamId ?? null,
    };
  }
}
```

- [ ] **Step 2: Write failing guard test** `jwt-auth.guard.spec.ts`:

```ts
jest.mock('src/utils/env', () => ({ default: { JWT_SECRET: 'x' } }));
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

function ctx(isPublic: boolean) {
  const reflector = { getAllAndOverride: () => isPublic } as unknown as Reflector;
  const exec = {
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
  return { guard: new JwtAuthGuard(reflector), exec };
}

describe('JwtAuthGuard', () => {
  it('bypasses authentication for @Public() routes', () => {
    const { guard, exec } = ctx(true);
    expect(guard.canActivate(exec)).toBe(true);
  });

  it('throws UNAUTHORIZED in handleRequest when no user is resolved', () => {
    const { guard } = ctx(false);
    expect(() => guard.handleRequest(null, null)).toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    );
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `yarn workspace cybernetic-backend test -- jwt-auth.guard`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `jwt-auth.guard.ts`**

```ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { AppException } from 'src/utils/exception.provider';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends PassportAuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(err: any, user: any): TUser {
    if (err || !user) {
      AppException.throw('UNAUTHORIZED', 'Authentication required');
    }
    return user as TUser;
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `yarn workspace cybernetic-backend test -- jwt-auth.guard`
Expected: PASS (both).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/module-auth/strategies/jwt.strategy.ts backend/src/common/guards/jwt-auth.guard.*
git commit -m "feat(auth): add passport JwtStrategy + JwtAuthGuard"
```

---

## Task 11: `LocalStrategy` + `LocalAuthGuard`

**Files:**
- Create: `backend/src/modules/module-auth/strategies/local.strategy.ts`
- Create: `backend/src/common/guards/local-auth.guard.ts`

**Interfaces:**
- Consumes: `AuthenticationService.validateCredentials` (defined in Task 12 — declared here as the dependency).
- Produces: `LocalStrategy` (passport `'local'`, `usernameField:'email'`); `LocalAuthGuard` (extends `AuthGuard('local')`, throws `UNAUTHORIZED`).

> Note: `LocalStrategy` references `AuthenticationService.validateCredentials(email, password): Promise<IUserSession>`, which Task 12 implements. Build will fail until Task 12 lands — these two tasks ship together. Implement Task 11 then Task 12 before running the build gate.

- [ ] **Step 1: Create `local.strategy.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthenticationService } from '../authentication.service';
import { IUserSession } from '../current-user-module/session.interface';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthenticationService) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  validate(email: string, password: string): Promise<IUserSession> {
    return this.authService.validateCredentials(email, password);
  }
}
```

- [ ] **Step 2: Create `local-auth.guard.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { AppException } from 'src/utils/exception.provider';

@Injectable()
export class LocalAuthGuard extends PassportAuthGuard('local') {
  handleRequest<TUser = any>(err: any, user: any): TUser {
    if (err || !user) {
      AppException.throw('UNAUTHORIZED', 'Invalid credentials');
    }
    return user as TUser;
  }
}
```

- [ ] **Step 3: Commit** (build gate runs after Task 12)

```bash
git add backend/src/modules/module-auth/strategies/local.strategy.ts backend/src/common/guards/local-auth.guard.ts
git commit -m "feat(auth): add passport LocalStrategy + LocalAuthGuard"
```

---

## Task 12: Rewrite `AuthenticationService` (validate / login / refresh / logout)

**Files:**
- Modify: `backend/src/modules/module-auth/authentication.service.ts` (full rewrite)
- Modify: `backend/src/modules/module-auth/authentication.service.spec.ts` (rewrite)

**Interfaces:**
- Consumes: `PersonAccountRepository`, `AuthSessionRepository`, `PasswordService`, `TokenService`, `DbContextService`, express `Request`/`Response`.
- Produces: `validateCredentials(email, password): Promise<IUserSession>`; `login(user, req, res): Promise<{ accessToken; user }>`; `refresh(req, res): Promise<{ accessToken }>`; `logout(req, res): Promise<void>`. **Removes** `register()`.

- [ ] **Step 1: Rewrite the service** (`authentication.service.ts`):

```ts
import { Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import env from 'src/utils/env';
import { AppException } from 'src/utils/exception.provider';
import { DbContextService } from 'src/infra/application-db/db-context';
import { PersonAccountRepository } from './account.repo';
import { AuthSessionRepository } from './auth-session.repo';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { IUserSession } from './current-user-module/session.interface';

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly accounts: PersonAccountRepository,
    private readonly sessions: AuthSessionRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly ctx: DbContextService,
  ) {}

  async validateCredentials(email: string, password: string): Promise<IUserSession> {
    const person = await this.accounts.findByEmail(email, this.ctx.system());
    if (!person || !person.passwordHash) AppException.throw('UNAUTHORIZED', 'Invalid credentials');
    const ok = await this.passwords.compare(password, person!.passwordHash!);
    if (!ok) AppException.throw('UNAUTHORIZED', 'Invalid credentials');
    return this.toSession(person!);
  }

  async login(user: IUserSession, req: Request, res: Response): Promise<{ accessToken: string; user: IUserSession }> {
    const accessToken = this.tokens.signAccessToken(user);
    await this.issueRefreshSession(user.id, req, res);
    return { accessToken, user };
  }

  async refresh(req: Request, res: Response): Promise<{ accessToken: string }> {
    const raw = req.cookies?.[env.REFRESH_COOKIE_NAME];
    if (!raw) AppException.throw('UNAUTHORIZED', 'Missing refresh token');

    const sys = this.ctx.system();
    const session = await this.sessions.findActiveByHash(this.tokens.hashRefresh(raw), sys);
    if (!session) AppException.throw('UNAUTHORIZED', 'Invalid refresh token');

    const person = await this.accounts.findById(session!.personId, sys);
    if (!person || person.isDeleted || !person.isActive) {
      await this.sessions.revoke(session!.id, sys);
      this.clearRefreshCookie(res);
      AppException.throw('UNAUTHORIZED', 'Account is not active');
    }

    // rotate: revoke the presented session, issue a fresh pair
    await this.sessions.revoke(session!.id, sys);
    const user = this.toSession(person!);
    const accessToken = this.tokens.signAccessToken(user);
    await this.issueRefreshSession(user.id, req, res);
    return { accessToken };
  }

  async logout(req: Request, res: Response): Promise<void> {
    const raw = req.cookies?.[env.REFRESH_COOKIE_NAME];
    if (raw) {
      const sys = this.ctx.system();
      const session = await this.sessions.findActiveByHash(this.tokens.hashRefresh(raw), sys);
      if (session) await this.sessions.revoke(session.id, sys);
    }
    this.clearRefreshCookie(res);
  }

  private async issueRefreshSession(personId: number, req: Request, res: Response): Promise<void> {
    const { raw, hash } = this.tokens.generateRefreshToken();
    await this.sessions.create(
      {
        personId,
        refreshTokenHash: hash,
        userAgent: (req.headers['user-agent'] as string) ?? null,
        ipAddress: req.ip ?? null,
        expiresAt: this.tokens.refreshExpiryIso(),
      },
      this.ctx.system(),
    );
    this.setRefreshCookie(res, raw);
  }

  private toSession(p: {
    id: number; slug: string; email: string;
    role: 'admin' | 'manager' | 'member' | 'executive';
    departmentId?: number | null; teamId?: number | null;
  }): IUserSession {
    return {
      id: p.id, slug: p.slug, email: p.email, role: p.role,
      departmentId: p.departmentId ?? null, teamId: p.teamId ?? null,
    };
  }

  private setRefreshCookie(res: Response, raw: string): void {
    res.cookie(env.REFRESH_COOKIE_NAME, raw, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.COOKIE_SECURE,
      domain: env.COOKIE_DOMAIN,
      path: '/api/auth',
      maxAge: this.tokens.refreshTtlMs(),
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(env.REFRESH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.COOKIE_SECURE,
      domain: env.COOKIE_DOMAIN,
      path: '/api/auth',
    });
  }
}
```

- [ ] **Step 2: Rewrite the service spec** (`authentication.service.spec.ts`) — replace the whole file:

```ts
jest.mock('src/utils/env', () => ({
  default: {
    JWT_SECRET: 'test-secret-key',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '7d',
    REFRESH_COOKIE_NAME: 'cyb_refresh',
    COOKIE_SECURE: false,
    COOKIE_DOMAIN: undefined,
    APP_SALT_ROUNDS: 10,
  },
}));

import { AuthenticationService } from './authentication.service';

const SYS = { database_uri: 'u', schema_id: 'public', user_id: 0 };

function deps() {
  const accounts = { findByEmail: jest.fn(), findById: jest.fn(), createPerson: jest.fn() } as any;
  const sessions = { create: jest.fn(), findActiveByHash: jest.fn(), revoke: jest.fn() } as any;
  const passwords = { compare: jest.fn(), hash: jest.fn() } as any;
  const tokens = {
    signAccessToken: jest.fn().mockReturnValue('access.jwt'),
    generateRefreshToken: jest.fn().mockReturnValue({ raw: 'raw-refresh', hash: 'hash-refresh' }),
    hashRefresh: jest.fn((r: string) => `hash-${r}`),
    refreshExpiryIso: jest.fn().mockReturnValue(new Date(Date.now() + 1000).toISOString()),
    refreshTtlMs: jest.fn().mockReturnValue(1000),
  } as any;
  const ctx = { system: jest.fn().mockReturnValue(SYS), forUser: jest.fn() } as any;
  return { accounts, sessions, passwords, tokens, ctx };
}

const res = () => ({ cookie: jest.fn(), clearCookie: jest.fn() } as any);
const req = (cookies: any = {}) => ({ headers: {}, ip: '127.0.0.1', cookies } as any);

describe('AuthenticationService', () => {
  it('validateCredentials returns a session on correct password', async () => {
    const d = deps();
    d.accounts.findByEmail.mockResolvedValue({ id: 3, slug: 's', email: 'u@x.com', role: 'member', passwordHash: 'h' });
    d.passwords.compare.mockResolvedValue(true);
    const svc = new AuthenticationService(d.accounts, d.sessions, d.passwords, d.tokens, d.ctx);
    await expect(svc.validateCredentials('u@x.com', 'pw')).resolves.toMatchObject({ id: 3, role: 'member' });
  });

  it('validateCredentials throws UNAUTHORIZED on wrong password', async () => {
    const d = deps();
    d.accounts.findByEmail.mockResolvedValue({ id: 3, passwordHash: 'h', role: 'member' });
    d.passwords.compare.mockResolvedValue(false);
    const svc = new AuthenticationService(d.accounts, d.sessions, d.passwords, d.tokens, d.ctx);
    await expect(svc.validateCredentials('u@x.com', 'bad')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('login signs an access token and persists a refresh session + cookie', async () => {
    const d = deps();
    const svc = new AuthenticationService(d.accounts, d.sessions, d.passwords, d.tokens, d.ctx);
    const r = res();
    const out = await svc.login({ id: 1, slug: 's', email: 'u@x.com', role: 'member' } as any, req(), r);
    expect(out.accessToken).toBe('access.jwt');
    expect(d.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 1, refreshTokenHash: 'hash-refresh' }),
      SYS,
    );
    expect(r.cookie).toHaveBeenCalledWith('cyb_refresh', 'raw-refresh', expect.objectContaining({ httpOnly: true }));
  });

  it('refresh rotates: revokes the old session and issues a new pair', async () => {
    const d = deps();
    d.sessions.findActiveByHash.mockResolvedValue({ id: 99, personId: 1 });
    d.accounts.findById.mockResolvedValue({ id: 1, slug: 's', email: 'u@x.com', role: 'member', isActive: true, isDeleted: false });
    const svc = new AuthenticationService(d.accounts, d.sessions, d.passwords, d.tokens, d.ctx);
    const out = await svc.refresh(req({ cyb_refresh: 'raw-refresh' }), res());
    expect(d.sessions.revoke).toHaveBeenCalledWith(99, SYS);
    expect(d.sessions.create).toHaveBeenCalled();
    expect(out.accessToken).toBe('access.jwt');
  });

  it('refresh throws UNAUTHORIZED when no active session matches', async () => {
    const d = deps();
    d.sessions.findActiveByHash.mockResolvedValue(null);
    const svc = new AuthenticationService(d.accounts, d.sessions, d.passwords, d.tokens, d.ctx);
    await expect(svc.refresh(req({ cyb_refresh: 'x' }), res())).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('logout revokes the matching session and clears the cookie', async () => {
    const d = deps();
    d.sessions.findActiveByHash.mockResolvedValue({ id: 99, personId: 1 });
    const svc = new AuthenticationService(d.accounts, d.sessions, d.passwords, d.tokens, d.ctx);
    const r = res();
    await svc.logout(req({ cyb_refresh: 'raw-refresh' }), r);
    expect(d.sessions.revoke).toHaveBeenCalledWith(99, SYS);
    expect(r.clearCookie).toHaveBeenCalledWith('cyb_refresh', expect.objectContaining({ path: '/api/auth' }));
  });
});
```

- [ ] **Step 3: Run service tests**

Run: `yarn workspace cybernetic-backend test -- authentication.service`
Expected: PASS (all 6).

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/module-auth/authentication.service.*
git commit -m "feat(auth): rewrite AuthenticationService for sessions (login/refresh/logout)"
```

---

## Task 13: Rewrite `AuthenticationController` + DTOs (remove register)

**Files:**
- Modify: `backend/src/modules/module-auth/authentication.controller.ts` (full rewrite)
- Modify: `backend/src/modules/module-auth/auth.dto.ts` (remove `RegisterDTO`)

**Interfaces:**
- Consumes: `AuthenticationService`, `LocalAuthGuard`, `@Public()`, `@CurrentUser()`, `LoginDTO`.
- Produces: routes `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`. **No** `POST /api/auth/register`.

- [ ] **Step 1: Trim `auth.dto.ts`** — remove `RegisterDTO` (and the now-unused `IsEnum`, `Role`, `IsOptional`, `MinLength` imports if unused). Final file:

```ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDTO {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
```

- [ ] **Step 2: Rewrite the controller** (`authentication.controller.ts`):

```ts
import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthenticationService } from './authentication.service';
import { LoginDTO } from './auth.dto';
import { IBaseResponse } from 'src/utils/shared/interface';
import { buildOk } from 'src/utils/shared/response.factory';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { LocalAuthGuard } from 'src/common/guards/local-auth.guard';
import { IUserSession } from './current-user-module/session.interface';

@ApiTags('auth')
@SkipThrottle({ default: false })
@Controller('auth')
export class AuthenticationController {
  constructor(private readonly authService: AuthenticationService) {}

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login with email + password' })
  @ApiBody({ type: LoginDTO })
  async login(
    @CurrentUser() user: IUserSession,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IBaseResponse> {
    const data = await this.authService.login(user, req, res);
    return buildOk(data, 'Login successful');
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate the access token using the refresh cookie' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IBaseResponse> {
    const data = await this.authService.refresh(req, res);
    return buildOk(data, 'Token refreshed');
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IBaseResponse> {
    await this.authService.logout(req, res);
    return buildOk(null, 'Logged out');
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  async me(@CurrentUser() user: IUserSession): Promise<IBaseResponse> {
    return buildOk(user, 'Current user');
  }
}
```

- [ ] **Step 3: Verify build**

Run: `yarn workspace cybernetic-backend build`
Expected: PASS (Task 11 `LocalStrategy` now resolves against the new service).

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/module-auth/authentication.controller.ts backend/src/modules/module-auth/auth.dto.ts
git commit -m "feat(auth): login/refresh/logout/me endpoints; remove public register"
```

---

## Task 14: Rewire `auth.module.ts`

**Files:**
- Modify: `backend/src/modules/module-auth/auth.module.ts`

**Interfaces:**
- Produces: `AuthModule` wiring Passport + Jwt + all auth providers; **exports** `PasswordService` (consumed by `PersonModule` in Task 16).

- [ ] **Step 1: Rewrite the module**

```ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import env from 'src/utils/env';
import { PersonAccountRepository } from './account.repo';
import { AuthSessionRepository } from './auth-session.repo';
import { AuthenticationService } from './authentication.service';
import { AuthenticationController } from './authentication.controller';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: env.JWT_SECRET,
      signOptions: { expiresIn: env.JWT_ACCESS_TTL },
    }),
  ],
  controllers: [AuthenticationController],
  providers: [
    PersonAccountRepository,
    AuthSessionRepository,
    AuthenticationService,
    PasswordService,
    TokenService,
    LocalStrategy,
    JwtStrategy,
  ],
  exports: [PasswordService],
})
export class AuthModule {}
```

- [ ] **Step 2: Verify build**

Run: `yarn workspace cybernetic-backend build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/module-auth/auth.module.ts
git commit -m "feat(auth): wire PassportModule + JwtModule + auth providers"
```

---

## Task 15: Swap global guards + register CASL + update barrel

**Files:**
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/common/index.ts`

**Interfaces:**
- Produces: global guard chain `JwtAuthGuard → RoleGuard → PoliciesGuard → ThrottlerGuard` (RoleGuard kept transiently until Task 19); `CaslModule` imported globally.

> RoleGuard stays registered until all controllers are migrated (Tasks 16–18) so unmigrated `@Roles(...)` routes keep their restriction. PoliciesGuard runs alongside it.

- [ ] **Step 1: Update `app.module.ts`** — swap imports and providers:

Replace the two guard imports (lines 11–12):
```ts
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RoleGuard } from './common/guards/role.guard';
import { PoliciesGuard } from './common/casl/policies.guard';
import { CaslModule } from './common/casl/casl.module';
```

Add `CaslModule` to `imports` (after `ApplicationDbModule`):
```ts
    ApplicationDbModule,
    CaslModule,
    MainModule,
```

Replace the `APP_GUARD` provider lines with:
```ts
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
    { provide: APP_GUARD, useClass: PoliciesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
```

- [ ] **Step 2: Update `common/index.ts`** — export the new guards + CASL primitives (keep existing exports for now):

```ts
export { AuthGuard } from './guards/auth.guard';
export { RoleGuard } from './guards/role.guard';
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { LocalAuthGuard } from './guards/local-auth.guard';
export { GlobalExceptionFilter } from './filters/exception.filter';
export { ResponseInterceptor } from './interceptors/response.interceptor';
export { Role, Roles, ROLES_KEY } from './decorators/roles.decorator';
export { CurrentUser } from './decorators/current-user.decorator';
export { IS_PUBLIC_KEY, Public } from './decorators/public.decorator';
export { CheckPolicies, CHECK_POLICIES_KEY } from './casl/policy.types';
export { CurrentAbility } from './casl/current-ability.decorator';
export { CaslAbilityFactory } from './casl/ability.factory';
export type { AppAbility } from './casl/ability.types';
```

- [ ] **Step 3: Verify build + boot**

Run: `yarn workspace cybernetic-backend build`
Expected: PASS.
Run (smoke): `cd backend && yarn db:migrate && yarn seed:admin` then `yarn start:dev` briefly — app boots, no DI errors; `GET /api/health` → 200 (health is `@Public`). Stop the server.

- [ ] **Step 4: Commit**

```bash
git add backend/src/app.module.ts backend/src/common/index.ts
git commit -m "feat(auth): global JwtAuthGuard + PoliciesGuard; register CaslModule"
```

---

## Task 16: Admin user provisioning + migrate Person controller to CASL

**Files:**
- Modify: `backend/src/modules/business-logic-modules/module-person/person.dto.ts` (add `CreateUserDTO`)
- Modify: `backend/src/modules/business-logic-modules/module-person/person.controller.ts`
- Modify: `backend/src/modules/business-logic-modules/module-person/person.module.ts`

**Interfaces:**
- Consumes: `PasswordService` (via `AuthModule` export), `CaslAbilityFactory`/`@CheckPolicies`/`@CurrentAbility`, `subject` from `@casl/ability`.
- Produces: `POST /api/persons` is admin-only and hashes the password; all Person routes gated by `@CheckPolicies`.

- [ ] **Step 1: Add `CreateUserDTO`** to `person.dto.ts` (after `NewPersonDTO`):

```ts
export class CreateUserDTO {
  @ApiProperty({ description: 'Person full name', required: true })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ description: 'Person email address', required: true })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Initial password (min 8 chars)', required: true })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ description: 'Person role', required: true, enum: PersonRole })
  @IsEnum(PersonRole)
  role!: 'admin' | 'manager' | 'member' | 'executive';

  @ApiProperty({ description: 'Department ID', required: false })
  @IsOptional()
  @IsNumber()
  departmentId?: number | null;

  @ApiProperty({ description: 'Team ID', required: false })
  @IsOptional()
  @IsNumber()
  teamId?: number | null;
}
```

- [ ] **Step 2: Import `PasswordService` into PersonModule** — update `person.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PersonController } from './person.controller';
import { PersonRepository } from './person.repo';
import { PersonService } from './person.service';
import { AuthModule } from 'src/modules/module-auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PersonController],
  providers: [PersonRepository, PersonService],
  exports: [PersonRepository, PersonService],
})
export class PersonModule {}
```

- [ ] **Step 3: Rewrite `person.controller.ts`** — swap `@Roles`→`@CheckPolicies`, inject `PasswordService`, hash on create, add a row-level check on update:

```ts
import { Body, Controller, Delete, Get, Logger, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { subject } from '@casl/ability';
import { PersonService } from './person.service';
import { CreateUserDTO, UpdatePersonDTO, QueryPersonDTO, FindPersonByIdDTO, FindPersonByNameDTO, FindPersonBySlugDTO } from './person.dto';
import { IBaseQueryResult, IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { CheckPolicies } from 'src/common/casl/policy.types';
import { CurrentAbility } from 'src/common/casl/current-ability.decorator';
import { AppAbility } from 'src/common/casl/ability.types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';
import { PasswordService } from 'src/modules/module-auth/password.service';
import { AppException } from 'src/utils/exception.provider';

@ApiTags('persons')
@Controller('persons')
export class PersonController {
  private readonly logger = new Logger(PersonController.name);

  constructor(
    private readonly personService: PersonService,
    private readonly passwords: PasswordService,
    private readonly ctx: DbContextService,
  ) {}

  @Post()
  @CheckPolicies((a) => a.can('create', 'Person'))
  @ApiOperation({ summary: 'Create a new user (admin only)' })
  @ApiResponse({ status: 201, description: 'Person created successfully' })
  async createPerson(@CurrentUser() user: IUserSession, @Body() dto: CreateUserDTO): Promise<IBaseResponse> {
    const passwordHash = await this.passwords.hash(dto.password);
    const result = await this.personService.create(
      { name: dto.name, email: dto.email, role: dto.role, departmentId: dto.departmentId ?? null, teamId: dto.teamId ?? null, passwordHash },
      this.ctx.forUser(user.id),
    );
    const { passwordHash: _omit, ...safe } = result as Record<string, unknown>;
    return buildCreated(safe, 'Person created successfully');
  }

  @Delete(':id')
  @CheckPolicies((a) => a.can('delete', 'Person'))
  @ApiOperation({ summary: 'Soft-delete a person' })
  async deletePerson(@CurrentUser() user: IUserSession, @Param() params: FindPersonByIdDTO): Promise<IBaseResponse> {
    await this.personService.remove(params.id, this.ctx.forUser(user.id));
    return buildOk(null, 'Person deleted successfully');
  }

  @Patch(':id')
  @CheckPolicies((a) => a.can('update', 'Person'))
  @ApiOperation({ summary: 'Update a person' })
  async updatePerson(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindPersonByIdDTO,
    @Body() dto: UpdatePersonDTO,
  ): Promise<IBaseResponse> {
    const existing = await this.personService.requireById(params.id, this.ctx.forUser(user.id));
    if (ability.cannot('update', subject('Person', existing as Record<string, unknown>))) {
      AppException.throw('FORBIDDEN', 'You cannot update this person');
    }
    const updated = await this.personService.update(params.id, dto, this.ctx.forUser(user.id));
    return buildOk(updated, 'Person updated successfully');
  }

  @Get()
  @CheckPolicies((a) => a.can('read', 'Person'))
  @ApiOperation({ summary: 'Fetch all non-deleted persons' })
  async getAllPersons(@CurrentUser() user: IUserSession): Promise<IBaseResponse> {
    const data = await this.personService.queryAll(this.ctx.forUser(user.id));
    return buildOk(data, `Fetched ${data.length} persons`);
  }

  @Post('search')
  @CheckPolicies((a) => a.can('read', 'Person'))
  @ApiOperation({ summary: 'Search persons with filters' })
  async searchPersons(@CurrentUser() user: IUserSession, @Body() searchParams: QueryPersonDTO): Promise<IBaseQueryResult> {
    return this.personService.search(searchParams, this.ctx.forUser(user.id));
  }

  @Get('name/:name')
  @CheckPolicies((a) => a.can('read', 'Person'))
  @ApiOperation({ summary: 'Get a person by name' })
  async getPersonByName(@CurrentUser() user: IUserSession, @Param() params: FindPersonByNameDTO): Promise<IBaseResponse> {
    const result = await this.personService.requireByName(params.name, this.ctx.forUser(user.id));
    return buildOk(result, 'Person found');
  }

  @Get('slug/:slug')
  @CheckPolicies((a) => a.can('read', 'Person'))
  @ApiOperation({ summary: 'Get a person by slug' })
  async getPersonBySlug(@CurrentUser() user: IUserSession, @Param() params: FindPersonBySlugDTO): Promise<IBaseResponse> {
    const result = await this.personService.requireBySlug(params.slug, this.ctx.forUser(user.id));
    return buildOk(result, 'Person found');
  }

  @Get(':id')
  @CheckPolicies((a) => a.can('read', 'Person'))
  @ApiOperation({ summary: 'Get a person by ID' })
  async getPersonById(@CurrentUser() user: IUserSession, @Param() params: FindPersonByIdDTO): Promise<IBaseResponse> {
    const result = await this.personService.requireById(params.id, this.ctx.forUser(user.id));
    return buildOk(result, 'Person found');
  }
}
```

- [ ] **Step 4: Verify build**

Run: `yarn workspace cybernetic-backend build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/business-logic-modules/module-person/
git commit -m "feat(authz): admin-only user provisioning + CASL on person routes"
```

---

## Task 17: Migrate OKR-domain controllers to CASL (+ row-level checks)

**Files:**
- Modify: `module-objective/objective.controller.ts`
- Modify: `module-key-result/key-result.controller.ts`
- Modify: `module-initiative/initiative.controller.ts`
- Modify: `module-alignment/alignment.controller.ts`
- Modify: `module-intervention/intervention.controller.ts`

**Interfaces:**
- Produces: these controllers gated by `@CheckPolicies`; ownership-sensitive single-resource handlers add a row-level `ability.cannot(...)` check.

**Transformation rule (apply to each handler in every listed controller):**
1. Remove the `import { Roles, Role } from 'src/common/decorators/roles.decorator';` line.
2. Add:
```ts
import { CheckPolicies } from 'src/common/casl/policy.types';
import { CurrentAbility } from 'src/common/casl/current-ability.decorator';
import { AppAbility } from 'src/common/casl/ability.types';
import { subject } from '@casl/ability';
```
3. Replace each handler's `@Roles(...)` line per this map (`Subject` = the controller's entity: `Objective`, `KeyResult`, `Initiative`, `AlignmentLink`, `Intervention`):
   - create/`@Post()` → `@CheckPolicies((a) => a.can('create', '<Subject>'))`
   - update/`@Patch(':id')` → `@CheckPolicies((a) => a.can('update', '<Subject>'))`
   - delete/`@Delete(':id')` → `@CheckPolicies((a) => a.can('delete', '<Subject>'))`
   - every read (`@Get(...)`, `@Post('search')`, `@Post('scope')`, owner/slug/id getters) → `@CheckPolicies((a) => a.can('read', '<Subject>'))`

- [ ] **Step 1: Migrate `objective.controller.ts`** — apply the rule; additionally add row-level checks to update and delete (objective carries `ownerPersonId`/`scope`/`scopeRefId`). Final create/update/delete handlers:

```ts
  @Post()
  @CheckPolicies((a) => a.can('create', 'Objective'))
  @ApiOperation({ summary: 'Create a new objective' })
  @ApiResponse({ status: 201, description: 'Objective created successfully' })
  async createObjective(@CurrentUser() user: IUserSession, @Body() dto: NewObjectiveDTO): Promise<IBaseResponse> {
    const result = await this.objectiveService.create(dto, this.ctx.forUser(user.id));
    return buildCreated(result, 'Objective created successfully');
  }

  @Delete(':id')
  @CheckPolicies((a) => a.can('delete', 'Objective'))
  @ApiOperation({ summary: 'Soft-delete an objective' })
  async deleteObjective(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindObjectiveByIdDTO,
  ): Promise<IBaseResponse> {
    const existing = await this.objectiveService.requireById(params.id, this.ctx.forUser(user.id));
    if (ability.cannot('delete', subject('Objective', existing as Record<string, unknown>))) {
      AppException.throw('FORBIDDEN', 'You cannot delete this objective');
    }
    await this.objectiveService.remove(params.id, this.ctx.forUser(user.id));
    return buildOk(null, 'Objective deleted successfully');
  }

  @Patch(':id')
  @CheckPolicies((a) => a.can('update', 'Objective'))
  @ApiOperation({ summary: 'Update an objective' })
  async updateObjective(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindObjectiveByIdDTO,
    @Body() dto: UpdateObjectiveDTO,
  ): Promise<IBaseResponse> {
    const existing = await this.objectiveService.requireById(params.id, this.ctx.forUser(user.id));
    if (ability.cannot('update', subject('Objective', existing as Record<string, unknown>))) {
      AppException.throw('FORBIDDEN', 'You cannot update this objective');
    }
    const updated = await this.objectiveService.update(params.id, dto, this.ctx.forUser(user.id));
    return buildOk(updated, 'Objective updated successfully');
  }
```
All read handlers in this controller become `@CheckPolicies((a) => a.can('read', 'Objective'))`.

- [ ] **Step 2: Migrate `initiative.controller.ts`** — apply the rule with `<Subject>` = `Initiative`. Initiatives are member-owned, so add a row-level check to **read-by-id, read-by-slug, update, and delete** (member may touch only their own; `initiative` carries `ownerPersonId`). Pattern for each (action = `read`/`update`/`delete` to match the handler):

```ts
  @Get(':id')
  @CheckPolicies((a) => a.can('read', 'Initiative'))
  @ApiOperation({ summary: 'Get an initiative by ID' })
  async getInitiativeById(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindInitiativeByIdDTO,
  ): Promise<IBaseResponse> {
    const existing = await this.initiativeService.requireById(params.id, this.ctx.forUser(user.id));
    if (ability.cannot('read', subject('Initiative', existing as Record<string, unknown>))) {
      AppException.throw('FORBIDDEN', 'You cannot view this initiative');
    }
    return buildOk(existing, 'Initiative found');
  }
```
Apply the same `requireById`/`requireBySlug`-then-check shape to update (`'update'`) and delete (`'delete'`). List/search/owner endpoints stay action-level read only (row filtering of lists is a documented follow-up). Use the controller's actual service method + DTO names (read the file first).

- [ ] **Step 3: Migrate `key-result.controller.ts`, `alignment.controller.ts`, `intervention.controller.ts`** — apply the transformation rule only (no extra row checks for KR/alignment; for intervention, manager ownership is enforced by the `decidedByPersonId` CASL condition at action level — optionally add a row check on update/delete mirroring the objective pattern with `subject('Intervention', existing)`).

- [ ] **Step 4: Verify build**

Run: `yarn workspace cybernetic-backend build`
Expected: PASS. Grep check — no `@Roles(` remains in these five controllers:
Run: `cd backend && grep -rl "@Roles(" src/modules/business-logic-modules/module-objective src/modules/business-logic-modules/module-key-result src/modules/business-logic-modules/module-initiative src/modules/business-logic-modules/module-alignment src/modules/business-logic-modules/module-intervention || echo "clean"`
Expected: `clean`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/business-logic-modules/module-objective backend/src/modules/business-logic-modules/module-key-result backend/src/modules/business-logic-modules/module-initiative backend/src/modules/business-logic-modules/module-alignment backend/src/modules/business-logic-modules/module-intervention
git commit -m "feat(authz): migrate OKR-domain controllers to CASL policies"
```

---

## Task 18: Migrate remaining controllers to CASL

**Files:**
- Modify: `module-organization/organization.controller.ts`
- Modify: `module-department/department.controller.ts`
- Modify: `module-team/team.controller.ts`
- Modify: `module-tracking/tracking.controller.ts`

**Interfaces:**
- Produces: org/department/team/tracking controllers gated by `@CheckPolicies`.

Apply the same transformation rule as Task 17, with `<Subject>` = `Organization`, `Department`, `Team`, and (for tracking) `ActivityEvent`.

- [ ] **Step 1: Migrate `organization`, `department`, `team` controllers** — mechanical `@Roles`→`@CheckPolicies` per the create/update/delete/read map. (Read these files first to use their real handler/DTO names.)

- [ ] **Step 2: Migrate `tracking.controller.ts`** — map create event → `@CheckPolicies((a) => a.can('create', 'ActivityEvent'))`, reads → `a.can('read', 'ActivityEvent')`. For member raw-input access control, add a row-level check on any single-event read and on create (the actor must be the current user). Create example:

```ts
  // inside the create handler, after building the event dto:
  if (ability.cannot('create', subject('ActivityEvent', { actorPersonId: dto.actorPersonId }))) {
    AppException.throw('FORBIDDEN', 'You can only record your own activity');
  }
```
For single-event reads, load the event then `ability.cannot('read', subject('ActivityEvent', event))`. (Aggregate/projection read endpoints stay action-level for v1.)

- [ ] **Step 3: Verify build + no stray `@Roles`**

Run: `yarn workspace cybernetic-backend build`
Run: `cd backend && grep -rl "@Roles(" src/modules/business-logic-modules || echo "clean"`
Expected: build PASS; grep prints `clean`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/business-logic-modules/module-organization backend/src/modules/business-logic-modules/module-department backend/src/modules/business-logic-modules/module-team backend/src/modules/business-logic-modules/module-tracking
git commit -m "feat(authz): migrate org/department/team/tracking controllers to CASL"
```

---

## Task 19: Retire RoleGuard/AuthGuard + update seeder + barrel cleanup

**Files:**
- Modify: `backend/src/app.module.ts` (drop RoleGuard from globals)
- Delete: `backend/src/common/guards/auth.guard.ts`, `backend/src/common/guards/auth.guard.spec.ts`
- Delete: `backend/src/common/guards/role.guard.ts`, `backend/src/common/guards/role.guard.spec.ts`
- Modify: `backend/src/common/decorators/roles.decorator.ts` (keep `Role`, drop `Roles`/`ROLES_KEY`)
- Modify: `backend/src/common/index.ts`
- Modify: `backend/src/infra/application-db/seeder/seeder-admin.ts`

**Interfaces:**
- Produces: global guard chain `JwtAuthGuard → PoliciesGuard → ThrottlerGuard`; `Role` enum retained as the canonical role list; admin seeder hashes via `PasswordService`.

- [ ] **Step 1: Remove RoleGuard from `app.module.ts`** — delete its import and its `{ provide: APP_GUARD, useClass: RoleGuard }` line. Final guard providers:

```ts
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PoliciesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
```

- [ ] **Step 2: Delete the obsolete guards + their specs**

```bash
git rm backend/src/common/guards/auth.guard.ts backend/src/common/guards/auth.guard.spec.ts backend/src/common/guards/role.guard.ts backend/src/common/guards/role.guard.spec.ts
```

- [ ] **Step 3: Slim `roles.decorator.ts`** to just the enum (still used by DTO enums and the ability factory's role switch):

```ts
export enum Role {
  admin = 'admin',
  manager = 'manager',
  member = 'member',
  executive = 'executive',
}
```

- [ ] **Step 4: Update `common/index.ts`** — drop removed exports:

```ts
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { LocalAuthGuard } from './guards/local-auth.guard';
export { GlobalExceptionFilter } from './filters/exception.filter';
export { ResponseInterceptor } from './interceptors/response.interceptor';
export { Role } from './decorators/roles.decorator';
export { CurrentUser } from './decorators/current-user.decorator';
export { IS_PUBLIC_KEY, Public } from './decorators/public.decorator';
export { CheckPolicies, CHECK_POLICIES_KEY } from './casl/policy.types';
export { CurrentAbility } from './casl/current-ability.decorator';
export { CaslAbilityFactory } from './casl/ability.factory';
export type { AppAbility } from './casl/ability.types';
```

- [ ] **Step 5: Update the admin seeder** to hash via `PasswordService` (keep it a standalone, idempotent, manually-instantiated script — its own file):

```ts
import env from 'src/utils/env';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { DbContextService } from 'src/infra/application-db/db-context';
import { PersonAccountRepository } from 'src/modules/module-auth/account.repo';
import { PasswordService } from 'src/modules/module-auth/password.service';

/**
 * Idempotent admin seeder — safe to run multiple times.
 * Creates the admin account from env if not already present.
 * NOT wired into module boot; invoke only via `yarn seed:admin`.
 */
export async function seedAdmin(): Promise<void> {
  const dbProvider = new ApplicationDBProvider();
  const ctxService = new DbContextService();
  const repo = new PersonAccountRepository(dbProvider);
  const passwords = new PasswordService();

  const sys = ctxService.system();

  const existing = await repo.findByEmail(env.ADMIN_ACCOUNT, sys);
  if (existing) {
    console.log(`Admin account already exists: ${env.ADMIN_ACCOUNT}`);
    return;
  }

  const passwordHash = await passwords.hash(env.ADMIN_ACCOUNT_PASSWORD);
  await repo.createPerson(
    { name: 'Admin', email: env.ADMIN_ACCOUNT, passwordHash, role: 'admin' },
    sys,
  );

  console.log(`Admin account created: ${env.ADMIN_ACCOUNT}`);
}
```

- [ ] **Step 6: Verify build + full unit test suite**

Run: `yarn workspace cybernetic-backend build && yarn workspace cybernetic-backend test`
Expected: build PASS; all unit specs PASS (no references to deleted guards remain). If any spec imports the deleted guards, it was deleted in Step 2 — confirm none remain: `cd backend && grep -rl "guards/auth.guard\|guards/role.guard\|ROLES_KEY\|@Roles" src || echo clean` → `clean`.

- [ ] **Step 7: Commit**

```bash
git add -A backend/src/common backend/src/app.module.ts backend/src/infra/application-db/seeder/seeder-admin.ts
git commit -m "refactor(auth): retire RoleGuard/AuthGuard; CASL is primary RBAC; seeder uses PasswordService"
```

---

## Task 20: E2E auth + authorization flow test + final verification

**Files:**
- Create: `backend/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: the running `AppModule` (real DB via `.env`, like `health.e2e-spec.ts`).

> Requires a reachable Postgres and a seeded admin (`yarn db:migrate && yarn seed:admin`). Mirrors the existing `health.e2e-spec.ts` bootstrap (global prefix `api`, `cookieParser`).

- [ ] **Step 1: Write the e2e spec** `test/auth.e2e-spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import env from '../src/utils/env';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshCookie: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('login returns an access token and sets the refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: env.ADMIN_ACCOUNT, password: env.ADMIN_ACCOUNT_PASSWORD })
      .expect(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.role).toBe('admin');
    const setCookie = res.headers['set-cookie'][0];
    expect(setCookie).toContain(env.REFRESH_COOKIE_NAME);
    accessToken = res.body.data.accessToken;
    refreshCookie = setCookie;
  });

  it('GET /api/auth/me returns the current user with a valid token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.data.email).toBe(env.ADMIN_ACCOUNT);
  });

  it('rejects protected routes without a token (401)', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });

  it('removed POST /api/auth/register returns 404', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'x', email: 'x@y.com', password: 'password1' })
      .expect(404);
  });

  it('refresh rotates the token using the cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie)
      .expect(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
  });

  it('admin can create a member; created user can log in and is forbidden from creating objectives', async () => {
    const email = `member_${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/persons')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Member', email, password: 'password123', role: 'member' })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    const memberToken = login.body.data.accessToken;

    await request(app.getHttpServer())
      .post('/api/objectives')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'X', ownerPersonId: 1, scope: 'team', period: '2026-Q3' })
      .expect(403);
  });
});
```

- [ ] **Step 2: Prepare DB + run the e2e suite**

Run: `cd backend && yarn db:migrate && yarn seed:admin && yarn test:e2e`
Expected: all auth e2e cases PASS (and the existing health e2e still passes).

- [ ] **Step 3: Full verification gate**

Run: `yarn workspace cybernetic-backend lint && yarn workspace cybernetic-backend build && yarn workspace cybernetic-backend test`
Expected: lint clean, build PASS, all unit specs PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/test/auth.e2e-spec.ts
git commit -m "test(auth): e2e for login/refresh/me + admin provisioning + CASL deny"
```

---

## Self-Review Notes (coverage map)

- **Requirement 1 (defaultFields separate file):** Task 2.
- **Requirement 2 (NestJS Passport):** Tasks 10 (jwt), 11 (local), 12–14 (service/controller/module + `@nestjs/jwt`).
- **Requirement 3 (CASL primary RBAC):** Tasks 5–6 (engine), 15–19 (global guard + controller migration + RoleGuard retirement).
- **Requirement 4 (expand to complete):** refresh sessions + rotation + logout + `/me` (Tasks 8–9, 12–13, 20); admin provisioning closing the privilege-escalation hole (Task 16); deactivation enforced on every request (Task 10 reload).
- **Requirement 5 (schema):** Tasks 2–3 (common.schema, auth_session, IUserSession/IPersonRecord, interfaces).
- **Requirement 6 (migration + seeding, auth seeding separate file):** Task 3 (generate/run migration), Task 19 (seeder kept as its own `seeder-admin.ts`, updated to `PasswordService`).

## Out-of-scope follow-ups (flagged, not built)
OIDC/SSO; email invites + password reset; row-level filtering of **list** endpoints (v1 enforces row-level only on single-resource reads/mutations); field-level CASL to redact raw `ActivityEvent` text from executives; `auth_session` pruning cron; "log out everywhere" UI (repo method `revokeAllForPerson` already exists).
