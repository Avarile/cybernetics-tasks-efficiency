# Cybernetic — Phase 0 + 1 Implementation Plan (Foundations + OKR Core & Manual Tracking)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Cybernetic backend + frontend foundations and ship a usable OKR tracker whose execution data is captured as an append-only event log.

**Architecture:** A modular-monolith NestJS (Express) backend with a Drizzle/Postgres data layer, organized into bounded-context modules (`identity`, `okr`, `tracking`). The `tracking` module is event-sourced: an append-only `activity_event` table is the source of truth, and projections (`initiative_state`, `key_result_measurement`) are derived from it via an in-process event bus. A React/Vite SPA consumes the REST API. This plan delivers Phase 0 (foundations) and Phase 1 (OKR core + manual tracking) — no AI yet (that is Phase 2).

**Tech Stack:** NestJS 10 (Express adapter), TypeScript, Drizzle ORM + `pg` (PostgreSQL), `@nestjs/bullmq` + Redis (infra only this phase), `@nestjs/event-emitter`, `@nestjs/schedule`, `class-validator`, `zod` (env), `bcrypt` + `jsonwebtoken` (auth), `@nestjs/swagger` + Scalar. Frontend: React 18, Vite, React Router, TanStack Query, Tailwind. Yarn workspaces monorepo.

## Reference Codebase (the copy template)

A sibling project establishes every code convention this plan follows:
`/home/avarile/Documents/codeRepo/ai-agent-cluster/backend`

When a task says **"mirror `module-task`"**, copy the structure/idioms of these files and apply the stated deltas — do not invent a new pattern:
- Module: `src/modules/business-logic-modules/module-task/task.{module,controller,repo,dto,interface}.ts`
- Shared kernel: `src/utils/shared/{interface,base.abstract,query}.ts`, `src/utils/exception.provider.ts`
- DB layer: `src/infra/application-db/{db-connection,application-db.module}.ts`, `schema/business/business_db.ts`
- Bootstrap: `src/main.ts`, `src/app.module.ts`, `src/utils/env.ts`

## Global Constraints

- **Language/runtime:** TypeScript, Node ≥ 20, Yarn (workspaces). Backend is NestJS on the **Express adapter only** (never Fastify — keeps the Phase-2 Mastra/NestJS path open).
- **DB access:** All persistence goes through Drizzle. Every repository method takes a trailing `tenancyInfo: IDBConfigOptions` (`{ database_uri, schema_id, user_id }`) and acquires its connection via `ApplicationDBProvider.getTenantDBConnection(tenancyInfo)`, wrapped in `try/catch/finally { client.release() }`. This is a single-tenant deployment, so `schema_id` resolves to one configured company schema, but the parameter is kept verbatim for convention parity and the future multi-tenant seam.
- **Soft delete only:** never hard-delete domain rows. Set `isDeleted=true, deletedAt=now, updatedAt=now`. All reads filter `isDeleted=false` by default.
- **Identifiers:** every domain table spreads `defaultFields` → numeric `serial` `id` (internal) + `uuid` `slug` (external/stable). Controllers expose `slug` to clients; foreign keys use `id` with an optional denormalized `slug` mirror where the reference does so.
- **Errors:** throw via `AppException.throw('CODE', message)`; re-throw `BusinessException` unchanged. Never leak raw DB errors.
- **Response envelope:** controllers return `IBaseResponse` / `IBaseQueryResult` (`{ data, status_code, message, timestamp, error }`). A global `ResponseInterceptor` is installed but controllers still return the envelope explicitly, matching the reference.
- **Validation:** global `ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true })`. All request bodies are `class-validator` DTOs.
- **Auth:** protected controllers carry `@UseGuards(AuthGuard, RoleControllerGuard)` + `@Roles(...)`. `req.user` is an `IUserSession`.
- **Timestamps:** Postgres `timestamp withTimezone, mode:'string'`; application passes ISO strings (`new Date().toISOString()`).
- **Append-only law (tracking):** rows in `activity_event` are **never** updated or deleted. Corrections are new events. Projections are always rebuildable by replaying events.
- **TDD:** every task is red→green→commit. Tests use Jest (backend) / Vitest (frontend). Commit after each green step.
- **Commit trailer:** end every commit message body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

# File Structure (both phases)

```
cybernetic/
├── package.json                      # yarn workspaces root
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── drizzle.config.ts
│   ├── jest.config.js
│   └── src/
│       ├── main.ts                   # bootstrap (mirror reference)
│       ├── app.module.ts             # globals (mirror reference, trimmed)
│       ├── app.controller.ts         # GET /api/health
│       ├── modules/main.module.ts    # aggregates business modules
│       ├── utils/
│       │   ├── env.ts                # zod env (Task 1)
│       │   ├── exception.provider.ts # AppException/BusinessException (Task 3)
│       │   └── shared/
│       │       ├── interface.ts      # DefaultFields, IBaseQueryParams,... (Task 3)
│       │       ├── base.abstract.ts  # BaseRepo<T> (Task 3)
│       │       └── query.ts          # withPagination (Task 3)
│       ├── middleware/
│       │   ├── response.interceptor.ts
│       │   ├── exception.interceptor.ts   # GlobalExceptionFilter
│       │   ├── auth.guard.ts
│       │   ├── roles.decorator.ts
│       │   └── role-controller.guard.ts
│       ├── infra/application-db/
│       │   ├── application-db.module.ts   # @Global, provides ApplicationDBProvider
│       │   ├── db-connection.ts           # pool + getTenantDBConnection (Task 2)
│       │   ├── db-context.ts              # single-tenant context helper (Task 2)
│       │   └── schema/
│       │       ├── identity.schema.ts     # Task 4
│       │       ├── okr.schema.ts          # Task 9
│       │       ├── tracking.schema.ts     # Task 10
│       │       └── index.ts               # re-exports all tables (drizzle-kit entry)
│       └── modules/
│           ├── module-auth/                # Task 5
│           ├── business-logic-modules/
│           │   ├── module-organization/    # Task 6
│           │   ├── module-department/      # Task 7
│           │   ├── module-team/            # Task 7
│           │   ├── module-person/          # Task 6
│           │   ├── module-objective/       # Task 11
│           │   ├── module-key-result/      # Task 11
│           │   ├── module-initiative/      # Task 12
│           │   ├── module-alignment/       # Task 13
│           │   ├── module-tracking/        # Tasks 14-16
│           │   └── module-intervention/    # Task 17
└── frontend/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx, App.tsx, router.tsx
        ├── lib/api-client.ts, lib/auth-context.tsx
        ├── components/AppShell.tsx
        └── pages/ Login, OkrTree, MyWork, InitiativeTimeline   # Tasks 8, 18
```

---

# PHASE 0 — Foundations

## Task 0: Monorepo + backend NestJS scaffold

**Files:**
- Create: `package.json` (workspaces root), `backend/package.json`, `backend/tsconfig.json`, `backend/nest-cli.json`, `backend/jest.config.js`, `backend/.env.example`
- Create: `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/src/app.controller.ts`, `backend/src/modules/main.module.ts`
- Test: `backend/test/health.e2e-spec.ts`

**Interfaces:**
- Produces: a bootable NestJS app on `env.PORT`, global prefix `api`, `GET /api/health → { status: 'ok' }`.

- [ ] **Step 1: Root workspace `package.json`**

```json
{
  "name": "cybernetic",
  "private": true,
  "workspaces": ["backend", "frontend"]
}
```

> Uses **Yarn classic (1.x) workspaces** — no `packageManager`/Berry pin (the dev machine runs yarn 1.22). `yarn install` at the repo root links both workspaces.

- [ ] **Step 2: `backend/package.json`** — mirror the reference's deps but trim to this phase (no minio/meilisearch/stripe/rabbitmq/retell/sendgrid/cohere/openai yet).

```json
{
  "name": "cybernetic-backend",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "build": "nest build",
    "lint": "eslint \"src/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/infra/application-db/migrate.ts",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.19",
    "@nestjs/core": "^10.4.19",
    "@nestjs/platform-express": "^10.4.19",
    "@nestjs/event-emitter": "^2.0.4",
    "@nestjs/schedule": "^4.1.1",
    "@nestjs/bullmq": "^11.0.2",
    "@nestjs/swagger": "^7.3.1",
    "@nestjs/throttler": "^5.1.2",
    "@scalar/nestjs-api-reference": "^1.0.13",
    "bullmq": "^5.53.3",
    "ioredis": "^5.6.1",
    "drizzle-orm": "^0.44.2",
    "pg": "^8.16.3",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "class-validator": "^0.14.1",
    "class-transformer": "^0.5.1",
    "cookie-parser": "^1.4.6",
    "helmet": "^8.1.0",
    "body-parser": "^1.20.2",
    "dotenv": "^17.0.0",
    "luxon": "^3.6.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.0",
    "@nestjs/schematics": "^10.2.0",
    "@nestjs/testing": "^10.4.19",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/cookie-parser": "^1.4.7",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.14",
    "@types/node": "^22.10.7",
    "@types/pg": "^8.15.4",
    "@types/supertest": "^6.0.2",
    "drizzle-kit": "^0.31.4",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "supertest": "^7.0.0",
    "source-map-support": "^0.5.21"
  }
}
```

- [ ] **Step 3: `backend/tsconfig.json`** (path alias `src/*`, decorators on)

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "moduleResolution": "node",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "declaration": true,
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "paths": { "src/*": ["src/*"] },
    "strict": true,
    "strictNullChecks": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 4: `backend/nest-cli.json`** and `backend/jest.config.js`

```json
{ "collection": "@nestjs/schematics", "sourceRoot": "src", "compilerOptions": { "deleteOutDir": true } }
```

```js
// jest.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  moduleNameMapper: { '^src/(.*)$': '<rootDir>/src/$1' },
  setupFiles: ['<rootDir>/test/jest.setup.ts'],
  testEnvironment: 'node',
};
```

> **Controller-provided files (already on disk — do NOT create or overwrite these):** repo-root `.gitignore`, `backend/.env` (real dev secrets, gitignored), `backend/test/jest.setup.ts` (`import 'dotenv/config';`), and `backend/test/jest-e2e.json`. You only create `backend/.env.example` with placeholder values. `git add backend/` is safe — `.env` is gitignored.

- [ ] **Step 5: Write the failing e2e test** `backend/test/health.e2e-spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('GET /api/health → ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 6: Run it, expect FAIL** — `cd backend && yarn jest --config ./test/jest-e2e.json` → fails (no AppModule).

- [ ] **Step 7: Implement `app.controller.ts`, `app.module.ts`, `modules/main.module.ts`, `main.ts`**

```typescript
// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
@Controller('health')
export class AppController {
  @Get()
  health() { return { status: 'ok' }; }
}
```

```typescript
// src/modules/main.module.ts
import { Module } from '@nestjs/common';
@Module({ imports: [] }) // business modules added as later tasks land
export class MainModule {}
```

```typescript
// src/app.module.ts  (trimmed mirror of reference — infra added in later tasks)
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { MainModule } from './modules/main.module';

@Module({
  imports: [EventEmitterModule.forRoot(), ScheduleModule.forRoot(), MainModule],
  controllers: [AppController],
})
export class AppModule {}
```

```typescript
// src/main.ts  (mirror reference main.ts, trimmed)
import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as bodyParser from 'body-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(), {
    cors: { origin: ['http://localhost:5173'], credentials: true },
  });
  app.setGlobalPrefix('api');
  app.use(bodyParser.json({ limit: '5mb' }));
  app.use(cookieParser());
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({
    transform: true, whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 9100);
}
bootstrap();
```

- [ ] **Step 8: Run e2e, expect PASS.** `yarn jest --config ./test/jest-e2e.json`

- [ ] **Step 9: Commit**

```bash
git add package.json backend/
git commit -m "feat: scaffold yarn-workspace monorepo and bootable NestJS backend

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 1: Environment config (`env.ts`)

**Files:**
- Create: `backend/src/utils/env.ts`, `backend/.env.example`
- Test: `backend/src/utils/env.spec.ts`

**Interfaces:**
- Produces: `default export env` (validated) and `export const is_live_env`. Keys used downstream: `PORT, HOST, NODE_ENV, DATABASE_MAIN_*, COMPANY_SCHEMA, JWT_SECRET, JWT_EXPIRES_IN, APP_SALT_ROUNDS, REDIS_BULLMQ_*, ADMIN_ACCOUNT, ADMIN_ACCOUNT_PASSWORD, CORS_ORIGINS`.

- [ ] **Step 1: Write failing test** `env.spec.ts`

```typescript
describe('env', () => {
  it('parses with defaults and required overrides', () => {
    jest.resetModules(); // env.ts parses once at import; reset so our overrides take effect
    process.env.JWT_SECRET = 'test-secret';
    process.env.ADMIN_ACCOUNT = 'admin@co.com';
    process.env.ADMIN_ACCOUNT_PASSWORD = 'pw';
    process.env.DATABASE_MAIN_DATABASE = 'cybernetic';
    const { default: env } = require('./env');
    expect(env.PORT).toBeGreaterThan(0);
    expect(env.COMPANY_SCHEMA).toBe('public');
    expect(env.JWT_SECRET).toBe('test-secret');
  });
});
```

- [ ] **Step 2: Run, expect FAIL.** `yarn jest src/utils/env.spec.ts`

- [ ] **Step 3: Implement `env.ts`** (mirror reference, trimmed to this phase)

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'testing', 'production']).default('development'),
  PORT: z.coerce.number().min(1000).default(9100),
  HOST: z.string().default('localhost'),
  CORS_ORIGINS: z.string().optional(),

  // single-tenant deployment DB
  DATABASE_MAIN_HOST: z.string().default('localhost'),
  DATABASE_MAIN_PORT: z.coerce.number().default(5432),
  DATABASE_MAIN_USERNAME: z.string().default('postgres'),
  DATABASE_MAIN_PASSWORD: z.string().default('postgres'),
  DATABASE_MAIN_DATABASE: z.string().default('cybernetic'),
  COMPANY_SCHEMA: z.string().default('public'),

  // auth
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('1d'),
  APP_SALT_ROUNDS: z.coerce.number().default(10),
  ADMIN_ACCOUNT: z.string(),
  ADMIN_ACCOUNT_PASSWORD: z.string(),

  // bullmq/redis (infra wired this phase, used Phase 2+)
  REDIS_BULLMQ_HOST: z.string().default('localhost'),
  REDIS_BULLMQ_PORT: z.coerce.number().default(6379),
  REDIS_BULLMQ_PASSWORD: z.string().optional(),
  REDIS_BULLMQ_DB: z.coerce.number().default(0),
});

const env = envSchema.parse(process.env);
export default env;
export const is_live_env = env.NODE_ENV === 'production';
```

- [ ] **Step 4: Write `.env.example`** with every key above (placeholder values; real secrets never committed).

- [ ] **Step 5: Run test, expect PASS. Commit.**

```bash
git add backend/src/utils/env.ts backend/src/utils/env.spec.ts backend/.env.example
git commit -m "feat: zod-validated environment config"
```

---

## Task 2: Database layer (Drizzle provider, single-tenant context)

**Files:**
- Create: `backend/src/infra/application-db/db-connection.ts`, `application-db.module.ts`, `db-context.ts`, `migrate.ts`
- Create: `backend/drizzle.config.ts`, `backend/src/infra/application-db/schema/index.ts` (empty re-export for now)
- Test: `backend/src/infra/application-db/db-context.spec.ts`

**Interfaces:**
- Produces:
  - `interface IDBConfigOptions { database_uri: string; schema_id: string; user_id: number }`
  - `class ApplicationDBProvider` with `getTenantDBConnection(opts): Promise<{ dbConnection, client }>` and `getMasterConnection()`.
  - `class DbContextService` with `forUser(userId: number): IDBConfigOptions` and `system(): IDBConfigOptions` — builds the single-tenant context from `env`.
  - `@Global() ApplicationDbModule` exporting both providers.

- [ ] **Step 1: `db-connection.ts`** — adapt the reference `db-connection.ts`, but **trim the multi-tenant provisioning** (drop `initTenantSchema` and the `constructMigration`/`init_migration` import, and the master-vs-tenant pool split — those reference files we don't have). Keep exactly: the lazy pool map (`getOrCreatePool`), `getMasterConnection()`, and `getTenantDBConnection(opts)` which does `SET search_path TO "<schema_id>", public` then `drizzle(client)`. Build `connectionURI` from `env.DATABASE_MAIN_*`. Pools are created lazily on first use (constructor only logs) — so importing this provider never requires a live DB; only methods that actually query do.

- [ ] **Step 2: `application-db.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import ApplicationDBProvider from './db-connection';
import { DbContextService } from './db-context';

export interface IDBConfigOptions { database_uri: string; schema_id: string; user_id: number; }

@Global()
@Module({ providers: [ApplicationDBProvider, DbContextService], exports: [ApplicationDBProvider, DbContextService] })
export class ApplicationDbModule {}
```

- [ ] **Step 3: Write failing test** `db-context.spec.ts`

```typescript
import { DbContextService } from './db-context';
import env from 'src/utils/env';
describe('DbContextService', () => {
  it('builds single-tenant context from env', () => {
    const svc = new DbContextService();
    const ctx = svc.forUser(42);
    expect(ctx.schema_id).toBe(env.COMPANY_SCHEMA);  // env-relative, not a hardcoded literal
    expect(ctx.user_id).toBe(42);
    expect(ctx.database_uri).toContain('postgresql://');
  });
});
```

- [ ] **Step 4: Run, expect FAIL.**

- [ ] **Step 5: Implement `db-context.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import env from 'src/utils/env';
import { IDBConfigOptions } from './application-db.module';

@Injectable()
export class DbContextService {
  private readonly uri = `postgresql://${env.DATABASE_MAIN_HOST}:${env.DATABASE_MAIN_PORT}/${env.DATABASE_MAIN_DATABASE}?user=${env.DATABASE_MAIN_USERNAME}&password=${env.DATABASE_MAIN_PASSWORD}`;
  forUser(userId: number): IDBConfigOptions {
    return { database_uri: this.uri, schema_id: env.COMPANY_SCHEMA, user_id: userId };
  }
  system(): IDBConfigOptions { return this.forUser(0); }
}
```

- [ ] **Step 6: `drizzle.config.ts`** (drizzle-kit reads schema from `schema/index.ts`)

```typescript
import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';
export default defineConfig({
  schema: './src/infra/application-db/schema/index.ts',
  out: './src/infra/application-db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DATABASE_MAIN_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_MAIN_PORT ?? 5432),
    user: process.env.DATABASE_MAIN_USERNAME ?? 'postgres',
    password: process.env.DATABASE_MAIN_PASSWORD ?? 'postgres',
    database: process.env.DATABASE_MAIN_DATABASE ?? 'cybernetic',
  },
});
```

- [ ] **Step 7: `migrate.ts`** — a `tsx` script that runs `migrate()` from `drizzle-orm/node-postgres/migrator` against `COMPANY_SCHEMA` (set search_path first). `schema/index.ts` starts as `export {};` and gets populated by Tasks 4/9/10.

- [ ] **Step 8: Register `ApplicationDbModule` in `app.module.ts` imports. Run db-context test, expect PASS. Commit.**

```bash
git commit -am "feat: Drizzle/Postgres provider with single-tenant db context"
```

---

## Task 3: Shared kernel (interfaces, BaseRepo, pagination, exceptions, interceptors)

**Files:**
- Create: `backend/src/utils/shared/interface.ts`, `base.abstract.ts`, `query.ts`
- Create: `backend/src/utils/exception.provider.ts`
- Create: `backend/src/middleware/response.interceptor.ts`, `exception.interceptor.ts`
- Test: `backend/src/utils/exception.provider.spec.ts`, `backend/src/utils/shared/query.spec.ts`

**Interfaces:**
- Produces (copy from reference verbatim unless noted):
  - `interface DefaultFields { id; slug; createdAt; updatedAt; deletedAt; isDeleted; isActive }`, `UpdatableDefaultFields`, `IGetByID/IGetBySlug/...`, `IBaseQueryParams`, `IBaseQueryResult`, `IBaseResponse`, `toISOStringSafe()`.
  - `abstract class BaseRepo<T>` (create/findById/findBySlug/findAll/update/delete/countAll/query, each with optional `tenancyInfo`).
  - `withPagination(qb, page?, pageSize?)`.
  - `AppException` + `BusinessException` with `AppException.throw(code, message)`. Codes used in this plan: `DATABASE_QUERY_FAILED`, `RESOURCE_NOT_FOUND`, `RESOURCE_CONFLICT`, `VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`, `SYSTEM_INTERNAL_ERROR`.
  - `GlobalExceptionFilter` (maps `BusinessException` → its HTTP status + envelope), `ResponseInterceptor` (passes through `IBaseResponse`).

- [ ] **Step 1:** Copy `interface.ts`, `base.abstract.ts`, `query.ts` from the reference verbatim (paths under `src/utils/shared/`). Adjust the `base.abstract.ts` import to `src/infra/application-db/application-db.module`.

- [ ] **Step 2: Write failing test** `exception.provider.spec.ts`

```typescript
import { AppException, BusinessException } from './exception.provider';
describe('AppException', () => {
  it('throws a BusinessException with code + message', () => {
    expect(() => AppException.throw('RESOURCE_NOT_FOUND', 'x not found'))
      .toThrow(BusinessException);
    try { AppException.throw('RESOURCE_NOT_FOUND', 'x'); }
    catch (e) { expect((e as BusinessException).code).toBe('RESOURCE_NOT_FOUND'); expect((e as BusinessException).status).toBe(404); }
  });
});
```

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: Implement `exception.provider.ts`**

```typescript
import { HttpStatus } from '@nestjs/common';

const CODE_STATUS: Record<string, number> = {
  DATABASE_QUERY_FAILED: HttpStatus.INTERNAL_SERVER_ERROR,
  RESOURCE_NOT_FOUND: HttpStatus.NOT_FOUND,
  RESOURCE_CONFLICT: HttpStatus.CONFLICT,
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  SYSTEM_INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
};

export class BusinessException extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = 'BusinessException';
  }
}

export class AppException {
  static throw(code: keyof typeof CODE_STATUS | string, message: string): never {
    throw new BusinessException(code, message, CODE_STATUS[code] ?? 500);
  }
}
```

- [ ] **Step 5: Implement `GlobalExceptionFilter` + `ResponseInterceptor`** (envelope mapping)

```typescript
// src/middleware/exception.interceptor.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { BusinessException } from 'src/utils/exception.provider';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'SYSTEM_INTERNAL_ERROR';
    let message = 'Internal server error';
    if (exception instanceof BusinessException) { status = exception.status; code = exception.code; message = exception.message; }
    else if (exception instanceof HttpException) { status = exception.getStatus(); message = exception.message; code = 'HTTP_ERROR'; }
    res.status(status).json({ data: null, status_code: status, message, error: code, timestamp: new Date() });
  }
}
```

```typescript
// src/middleware/response.interceptor.ts
import { CallHandler, ExecutionContext, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((body) => {
        // Pass through controller responses that already use the envelope
        if (body && typeof body === 'object' && 'status_code' in body && 'error' in body) return body;
        // Normalise any bare return into the standard IBaseResponse envelope
        return { data: body ?? null, status_code: HttpStatus.OK, message: 'OK', error: null, timestamp: new Date() };
      }),
    );
  }
}
```

- [ ] **Step 6: Write `query.spec.ts`** asserting `withPagination` sets limit/offset (build a fake `qb` with chainable `limit`/`offset` spies). Run, expect FAIL, then it passes against the copied `query.ts`.

- [ ] **Step 7: Register globals** in `app.module.ts` providers: `{ provide: APP_FILTER, useClass: GlobalExceptionFilter }`, `{ provide: APP_INTERCEPTOR, useClass: ResponseInterceptor }`. Run all tests, expect PASS. **Commit.**

```bash
git commit -am "feat: shared kernel — interfaces, BaseRepo, exceptions, interceptors"
```

---

## Task 4: Identity schema (organization, department, team, person)

**Files:**
- Create: `backend/src/infra/application-db/schema/identity.schema.ts`
- Modify: `backend/src/infra/application-db/schema/index.ts` (re-export identity)
- Test: `backend/src/infra/application-db/schema/identity.schema.spec.ts`

**Interfaces:**
- Produces Drizzle tables `organization`, `department`, `team`, `person`, `personRole` enum, and a shared `defaultFields` object. Person carries `role` (`admin|manager|member|executive`), `email` (unique), `passwordHash`, `departmentId?`, `teamId?`.

- [ ] **Step 1:** Create a shared `defaultFields`/`addressFields` block. Put it at top of `identity.schema.ts` and export it (later schema files import it). Copy the reference's `defaultFields` (serial id, uuid slug, tz-string timestamps, isDeleted/isActive) verbatim.

- [ ] **Step 2: Implement `identity.schema.ts`**

```typescript
import { boolean, index, integer, pgEnum, pgTable, serial, timestamp, uniqueIndex, uuid, varchar, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const defaultFields = {
  id: serial('id').primaryKey().notNull(),
  slug: uuid('slug').defaultRandom().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  isDeleted: boolean('is_deleted').default(false),
  isActive: boolean('is_active').default(true),
};

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
  email: varchar('email', { length: 320 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  role: personRole('role').notNull().default('member'),
  departmentId: integer('department_id'),
  teamId: integer('team_id'),
  ...defaultFields,
}, (t) => [uniqueIndex('person_email_index').on(t.email), index('person_role_index').on(t.role)]);
```

- [ ] **Step 3: `schema/index.ts`** → `export * from './identity.schema';`

- [ ] **Step 4: Write failing test** `identity.schema.spec.ts` — assert the tables expose expected columns:

```typescript
import { person, department } from './identity.schema';
import { getTableColumns } from 'drizzle-orm';
it('person has email + role + soft-delete columns', () => {
  const cols = Object.keys(getTableColumns(person));
  expect(cols).toEqual(expect.arrayContaining(['id', 'slug', 'email', 'role', 'isDeleted']));
  expect(Object.keys(getTableColumns(department))).toEqual(expect.arrayContaining(['parentId', 'leadPersonId']));
});
```

- [ ] **Step 5: Run, expect PASS** (schema is declarative). Generate migration: `yarn db:generate` → review the SQL in `migrations/`.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat: identity Drizzle schema (organization/department/team/person) + migration"
```

---

## Task 5: Auth module (JWT login, AuthGuard, Roles guard, admin seed)

**Files:**
- Create: `backend/src/modules/module-auth/auth.module.ts`, `account.repo.ts`, `auth.dto.ts`, `auth.interface.ts`, `authentication.controller.ts`, `authentication.service.ts`
- Create: `backend/src/modules/module-auth/current-user-module/session.interface.ts`
- Create: `backend/src/middleware/auth.guard.ts`, `roles.decorator.ts`, `role-controller.guard.ts`
- Create: `backend/src/infra/application-db/seeder/seeder-admin.ts`
- Test: `authentication.service.spec.ts`, `auth.guard.spec.ts`, `role-controller.guard.spec.ts`

**Interfaces:**
- Produces:
  - `interface IUserSession { id: number; slug: string; email: string; role: 'admin'|'manager'|'member'|'executive' }` — set on `req.user`.
  - `AuthGuard` (verifies `Authorization: Bearer <jwt>`, loads person, sets `req.user`).
  - `@Roles(...roles)` decorator + `RoleControllerGuard` (reads metadata, checks `req.user.role`).
  - `Role` enum mirror for decorator ergonomics: `Role.admin|manager|member|executive`.
  - `POST /api/auth/register`, `POST /api/auth/login` → `{ token, user }`.
  - `PersonAccountRepository.findByEmail/createPerson` (used by auth + seeder).

- [ ] **Step 1: `roles.decorator.ts` + `session.interface.ts`**

```typescript
// roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
export enum Role { admin = 'admin', manager = 'manager', member = 'member', executive = 'executive' }
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

```typescript
// current-user-module/session.interface.ts
export interface IUserSession { id: number; slug: string; email: string; role: 'admin'|'manager'|'member'|'executive'; }
```

- [ ] **Step 2: Write failing test** `authentication.service.spec.ts`

```typescript
describe('AuthenticationService', () => {
  it('hashes password on register and verifies on login', async () => {
    // mock PersonAccountRepository: createPerson echoes input; findByEmail returns the created row
    // assert register stores a bcrypt hash (not plaintext) and login returns a JWT string
  });
  it('rejects login with wrong password → UNAUTHORIZED', async () => { /* expect AppException UNAUTHORIZED */ });
});
```

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: Implement `account.repo.ts`** — mirror `module-task` repo shape but on `person`. Methods: `findByEmail(email, ctx)`, `createPerson(dto, ctx)`, `findById(id, ctx)`. Uses `ApplicationDBProvider` + `DbContextService`.

- [ ] **Step 5: Implement `authentication.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import env from 'src/utils/env';
import { AppException } from 'src/utils/exception.provider';
import { PersonAccountRepository } from './account.repo';
import { DbContextService } from 'src/infra/application-db/db-context';

@Injectable()
export class AuthenticationService {
  constructor(private readonly accounts: PersonAccountRepository, private readonly ctx: DbContextService) {}

  async register(input: { name: string; email: string; password: string; role?: string }) {
    const sys = this.ctx.system();
    const existing = await this.accounts.findByEmail(input.email, sys);
    if (existing) AppException.throw('RESOURCE_CONFLICT', 'Email already registered');
    const passwordHash = await bcrypt.hash(input.password, env.APP_SALT_ROUNDS);
    const person = await this.accounts.createPerson({ name: input.name, email: input.email, passwordHash, role: (input.role as any) ?? 'member' }, sys);
    return this.issue(person);
  }

  async login(email: string, password: string) {
    const person = await this.accounts.findByEmail(email, this.ctx.system());
    if (!person || !person.passwordHash) AppException.throw('UNAUTHORIZED', 'Invalid credentials');
    const ok = await bcrypt.compare(password, person.passwordHash);
    if (!ok) AppException.throw('UNAUTHORIZED', 'Invalid credentials');
    return this.issue(person);
  }

  private issue(person: { id: number; slug: string; email: string; role: string }) {
    const payload = { id: person.id, slug: person.slug, email: person.email, role: person.role };
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
    return { token, user: payload };
  }
}
```

- [ ] **Step 6: Implement `auth.guard.ts` + `role-controller.guard.ts`**

```typescript
// auth.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import env from 'src/utils/env';
import { AppException } from 'src/utils/exception.provider';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) AppException.throw('UNAUTHORIZED', 'Missing bearer token');
    try { req.user = jwt.verify(header.slice(7), env.JWT_SECRET); return true; }
    catch { AppException.throw('UNAUTHORIZED', 'Invalid token'); }
  }
}
```

```typescript
// role-controller.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from './roles.decorator';
import { AppException } from 'src/utils/exception.provider';

@Injectable()
export class RoleControllerGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user || !required.includes(user.role)) AppException.throw('FORBIDDEN', 'Insufficient role');
    return true;
  }
}
```

- [ ] **Step 7: Implement `authentication.controller.ts`** (`/auth/register`, `/auth/login`; return `IBaseResponse`). `auth.dto.ts` = `RegisterDTO`, `LoginDTO` (class-validator: `@IsEmail`, `@MinLength`). `auth.module.ts` imports `ApplicationDbModule`, provides service+repo+guards, exports guards.

- [ ] **Step 8: `seeder-admin.ts`** — on boot (or via `seed` script) ensure an `admin` person exists from `env.ADMIN_ACCOUNT`/`ADMIN_ACCOUNT_PASSWORD` (idempotent: skip if `findByEmail` hits).

- [ ] **Step 9: Run all auth tests, expect PASS.** Wire `AuthModule` into `MainModule`. **Commit.**

```bash
git commit -am "feat: JWT auth (register/login), AuthGuard + Roles guard, admin seeder"
```

---

## Task 6: Organization + Person modules (CRUD)

**Files:**
- Create: `module-organization/organization.{module,controller,repo,dto,interface}.ts`
- Create: `module-person/person.{module,controller,repo,dto,interface}.ts`
- Test: `organization.repo.spec.ts`, `person.repo.spec.ts`, `person.controller.spec.ts`

**Interfaces:**
- Produces `OrganizationRepository`, `PersonRepository` (both `implements BaseRepo<IEntity>`), exported from their modules. Person endpoints: `POST /persons/create|update|delete|search|all`, `GET /persons/:id|/slug/:slug`. Organization: same surface under `/organizations` (singleton-ish; still CRUD).

- [ ] **Step 1: `person.interface.ts`** (full — this is the template all later CRUD interfaces follow)

```typescript
import { DefaultFields, IBaseQueryParams, IGetByID, UpdatableDefaultFields } from 'src/utils/shared/interface';

export interface IPersonProfile {
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'member' | 'executive';
  departmentId?: number | null;
  teamId?: number | null;
}
export interface INewPerson extends IPersonProfile { passwordHash?: string | null; }
export interface IUpdatePerson extends Partial<IPersonProfile>, UpdatableDefaultFields {}
export interface IQueryPersonParams extends Partial<IPersonProfile>, Partial<IBaseQueryParams> {}
export interface IPersonEntity extends DefaultFields, IPersonProfile {}
export interface IDeletePerson extends IGetByID {}
```

- [ ] **Step 2: Write failing test** `person.repo.spec.ts` — against a **real test Postgres** (search_path = a throwaway schema). Pattern (reuse for every repo spec):

```typescript
// Boot ApplicationDBProvider against a test schema; run create→findById→update→soft delete.
it('create then findById returns the row', async () => {
  const ctx = { database_uri: TEST_URI, schema_id: TEST_SCHEMA, user_id: 1 };
  const created = await repo.create({ name: 'Ada', email: 'ada@co.com', role: 'member' }, ctx);
  const found = await repo.findById(created.id, ctx);
  expect(found?.email).toBe('ada@co.com');
});
it('delete soft-deletes (row hidden from queries)', async () => {
  const ctx = { database_uri: TEST_URI, schema_id: TEST_SCHEMA, user_id: 1 };
  const p = await repo.create({ name: 'B', email: 'b@co.com', role: 'member' }, ctx);
  await repo.delete(p.id, ctx);
  expect(await repo.findById(p.id, ctx)).toBeNull();
});
```

> **Test DB note:** add a `backend/test/db-setup.ts` helper that, in `beforeAll`, creates a unique schema (`test_<random>`), runs the generated migrations into it, and in `afterAll` drops it. All repo specs import this helper.

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: Implement `person.repo.ts`** — **mirror `module-task/task.repo.ts` exactly**, with these deltas: table `person`; no `project` join; `query()` filters on `name`, `email`, `role`, `departmentId`, `teamId`, plus the standard `id/ids/slug/slugs/isActive/isDeleted`; `columnMap` covers `id, slug, name, email, role, createdAt, updatedAt`; add `findByEmail(email, ctx)`. Keep `create/update/delete/findById/findBySlug/existByID/countAll/queryAll/findAll/query` identical in shape.

- [ ] **Step 5: Implement `person.controller.ts`** — **mirror `task.controller.ts`** with `@ApiTags('persons')`, `@Roles(Role.admin, Role.manager)` on write endpoints and `@Roles(Role.admin, Role.manager, Role.member, Role.executive)` on reads, `@UseGuards(AuthGuard, RoleControllerGuard)`. Build `tenancyInfo` from `this.ctx.forUser((req.user as IUserSession).id)` instead of `currentUser.dbUri/slug`. Endpoints + envelopes identical to the reference.

- [ ] **Step 6: `person.module.ts`** — imports `ApplicationDbModule`, `AuthModule` (for guards); providers `[PersonRepository]`; controllers `[PersonController]`; exports `[PersonRepository]`.

- [ ] **Step 7: Repeat Steps 1-6 for `organization`** (profile = `{ name; description? }`; no joins; roles: writes `admin` only).

- [ ] **Step 8: Register both modules in `MainModule`. Run tests, expect PASS. Commit.**

```bash
git commit -am "feat: organization + person CRUD modules (mirror reference task pattern)"
```

---

## Task 7: Department + Team modules (CRUD with hierarchy)

**Files:**
- Create: `module-department/department.{module,controller,repo,dto,interface}.ts`
- Create: `module-team/team.{module,controller,repo,dto,interface}.ts`
- Test: `department.repo.spec.ts`, `team.repo.spec.ts`

**Interfaces:**
- Produces `DepartmentRepository` (adds `findByParentId(parentId, ctx)`, `findRoots(ctx)`), `TeamRepository` (adds `findByDepartmentId(departmentId, ctx)`). Profiles: Department `{ name; description?; parentId?; leadPersonId? }`; Team `{ name; departmentId; leadPersonId? }`.

- [ ] **Step 1-6:** Mirror Task 6 for both entities (interface layering → failing repo spec → mirror `task.repo.ts` → controller → module). Deltas:
  - Department `query()` filters `name, parentId, leadPersonId`; extra method `findByParentId`; `findRoots` = `parentId IS NULL`.
  - Team `query()` filters `name, departmentId, leadPersonId`; extra method `findByDepartmentId`.
  - Write roles: `admin, manager`.
- [ ] **Step 7:** Register in `MainModule`. **Commit** `feat: department + team CRUD modules with hierarchy lookups`.

---

## Task 8: Frontend scaffold (Vite shell + auth)

**Files:**
- Create: `frontend/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `tailwind.config.js`, `postcss.config.js`
- Create: `frontend/src/main.tsx`, `App.tsx`, `router.tsx`, `index.css`
- Create: `frontend/src/lib/api-client.ts`, `lib/auth-context.tsx`
- Create: `frontend/src/components/AppShell.tsx`, `pages/Login.tsx`, `pages/Dashboard.tsx`
- Test: `frontend/src/lib/api-client.test.ts` (Vitest)

**Interfaces:**
- Produces: `apiClient` (`get/post` wrappers that unwrap `IBaseResponse.data`, attach `Authorization` from stored JWT, throw on `error`), `AuthProvider` + `useAuth()` (`{ user, token, login(email,pw), logout() }`), a protected-route `<AppShell>` with nav placeholders (OKR Tree, My Work).

- [ ] **Step 1:** `package.json` deps: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `tailwindcss`, `vite`, `@vitejs/plugin-react`, `vitest`, `typescript`. Scripts: `dev`, `build`, `test`.
- [ ] **Step 2: Write failing test** `api-client.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createApiClient } from './api-client';
it('unwraps IBaseResponse.data and attaches bearer token', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { id: 1 }, error: null, status_code: 200 }) });
  const client = createApiClient({ baseUrl: '/api', getToken: () => 'jwt', fetchImpl: fetchMock as any });
  const data = await client.get('/persons/1');
  expect(data).toEqual({ id: 1 });
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt');
});
it('throws when envelope.error is set', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ data: null, error: 'RESOURCE_NOT_FOUND', message: 'nope' }) });
  const client = createApiClient({ baseUrl: '/api', getToken: () => null, fetchImpl: fetchMock as any });
  await expect(client.get('/x')).rejects.toThrow('nope');
});
```

- [ ] **Step 3: Run, expect FAIL.**
- [ ] **Step 4: Implement `api-client.ts`** (`createApiClient({ baseUrl, getToken, fetchImpl })` returning `{ get, post }`; unwrap `data`, throw `Error(message)` when `error` truthy).
- [ ] **Step 5:** Implement `auth-context.tsx` (stores token in `localStorage`, `login` calls `/auth/login`), `router.tsx` (routes: `/login`, protected `/` → Dashboard, `/okr`, `/my-work`), `AppShell.tsx` (sidebar nav + `<Outlet/>`), `Login.tsx` (email/password form), `Dashboard.tsx` (placeholder). Vite proxy `/api` → `http://localhost:9100`.
- [ ] **Step 6: Run test, expect PASS. Manual check:** `yarn dev`, log in with the seeded admin, land on Dashboard. **Commit** `feat: frontend scaffold — Vite shell, auth context, typed API client`.

---

# PHASE 1 — OKR Core + Manual Tracking

## Task 9: OKR schema (objective, key_result, initiative, links, intervention)

**Files:**
- Create: `backend/src/infra/application-db/schema/okr.schema.ts`
- Modify: `schema/index.ts` (re-export okr)
- Test: `okr.schema.spec.ts`

**Interfaces:**
- Produces Drizzle tables + enums:
  - `objectiveScope` enum `['org','department','team']`; `objectiveStatus` enum `['draft','active','completed','archived']`; `krMetricType` enum `['number','percent','currency','boolean']`; `krDirection` enum `['increase','decrease']`; `initiativeStatus` enum `['not_started','in_progress','blocked','paused','completed','cancelled']`; `interventionStatus` enum `['planned','active','measuring','concluded']`.
  - `objective` `{ title, description?, ownerPersonId, scope, scopeRefId?, period, status }`
  - `keyResult` `{ objectiveId, title, metricType, unit?, startValue, targetValue, currentValue, direction }` (numeric values as `decimal`)
  - `initiative` `{ title, description?, ownerPersonId, priority, dueDate? }`
  - `initiativeKeyResult` join `{ initiativeId, keyResultId }`
  - `alignmentLink` `{ fromType ('objective'|'key_result'), fromId, toType, toId, weight }`
  - `intervention` `{ title, description?, decidedByPersonId, startedAt, scope, hypothesis?, measurementWindowDays, status }` + `interventionKeyResult` join `{ interventionId, keyResultId }`

- [ ] **Step 1: Implement `okr.schema.ts`** (import `defaultFields` from `identity.schema`). Full enum + table definitions per the interface above, each with `...defaultFields` and sensible indexes (`objective_owner_index`, `key_result_objective_index`, `initiative_owner_index`, `initiative_status_index` — note status here is *denormalized convenience*; the source of truth is the event log/projection in Task 10). Numeric KR values: `decimal('start_value', { precision: 20, scale: 4 })` etc.
- [ ] **Step 2: Re-export from `schema/index.ts`.**
- [ ] **Step 3: Schema column test** (mirror Task 4 Step 4) asserting key columns exist on `objective`, `keyResult`, `initiative`, `alignmentLink`. Run, expect PASS.
- [ ] **Step 4: `yarn db:generate`** → review migration SQL. **Commit** `feat: OKR Drizzle schema (objective/key-result/initiative/alignment/intervention)`.

---

## Task 10: Tracking schema (event log + projections)

**Files:**
- Create: `backend/src/infra/application-db/schema/tracking.schema.ts`
- Modify: `schema/index.ts`
- Test: `tracking.schema.spec.ts`

**Interfaces:**
- Produces:
  - `eventSource` enum `['human','agent','integration']`; `subjectType` enum `['initiative','key_result','objective']`; `activityEventType` enum (lifecycle + signals): `['created','started','paused','resumed','blocked','unblocked','cancelled','completed','time_logged','reason_recorded','outcome_recorded','note_added','key_result_measured']`.
  - **`activityEvent`** (append-only — **no** `updatedAt/deletedAt/isDeleted` from `defaultFields`; instead its own minimal columns): `{ id serial pk, slug uuid, occurredAt timestamptz, recordedAt timestamptz default now, actorPersonId int, subjectType, subjectId int, type activityEventType, payload jsonb, source eventSource default 'human', confidence decimal?, rawInputId int?, correlationId uuid? }` with indexes on `(subjectType, subjectId)`, `occurredAt` (BRIN), `type`, and a GIN index on `payload`.
  - `rawInput` `{ personId, channel ('web'|'slack'|'voice'|'integration'), text, receivedAt, metadata jsonb }` (Phase-2 fed; table exists now for FK stability).
  - `reasonTaxonomy` `{ label, category }`.
  - **Projections** (`...defaultFields`, mutated by the projector): `initiativeState` `{ initiativeId unique, status initiativeStatus, totalTimeLoggedMinutes int default 0, blockedSince timestamptz?, lastEventAt timestamptz? }`; `keyResultMeasurement` (append-style series, but mutable rows allowed) `{ keyResultId, value decimal, measuredAt timestamptz, sourceEventId int }`.

- [ ] **Step 1: Implement `tracking.schema.ts`.** Define a **local** append-only id/slug block for `activityEvent` (do NOT spread the full `defaultFields`, to honor the append-only law). BRIN index example:

```typescript
import { sql } from 'drizzle-orm';
import { index } from 'drizzle-orm/pg-core';
// inside the table's index callback:
//   index('activity_event_occurred_brin').using('brin', t.occurredAt),
//   index('activity_event_subject_index').on(t.subjectType, t.subjectId),
//   index('activity_event_payload_gin').using('gin', t.payload),
```

- [ ] **Step 2: Re-export. Schema column test** asserting `activityEvent` has NO `isDeleted` column and HAS `payload`, `occurredAt`, `subjectId`. Run, expect PASS.
- [ ] **Step 3: `yarn db:generate`** → confirm the migration creates BRIN/GIN indexes (hand-edit the generated SQL if drizzle-kit emits btree for these — add `USING brin`/`USING gin`). **Commit** `feat: tracking schema — append-only activity_event + projections`.

---

## Task 11: Objective + Key Result modules (CRUD)

**Files:**
- Create: `module-objective/objective.{module,controller,repo,dto,interface}.ts`
- Create: `module-key-result/key-result.{module,controller,repo,dto,interface}.ts`
- Test: `objective.repo.spec.ts`, `key-result.repo.spec.ts`

**Interfaces:**
- Produces `ObjectiveRepository` (`findByOwner`, `findByScope(scope, scopeRefId, ctx)`), `KeyResultRepository` (`findByObjectiveId(objectiveId, ctx)`, `updateCurrentValue(id, value, ctx)`). Interfaces follow the Task 6 Step-1 layering.

- [ ] **Steps:** Mirror Task 6 for both. Deltas:
  - Objective profile `{ title; description?; ownerPersonId; scope; scopeRefId?; period; status }`; `query()` filters `title, ownerPersonId, scope, status, period`; join owner name via `leftJoin(person, eq(objective.ownerPersonId, person.id))` exposing `ownerName` (mirrors task→project join).
  - KeyResult profile `{ objectiveId; title; metricType; unit?; startValue; targetValue; currentValue; direction }`; `findByObjectiveId`; `updateCurrentValue` does a normal `update` setting `currentValue` (this is a convenience cache; canonical history lives in `keyResultMeasurement`).
  - Write roles `admin, manager`; reads all roles.
- [ ] **Commit** `feat: objective + key-result CRUD modules`.

---

## Task 12: Initiative module (CRUD + KR linking)

**Files:**
- Create: `module-initiative/initiative.{module,controller,repo,dto,interface}.ts`
- Test: `initiative.repo.spec.ts`

**Interfaces:**
- Produces `InitiativeRepository`: standard CRUD + `linkKeyResult(initiativeId, keyResultId, ctx)`, `unlinkKeyResult(...)`, `findKeyResultIds(initiativeId, ctx)`, `findByOwner(ownerPersonId, ctx)`. Note: `initiative` has NO authoritative `status` column logic here — status is read from the `initiativeState` projection (Task 14). The CRUD `create` sets initial denormalized `status='not_started'` only as a convenience mirror.

- [ ] **Step 1-5:** Mirror Task 6. Profile `{ title; description?; ownerPersonId; priority; dueDate? }`. `query()` filters `title, ownerPersonId, priority`.
- [ ] **Step 6: Add link methods** with a focused failing test first:

```typescript
it('links and lists key results for an initiative', async () => {
  const ctx = makeCtx();
  const i = await repo.create({ title: 'Close Acme', ownerPersonId: 1, priority: 'high' }, ctx);
  await repo.linkKeyResult(i.id, 7, ctx);
  expect(await repo.findKeyResultIds(i.id, ctx)).toContain(7);
});
```

Implement via inserts/deletes on `initiativeKeyResult`. **Commit** `feat: initiative CRUD + key-result linking`.

---

## Task 13: Alignment + OKR tree aggregation

**Files:**
- Create: `module-alignment/alignment.{module,controller,repo,dto,interface}.ts`
- Create: `module-alignment/okr-tree.service.ts`
- Test: `alignment.repo.spec.ts`, `okr-tree.service.spec.ts`

**Interfaces:**
- Produces:
  - `AlignmentRepository`: `link({ fromType, fromId, toType, toId, weight }, ctx)`, `unlink(id, ctx)`, `findChildren(toType, toId, ctx)`, `findParents(fromType, fromId, ctx)`.
  - `OkrTreeService.buildTree(rootObjectiveId, ctx): Promise<OkrTreeNode>` where `OkrTreeNode = { objective; keyResults: KrProgress[]; children: OkrTreeNode[] }` and `KrProgress = { keyResult; progressPct; paceStatus: 'ahead'|'on_track'|'behind' }`.
  - `OkrTreeService.computeKrProgress(kr): KrProgress` — `progressPct = (current-start)/(target-start)` clamped 0..1, direction-aware; `paceStatus` from `progressPct` vs. elapsed fraction of the objective `period` (simple linear pace this phase).

- [ ] **Step 1: Write failing test** `okr-tree.service.spec.ts`

```typescript
it('computes direction-aware progress and pace', () => {
  const svc = new OkrTreeService(/* mocked repos */);
  const kr = { startValue: '0', targetValue: '100', currentValue: '40', direction: 'increase' } as any;
  const p = svc.computeKrProgress(kr);
  expect(p.progressPct).toBeCloseTo(0.4);
});
it('builds a nested tree following alignment links', async () => {
  // mock repos: root objective with 2 KRs and one aligned child objective
  const tree = await svc.buildTree(1, makeCtx());
  expect(tree.children).toHaveLength(1);
  expect(tree.keyResults).toHaveLength(2);
});
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement `okr-tree.service.ts`** — pure `computeKrProgress` (testable without DB) + `buildTree` recursing over `AlignmentRepository.findChildren('objective', id)` and pulling KRs via `KeyResultRepository.findByObjectiveId`. Guard against cycles with a visited-set.
- [ ] **Step 4: Implement `AlignmentRepository`** (mirror repo pattern; table `alignmentLink`).
- [ ] **Step 5: Controller** — `GET /okr/tree/:objectiveSlug` → resolves slug→id, returns `buildTree`. `POST /alignment/link`, `POST /alignment/unlink` (roles `admin, manager`).
- [ ] **Step 6: Run tests, expect PASS. Commit** `feat: alignment links + OKR tree aggregation with pace-to-target`.

---

## Task 14: Activity-event repository (append-only writer) + event taxonomy

**Files:**
- Create: `module-tracking/activity-event.repo.ts`, `tracking.interface.ts`, `tracking.events.ts`
- Test: `activity-event.repo.spec.ts`

**Interfaces:**
- Produces:
  - `tracking.interface.ts`: `IActivityEventInput { occurredAt?: string; actorPersonId: number; subjectType: 'initiative'|'key_result'|'objective'; subjectId: number; type: ActivityEventType; payload?: Record<string, unknown>; source?: 'human'|'agent'|'integration'; confidence?: number | null; rawInputId?: number | null; correlationId?: string | null }`; `IActivityEventEntity` (row shape). `type ActivityEventType = 'created'|'started'|...|'key_result_measured'`.
  - `ActivityEventRepository.append(input, ctx): Promise<IActivityEventEntity>` (INSERT only; defaults `occurredAt=now`, `source='human'`). **No update/delete methods.**
  - `ActivityEventRepository.listBySubject(subjectType, subjectId, ctx): Promise<IActivityEventEntity[]>` (ordered by `occurredAt asc`).
  - `tracking.events.ts`: a NestJS event-emitter payload type `ActivityEventEmitted { event: IActivityEventEntity; ctx: IDBConfigOptions }` and constant `ACTIVITY_EVENT_EMITTED = 'activity_event.emitted'`.

- [ ] **Step 1: Write failing test** `activity-event.repo.spec.ts`

```typescript
it('append inserts an immutable event and listBySubject returns it in order', async () => {
  const ctx = makeCtx();
  const e1 = await repo.append({ actorPersonId: 1, subjectType: 'initiative', subjectId: 5, type: 'started' }, ctx);
  const e2 = await repo.append({ actorPersonId: 1, subjectType: 'initiative', subjectId: 5, type: 'completed', payload: { result: 'won' } }, ctx);
  const list = await repo.listBySubject('initiative', 5, ctx);
  expect(list.map(e => e.type)).toEqual(['started', 'completed']);
  expect(list[1].payload).toEqual({ result: 'won' });
});
it('has no update or delete method', () => {
  expect((repo as any).update).toBeUndefined();
  expect((repo as any).delete).toBeUndefined();
});
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement `activity-event.repo.ts`** — `@Injectable`, inject `ApplicationDBProvider`. `append()` does a single `insert(activityEvent).values({...}).returning()`, `occurredAt: input.occurredAt ?? new Date().toISOString()`. `listBySubject()` selects ordered by `occurredAt asc`. Wrap in `try/catch/finally release`. Deliberately omit `update`/`delete`.
- [ ] **Step 4: Run, expect PASS. Commit** `feat: append-only activity-event repository + event taxonomy`.

---

## Task 15: Projector (events → initiative_state) via event bus

**Files:**
- Create: `module-tracking/projection/initiative-state.repo.ts`, `projection/initiative-state.projector.ts`
- Test: `initiative-state.projector.spec.ts`

**Interfaces:**
- Produces:
  - `InitiativeStateRepository.upsert(initiativeId, patch, ctx)`, `findByInitiativeId(initiativeId, ctx)`.
  - `InitiativeStateProjector.apply(event, ctx)` and an `@OnEvent(ACTIVITY_EVENT_EMITTED)` handler that calls `apply`. Mapping: `started→status='in_progress'`; `paused→status='paused', blockedSince=null`; `blocked→status='blocked', blockedSince=occurredAt`; `unblocked/resumed→status='in_progress', blockedSince=null`; `completed→status='completed'`; `cancelled→status='cancelled'`; `time_logged→totalTimeLoggedMinutes += payload.minutes`; every event sets `lastEventAt=occurredAt`.

- [ ] **Step 1: Write failing test** `initiative-state.projector.spec.ts` (unit-test `apply` with a mocked `InitiativeStateRepository`)

```typescript
it('blocked sets status=blocked and blockedSince', async () => {
  const repo = { upsert: vi.fn(), findByInitiativeId: vi.fn() };
  const projector = new InitiativeStateProjector(repo as any);
  await projector.apply({ subjectType: 'initiative', subjectId: 9, type: 'blocked', occurredAt: '2026-06-27T10:00:00Z' } as any, makeCtx());
  expect(repo.upsert).toHaveBeenCalledWith(9, expect.objectContaining({ status: 'blocked', blockedSince: '2026-06-27T10:00:00Z' }), expect.anything());
});
it('time_logged accumulates minutes', async () => { /* upsert called with totalTimeLoggedMinutes increment */ });
it('ignores non-initiative subjects', async () => { /* upsert NOT called for subjectType key_result */ });
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement projector + repo.** `apply` switches on `event.type`; for `time_logged` it reads current state via `findByInitiativeId` then upserts the new total. The `@OnEvent` handler delegates to `apply`. Register projector + repo as providers in `TrackingModule`.
- [ ] **Step 4: Run, expect PASS. Commit** `feat: initiative-state projector driven by the activity-event bus`.

---

## Task 16: Tracking capture endpoints (manual) + KR measurement

**Files:**
- Create: `module-tracking/tracking.service.ts`, `tracking.controller.ts`, `tracking.dto.ts`, `tracking.module.ts`
- Create: `module-tracking/projection/key-result-measurement.repo.ts`
- Test: `tracking.service.spec.ts`

**Interfaces:**
- Produces:
  - `TrackingService` methods, each appends an event AND emits `ACTIVITY_EVENT_EMITTED`: `start/pause/resume/block/unblock/complete/cancel(initiativeId, actorId, ctx, payload?)`, `logTime(initiativeId, actorId, minutes, ctx)`, `recordReason(subjectType, subjectId, actorId, { reason, reasonClass? }, ctx)`, `recordOutcome(initiativeId, actorId, { result }, ctx)`, `measureKeyResult(keyResultId, actorId, value, ctx)` (appends `key_result_measured` event, writes a `keyResultMeasurement` row, updates the KR `currentValue` cache).
  - `KeyResultMeasurementRepository.add(keyResultId, value, measuredAt, sourceEventId, ctx)`, `seriesFor(keyResultId, ctx)`.
  - REST: `POST /tracking/initiatives/:slug/{start|pause|resume|block|unblock|complete|cancel}`, `POST /tracking/initiatives/:slug/time`, `POST /tracking/initiatives/:slug/reason`, `POST /tracking/initiatives/:slug/outcome`, `POST /tracking/key-results/:slug/measure`. All `@Roles(member, manager, admin, executive)`; actor = `req.user.id`.

- [ ] **Step 1: Write failing test** `tracking.service.spec.ts`

```typescript
it('start() appends a started event and emits it', async () => {
  const append = vi.fn().mockResolvedValue({ id: 1, type: 'started', subjectId: 5, subjectType: 'initiative' });
  const emitter = { emit: vi.fn() };
  const svc = new TrackingService({ append } as any, emitter as any, /* kr repos */ {} as any, {} as any);
  await svc.start(5, 1, makeCtx());
  expect(append).toHaveBeenCalledWith(expect.objectContaining({ subjectId: 5, type: 'started', actorPersonId: 1 }), expect.anything());
  expect(emitter.emit).toHaveBeenCalledWith(ACTIVITY_EVENT_EMITTED, expect.anything());
});
it('measureKeyResult appends event + writes measurement series row', async () => { /* both called; currentValue updated */ });
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement `TrackingService`** (inject `ActivityEventRepository`, `EventEmitter2`, `KeyResultMeasurementRepository`, `KeyResultRepository`). Each mutator builds the event input, `append`s, then `eventEmitter.emit(ACTIVITY_EVENT_EMITTED, { event, ctx })`. `block` sets `payload`/type `blocked`; `logTime` type `time_logged` payload `{ minutes }`; etc.
- [ ] **Step 4: Implement controller + DTOs** (slug→id resolution via the relevant repo; envelopes). Register `TrackingModule` (provides service, both projection repos, projector, activity-event repo; imports `ApplicationDbModule`, `AuthModule`, `InitiativeModule`, `KeyResultModule`) in `MainModule`.
- [ ] **Step 5: Run, expect PASS.** Add one **integration test** `tracking.e2e-spec.ts`: POST start→block→complete on a seeded initiative, then GET its state and assert `status='completed'` (verifies the bus+projector wire end-to-end).
- [ ] **Step 6: Commit** `feat: manual tracking capture endpoints + KR measurement series`.

---

## Task 17: Intervention module (declare decisions; measurement deferred to Phase 4)

**Files:**
- Create: `module-intervention/intervention.{module,controller,repo,dto,interface}.ts`
- Test: `intervention.repo.spec.ts`

**Interfaces:**
- Produces `InterventionRepository`: CRUD + `linkKeyResult(interventionId, keyResultId, ctx)`, `findAffectedKeyResultIds(id, ctx)`. Profile `{ title; description?; decidedByPersonId; startedAt; scope; hypothesis?; measurementWindowDays; status }`.

- [ ] **Steps:** Mirror Task 6 + the link-method pattern from Task 12. No measurement logic this phase (Phase 4). Status defaults `'planned'`; allow transition to `'active'` via update. Write roles `admin, manager`. **Commit** `feat: intervention module (decision declaration; measurement deferred)`.

---

## Task 18: Frontend — OKR tree, My Work, Initiative timeline

**Files:**
- Create: `frontend/src/pages/OkrTree.tsx`, `MyWork.tsx`, `InitiativeTimeline.tsx`
- Create: `frontend/src/lib/queries.ts` (TanStack Query hooks), `components/KrProgressBar.tsx`, `components/CaptureBar.tsx`
- Test: `frontend/src/lib/queries.test.ts`, `components/KrProgressBar.test.tsx`

**Interfaces:**
- Produces:
  - Query hooks: `useOkrTree(objectiveSlug)`, `useMyInitiatives()`, `useInitiativeTimeline(slug)`, mutations `useStartInitiative/usePauseInitiative/.../useLogTime/useMeasureKr`.
  - `OkrTree.tsx`: recursive render of `OkrTreeNode` with `<KrProgressBar progressPct paceStatus/>`; drill-down by department.
  - `MyWork.tsx`: the current user's initiatives + a `<CaptureBar/>` per initiative exposing start/pause/block/complete/log-time/record-outcome buttons (calls the Task 16 endpoints). **This is the adoption-critical surface — keep it one click per common action.**
  - `InitiativeTimeline.tsx`: vertical timeline of `listBySubject` events (icon per `type`, time, actor, payload summary).

- [ ] **Step 1: Write failing test** `KrProgressBar.test.tsx` (renders width % and a pace color class for `behind`). Run, expect FAIL.
- [ ] **Step 2: Implement `KrProgressBar.tsx`**, make it pass.
- [ ] **Step 3: Write failing test** `queries.test.ts` (mock `apiClient`; assert `useStartInitiative` POSTs to `/tracking/initiatives/:slug/start`). Implement `queries.ts`, make it pass.
- [ ] **Step 4: Implement the three pages**, wire routes in `router.tsx`, add nav links in `AppShell`.
- [ ] **Step 5: Manual verification** (`yarn dev` both apps): create an objective+KR+initiative (via API or a quick admin form), see it in OKR Tree, start→complete it from My Work, watch the timeline populate and the projection status change.
- [ ] **Step 6: Commit** `feat: OKR tree, My Work capture, and initiative timeline UI`.

---

# Self-Review (performed against the spec — Phase 0 + 1 scope)

**Spec coverage (Phase 0):** monorepo + Postgres + migrations (T0,T2,T4,T9,T10) ✓; identity org/dept/team/people/roles (T4,T6,T7) ✓; auth (T5) ✓; UI shell (T8) ✓.
**Spec coverage (Phase 1):** okr module Objective/KR/Initiative + alignment (T9,T11,T12,T13) ✓; OKR tree UI (T18) ✓; My Work (T18) ✓; event log + projections (T10,T14,T15) ✓; manual entry of status/time/reason/outcome (T16) ✓; Initiative timeline (T18) ✓. Intervention entity is declared now (T17) though measurement is Phase 4 — matches the roadmap (table exists early for FK stability, per spec §5.2).
**Deferred-by-design (NOT in this plan, per spec):** AI-assisted capture, intelligence jobs, integrations, intervention *measurement*, assisted action — all later phases. `rawInput`/`reasonTaxonomy` tables are created now but only populated in Phase 2.
**Placeholder scan:** no "TBD/handle errors/etc." — every error path uses `AppException.throw` with a named code; repetitive CRUD points at the concrete reference file `module-task` with explicit deltas (not a vague "similar to").
**Type consistency:** `IDBConfigOptions {database_uri,schema_id,user_id}` is identical across T2/repos; `ACTIVITY_EVENT_EMITTED` + `ActivityEventEmitted` payload identical across T14/T15/T16; `ActivityEventType` union defined in T14 and consumed unchanged in T15/T16; `OkrTreeNode`/`KrProgress` defined in T13 and consumed in T18.

# Risks specific to this build

- **BRIN/GIN indexes:** drizzle-kit may emit btree; T10 Step 3 hand-checks the SQL. Verify with `\d+ activity_event` after migrate.
- **Append-only enforcement:** the repo omits update/delete (T14), but nothing stops raw SQL. Optional hardening (later): a Postgres rule/trigger rejecting `UPDATE/DELETE` on `activity_event`.
- **Test DB:** repo specs need a real Postgres; `test/db-setup.ts` (T6) creates/drops a throwaway schema per run. CI must provide `DATABASE_MAIN_*`.
- **Projection rebuild:** not built this phase; since events are the source of truth, a `rebuild` script (replay all events → truncate+recompute projections) is a natural Phase-2 addition. Noted, not built (YAGNI now).
