# Redis Cache + BullMQ Infra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `infra/cache` (Redis-backed cache-manager) and `infra/queue` (BullMQ + Job Scheduler sub-module) global modules to the backend, replace `@nestjs/schedule`, and extend `/api/health/ready` to aggregate Redis + DB readiness.

**Architecture:** Two `@Global()` infra modules share one Redis server on separate DB indexes with separate ioredis connections (BullMQ requires `maxRetriesPerRequest: null`). A declarative `schedule.config.ts` drives a registrar that upserts/prunes BullMQ Job Schedulers on bootstrap. Health readiness delegates to a new `ReadinessService` that runs three parallel pings.

**Tech Stack:** NestJS 10, `@nestjs/cache-manager` v2, `cache-manager` v5, `cache-manager-ioredis-yet` v2, `@nestjs/bullmq` v11, `bullmq` v5, `ioredis` v5, Jest/ts-jest.

## Global Constraints

- All files live under `backend/src/`; all import aliases use `src/` prefix (configured in `tsconfig`).
- Run all test commands from the `backend/` directory.
- Keep `env.ts` as the single source of truth for env vars — never read `process.env` directly.
- No custom `CacheService` wrapper — consumers use `@Inject(CACHE_MANAGER)` directly.
- `@nestjs/schedule` is removed in Task 8 only — removing it earlier breaks the build.
- Queue names are enum values from `queue.constants.ts` — never use raw strings elsewhere.
- The empty `infra/bullmq/` directory is removed in Task 4 (the spec uses `infra/queue/`).

---

## File Map

**Create:**
- `backend/src/infra/cache/cache.constants.ts` — TTL constants + namespaced key builders
- `backend/src/infra/cache/cache.module.ts` — `@Global()` `CacheModule.registerAsync` with ioredis store
- `backend/src/infra/queue/queue.constants.ts` — `QueueName` enum + `DEFAULT_JOB_OPTIONS`
- `backend/src/infra/queue/queue.module.ts` — `@Global()` `BullModule.forRootAsync` + example queue + schedule import
- `backend/src/infra/queue/base.processor.ts` — abstract `WorkerHost` subclass with structured logging
- `backend/src/infra/queue/base.processor.spec.ts`
- `backend/src/infra/queue/example/example.processor.ts` — `@Processor(EXAMPLE)` proving the pattern
- `backend/src/infra/queue/example/example.processor.spec.ts`
- `backend/src/infra/queue/schedule/schedule.config.ts` — typed array of `ScheduledJob` entries
- `backend/src/infra/queue/schedule/schedule.registrar.ts` — `OnApplicationBootstrap` upsert + prune
- `backend/src/infra/queue/schedule/schedule.module.ts` — wires `ScheduleRegistrar`
- `backend/src/infra/queue/schedule/schedule.registrar.spec.ts`
- `backend/src/infra/health/health.module.ts` — provides + exports `ReadinessService`
- `backend/src/infra/health/readiness.service.ts` — parallel db + redisCache + redisBull pings
- `backend/src/infra/health/readiness.service.spec.ts`

**Modify:**
- `backend/src/utils/env.ts` — rename `REDIS_BULLMQ_{HOST,PORT,PASSWORD}` → `REDIS_{HOST,PORT,PASSWORD}`; add `REDIS_CACHE_DB`
- `backend/.env` — rename vars to match new env schema
- `backend/src/app.module.ts` — remove `ScheduleModule.forRoot()`; add `InfraCacheModule`, `QueueModule`, `HealthModule`
- `backend/src/app.controller.ts` — inject `ReadinessService` instead of `ApplicationDBProvider`

---

### Task 1: Refactor Redis env vars

Update `env.ts` and `.env` to the unified `REDIS_*` naming. This is a safe rename — the old vars are defined in `env.ts` and `.env` but are **not imported anywhere in source code** (the infra dirs are currently empty).

**Files:**
- Modify: `backend/src/utils/env.ts`
- Modify: `backend/.env`

**Interfaces:**
- Produces: `env.REDIS_HOST`, `env.REDIS_PORT`, `env.REDIS_PASSWORD`, `env.REDIS_CACHE_DB`, `env.REDIS_BULLMQ_DB` — used by Tasks 2–8.

- [ ] **Step 1: Update `env.ts`**

Replace the existing Redis block (lines 31–35):

```typescript
// Old — remove these 4 lines:
REDIS_BULLMQ_HOST: z.string().default('localhost'),
REDIS_BULLMQ_PORT: z.coerce.number().default(6379),
REDIS_BULLMQ_PASSWORD: z.string().optional(),
REDIS_BULLMQ_DB: z.coerce.number().default(0),
```

With:

```typescript
// New shared Redis config:
REDIS_HOST: z.string().default('localhost'),
REDIS_PORT: z.coerce.number().default(6379),
REDIS_PASSWORD: z.string().optional(),
REDIS_CACHE_DB: z.coerce.number().default(1),
REDIS_BULLMQ_DB: z.coerce.number().default(0),
```

The full updated Redis block in `env.ts` (inside the `z.object({...})` call):

```typescript
// redis
REDIS_HOST: z.string().default('localhost'),
REDIS_PORT: z.coerce.number().default(6379),
REDIS_PASSWORD: z.string().optional(),
REDIS_CACHE_DB: z.coerce.number().default(1),
REDIS_BULLMQ_DB: z.coerce.number().default(0),
```

- [ ] **Step 2: Update `.env`**

Replace the Redis block in `backend/.env`:

```
# Remove:
REDIS_BULLMQ_HOST=localhost
REDIS_BULLMQ_PORT=30490
REDIS_BULLMQ_PASSWORD=Aasi639fDYja87JUYhsdqekPPOisdqJ98123Huf
REDIS_BULLMQ_DB=0
```

With:

```
# Redis (shared; separate DB index per purpose)
REDIS_HOST=localhost
REDIS_PORT=30490
REDIS_PASSWORD=Aasi639fDYja87JUYhsdqekPPOisdqJ98123Huf
REDIS_CACHE_DB=1
REDIS_BULLMQ_DB=0
```

- [ ] **Step 3: Verify existing test suite still passes**

```bash
cd backend && yarn test
```

Expected: all existing tests pass (env schema parses the new vars from `.env`; no source files referenced the old `REDIS_BULLMQ_HOST/PORT/PASSWORD` keys).

- [ ] **Step 4: Commit**

```bash
git add backend/src/utils/env.ts backend/.env
git commit -m "refactor(env): unify Redis env vars under REDIS_HOST/PORT/PASSWORD/CACHE_DB/BULLMQ_DB"
```

---

### Task 2: Install cache-manager packages

**Files:**
- Modify: `backend/package.json` (via yarn)

**Interfaces:**
- Produces: `@nestjs/cache-manager`, `cache-manager`, `cache-manager-ioredis-yet` available to import in Task 3.

- [ ] **Step 1: Install packages**

```bash
cd backend && yarn add @nestjs/cache-manager cache-manager cache-manager-ioredis-yet
```

Expected: packages added to `backend/package.json` dependencies and `yarn.lock` updated.

- [ ] **Step 2: Verify TypeScript compiler sees the types**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors (existing code unchanged; new packages are not yet imported).

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/yarn.lock
git commit -m "chore(deps): add @nestjs/cache-manager, cache-manager, cache-manager-ioredis-yet"
```

---

### Task 3: Cache module

Create the `@Global()` cache module. No custom unit tests needed — the module has zero business logic; its correctness is verified by the compile check and the integration test in Task 8's full run.

**Files:**
- Create: `backend/src/infra/cache/cache.constants.ts`
- Create: `backend/src/infra/cache/cache.module.ts`

**Interfaces:**
- Produces:
  - `CACHE_DEFAULT_TTL_MS: number` — 5 min in ms
  - `CACHE_TTL_SHORT: number` — 1 min in ms
  - `CACHE_TTL_MEDIUM: number` — 15 min in ms
  - `cacheKey.person(id: string): string` — `'cyb:person:<id>'`
  - `cacheKey.organization(id: string): string` — `'cyb:org:<id>'`
  - `cacheKey.team(id: string): string` — `'cyb:team:<id>'`
  - `InfraCacheModule` — NestJS module class (used by Tasks 8)

- [ ] **Step 1: Create `cache.constants.ts`**

```typescript
// backend/src/infra/cache/cache.constants.ts
export const CACHE_DEFAULT_TTL_MS = 5 * 60 * 1000;
export const CACHE_TTL_SHORT = 60 * 1000;
export const CACHE_TTL_MEDIUM = 15 * 60 * 1000;

export const cacheKey = {
  person: (id: string) => `cyb:person:${id}`,
  organization: (id: string) => `cyb:org:${id}`,
  team: (id: string) => `cyb:team:${id}`,
};
```

- [ ] **Step 2: Create `cache.module.ts`**

```typescript
// backend/src/infra/cache/cache.module.ts
import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';
import env from 'src/utils/env';
import { CACHE_DEFAULT_TTL_MS } from './cache.constants';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          password: env.REDIS_PASSWORD,
          db: env.REDIS_CACHE_DB,
        }),
        ttl: CACHE_DEFAULT_TTL_MS,
      }),
    }),
  ],
})
export class InfraCacheModule {}
```

- [ ] **Step 3: Compile check**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/infra/cache/
git commit -m "feat(infra/cache): add global ioredis-backed CacheModule with namespaced key helpers"
```

---

### Task 4: Queue constants + QueueModule scaffolding

Create the queue constants and the global BullMQ module. Also delete the empty `infra/bullmq/` directory (the spec uses `infra/queue/`).

**Files:**
- Create: `backend/src/infra/queue/queue.constants.ts`
- Create: `backend/src/infra/queue/queue.module.ts`
- Delete: `backend/src/infra/bullmq/` (empty directory)

**Interfaces:**
- Produces:
  - `QueueName.EXAMPLE = 'example'` — used in Tasks 5, 6, 7, 8
  - `DEFAULT_JOB_OPTIONS` — used by QueueModule internally
  - `QueueModule` — NestJS module class (used in Task 8)

Note: `QueueModule` imports `InfraScheduleModule` (created in Task 6). To avoid a circular reference, `InfraScheduleModule` is forward-referenced with `forwardRef()` in `queue.module.ts`. The actual `InfraScheduleModule` import is written here with a placeholder path that will resolve once Task 6 creates the file.

- [ ] **Step 1: Remove the empty `infra/bullmq/` directory**

```bash
rmdir backend/src/infra/bullmq
git rm -r --cached backend/src/infra/bullmq 2>/dev/null || true
```

- [ ] **Step 2: Create `queue.constants.ts`**

```typescript
// backend/src/infra/queue/queue.constants.ts
export enum QueueName {
  EXAMPLE = 'example',
}

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};
```

- [ ] **Step 3: Create `queue.module.ts`**

```typescript
// backend/src/infra/queue/queue.module.ts
import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import env from 'src/utils/env';
import { DEFAULT_JOB_OPTIONS, QueueName } from './queue.constants';
import { ExampleProcessor } from './example/example.processor';
import { InfraScheduleModule } from './schedule/schedule.module';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          password: env.REDIS_PASSWORD,
          db: env.REDIS_BULLMQ_DB,
          maxRetriesPerRequest: null,
        },
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    }),
    BullModule.registerQueue({ name: QueueName.EXAMPLE }),
    InfraScheduleModule,
  ],
  providers: [ExampleProcessor],
  exports: [BullModule],
})
export class QueueModule {}
```

> Note: `ExampleProcessor` (Task 5) and `InfraScheduleModule` (Task 6) don't exist yet — the TypeScript compile check in Step 4 is expected to fail until those tasks are complete. The file is written here so Tasks 5 and 6 can target their correct paths.

- [ ] **Step 4: Compile check (expected to show missing imports — that is OK)**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -10
```

Expected: errors about `ExampleProcessor` and `InfraScheduleModule` not found — both resolved in Tasks 5 and 6.

- [ ] **Step 5: Commit**

```bash
git add backend/src/infra/queue/queue.constants.ts backend/src/infra/queue/queue.module.ts
git rm -rf --cached backend/src/infra/bullmq 2>/dev/null || true
git commit -m "feat(infra/queue): add QueueModule scaffold with QueueName enum and BullMQ root config"
```

---

### Task 5: BaseProcessor

**Files:**
- Create: `backend/src/infra/queue/base.processor.ts`
- Test: `backend/src/infra/queue/base.processor.spec.ts`

**Interfaces:**
- Consumes: `bullmq.Job`, `@nestjs/bullmq.WorkerHost`, `@nestjs/bullmq.OnWorkerEvent`
- Produces: `abstract class BaseProcessor extends WorkerHost` with:
  - `process(job: Job): Promise<unknown>` — logs timing, calls `handle()`, rethrows on failure
  - `abstract handle(job: Job): Promise<unknown>` — subclasses implement this
  - `@OnWorkerEvent` hooks for `completed`, `failed`, `stalled`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/infra/queue/base.processor.spec.ts
import { Job } from 'bullmq';

// Mock @nestjs/bullmq so WorkerHost doesn't try to create a real Worker
jest.mock('@nestjs/bullmq', () => ({
  WorkerHost: class {
    worker: unknown;
  },
  OnWorkerEvent: () => () => undefined,
  Processor: () => () => undefined,
}));

// Import after mock
import { BaseProcessor } from './base.processor';

class ConcreteProcessor extends BaseProcessor {
  async handle(_job: Job): Promise<string> {
    return 'result';
  }
}

const makeJob = (overrides: Partial<Job> = {}): Job =>
  ({
    id: 'job-1',
    name: 'test-job',
    queueName: 'example',
    attemptsMade: 0,
    data: { foo: 'bar' },
    ...overrides,
  } as unknown as Job);

describe('BaseProcessor', () => {
  let processor: ConcreteProcessor;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    processor = new ConcreteProcessor();
    logSpy = jest.spyOn(processor['logger'], 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(processor['logger'], 'error').mockImplementation(() => undefined);
  });

  it('returns handle() result and emits structured success log', async () => {
    const result = await processor.process(makeJob());
    expect(result).toBe('result');
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'job:completed',
        queue: 'example',
        jobId: 'job-1',
        name: 'test-job',
      }),
    );
  });

  it('emits structured error log and rethrows when handle() throws', async () => {
    const boom = new Error('boom');
    jest.spyOn(processor, 'handle').mockRejectedValue(boom);
    await expect(processor.process(makeJob())).rejects.toThrow('boom');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'job:failed',
        queue: 'example',
        jobId: 'job-1',
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && yarn test --testPathPattern="base.processor" --no-coverage
```

Expected: FAIL — `Cannot find module './base.processor'`.

- [ ] **Step 3: Create `base.processor.ts`**

```typescript
// backend/src/infra/queue/base.processor.ts
import { Logger } from '@nestjs/common';
import { OnWorkerEvent, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

export abstract class BaseProcessor extends WorkerHost {
  protected readonly logger = new Logger(this.constructor.name);

  async process(job: Job): Promise<unknown> {
    const start = Date.now();
    const ctx = {
      queue: job.queueName,
      jobId: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade,
    };
    try {
      const result = await this.handle(job);
      this.logger.log({ msg: 'job:completed', ...ctx, durationMs: Date.now() - start });
      return result;
    } catch (err) {
      this.logger.error({
        msg: 'job:failed',
        ...ctx,
        durationMs: Date.now() - start,
        error: (err as Error).message,
      });
      throw err;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug({ msg: 'worker:completed', jobId: job.id });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error) {
    this.logger.error({ msg: 'worker:failed', jobId: job?.id, error: err.message });
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn({ msg: 'worker:stalled', jobId });
  }

  abstract handle(job: Job): Promise<unknown>;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && yarn test --testPathPattern="base.processor" --no-coverage
```

Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/infra/queue/base.processor.ts backend/src/infra/queue/base.processor.spec.ts
git commit -m "feat(infra/queue): add BaseProcessor with structured logging and retry-safe rethrow"
```

---

### Task 6: ExampleProcessor

**Files:**
- Create: `backend/src/infra/queue/example/example.processor.ts`
- Test: `backend/src/infra/queue/example/example.processor.spec.ts`

**Interfaces:**
- Consumes: `BaseProcessor` from `../base.processor`, `QueueName.EXAMPLE` from `../queue.constants`
- Produces: `class ExampleProcessor extends BaseProcessor` annotated `@Processor(QueueName.EXAMPLE)` — `handle()` logs the job payload

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/infra/queue/example/example.processor.spec.ts
import { Job } from 'bullmq';

jest.mock('@nestjs/bullmq', () => ({
  WorkerHost: class {
    worker: unknown;
  },
  OnWorkerEvent: () => () => undefined,
  Processor: () => () => undefined,
}));

import { ExampleProcessor } from './example.processor';

describe('ExampleProcessor', () => {
  let processor: ExampleProcessor;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    processor = new ExampleProcessor();
    debugSpy = jest
      .spyOn(processor['logger'], 'debug')
      .mockImplementation(() => undefined);
  });

  it('processes job payload and logs debug', async () => {
    const job = {
      id: 'ex-1',
      name: 'heartbeat',
      queueName: 'example',
      attemptsMade: 0,
      data: { ts: 123 },
    } as unknown as Job;

    const result = await processor.handle(job);
    expect(result).toBeUndefined();
    expect(debugSpy).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'example:job', name: 'heartbeat' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && yarn test --testPathPattern="example.processor" --no-coverage
```

Expected: FAIL — `Cannot find module './example.processor'`.

- [ ] **Step 3: Create `example.processor.ts`**

```typescript
// backend/src/infra/queue/example/example.processor.ts
import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from '../base.processor';
import { QueueName } from '../queue.constants';

@Processor(QueueName.EXAMPLE)
export class ExampleProcessor extends BaseProcessor {
  async handle(job: Job): Promise<void> {
    this.logger.debug({ msg: 'example:job', name: job.name, data: job.data });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && yarn test --testPathPattern="example.processor" --no-coverage
```

Expected: PASS — 1 test.

- [ ] **Step 5: Verify compile check now resolves `ExampleProcessor` in `queue.module.ts`**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep "ExampleProcessor" | head -5
```

Expected: no errors for `ExampleProcessor` (only `InfraScheduleModule` still missing).

- [ ] **Step 6: Commit**

```bash
git add backend/src/infra/queue/example/
git commit -m "feat(infra/queue): add ExampleProcessor proving BullMQ registration and handle() pattern"
```

---

### Task 7: Schedule sub-module

**Files:**
- Create: `backend/src/infra/queue/schedule/schedule.config.ts`
- Create: `backend/src/infra/queue/schedule/schedule.registrar.ts`
- Create: `backend/src/infra/queue/schedule/schedule.module.ts`
- Test: `backend/src/infra/queue/schedule/schedule.registrar.spec.ts`

**Interfaces:**
- Consumes: `QueueName` from `../queue.constants`; `@nestjs/bullmq.InjectQueue`, `@nestjs/bullmq.getQueueToken`
- Produces:
  - `SCHEDULED_JOBS: ScheduledJob[]` — array of `{ id, queue, jobName, cron, data?, tz? }`
  - `class ScheduleRegistrar implements OnApplicationBootstrap` — upserts + prunes schedulers
  - `InfraScheduleModule` — NestJS module (imported by `QueueModule` in Task 4)

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/infra/queue/schedule/schedule.registrar.spec.ts
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ScheduleRegistrar } from './schedule.registrar';
import { SCHEDULED_JOBS } from './schedule.config';
import { QueueName } from '../queue.constants';

const mockUpsert = jest.fn().mockResolvedValue(undefined);
const mockGetSchedulers = jest.fn();
const mockRemove = jest.fn().mockResolvedValue(undefined);

const mockQueue = {
  upsertJobScheduler: mockUpsert,
  getJobSchedulers: mockGetSchedulers,
  removeJobScheduler: mockRemove,
};

describe('ScheduleRegistrar', () => {
  let registrar: ScheduleRegistrar;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ScheduleRegistrar,
        { provide: getQueueToken(QueueName.EXAMPLE), useValue: mockQueue },
      ],
    }).compile();
    registrar = module.get(ScheduleRegistrar);
  });

  it('upserts a job scheduler for each SCHEDULED_JOBS entry', async () => {
    mockGetSchedulers.mockResolvedValue([]);
    await registrar.onApplicationBootstrap();
    expect(mockUpsert).toHaveBeenCalledTimes(SCHEDULED_JOBS.length);
    const firstEntry = SCHEDULED_JOBS[0];
    expect(mockUpsert).toHaveBeenCalledWith(
      firstEntry.id,
      { pattern: firstEntry.cron, tz: firstEntry.tz },
      { name: firstEntry.jobName, data: firstEntry.data ?? {} },
    );
  });

  it('prunes schedulers whose id is not in SCHEDULED_JOBS', async () => {
    mockGetSchedulers.mockResolvedValue([{ key: 'stale-id', name: 'old' }]);
    await registrar.onApplicationBootstrap();
    expect(mockRemove).toHaveBeenCalledWith('stale-id');
  });

  it('does not prune schedulers that are still in SCHEDULED_JOBS', async () => {
    const keepId = SCHEDULED_JOBS[0].id;
    mockGetSchedulers.mockResolvedValue([{ key: keepId, name: 'heartbeat' }]);
    await registrar.onApplicationBootstrap();
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && yarn test --testPathPattern="schedule.registrar" --no-coverage
```

Expected: FAIL — `Cannot find module './schedule.registrar'`.

- [ ] **Step 3: Create `schedule.config.ts`**

```typescript
// backend/src/infra/queue/schedule/schedule.config.ts
import { QueueName } from '../queue.constants';

export interface ScheduledJob {
  id: string;
  queue: QueueName;
  jobName: string;
  cron: string;
  data?: Record<string, unknown>;
  tz?: string;
}

export const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    id: 'example:heartbeat',
    queue: QueueName.EXAMPLE,
    jobName: 'heartbeat',
    cron: '* * * * *',
    data: {},
    tz: 'UTC',
  },
];
```

- [ ] **Step 4: Create `schedule.registrar.ts`**

```typescript
// backend/src/infra/queue/schedule/schedule.registrar.ts
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueName } from '../queue.constants';
import { SCHEDULED_JOBS, ScheduledJob } from './schedule.config';

@Injectable()
export class ScheduleRegistrar implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScheduleRegistrar.name);

  constructor(
    @InjectQueue(QueueName.EXAMPLE) private readonly exampleQueue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.syncSchedulers();
  }

  private queueFor(job: ScheduledJob): Queue {
    const map: Record<QueueName, Queue> = {
      [QueueName.EXAMPLE]: this.exampleQueue,
    };
    return map[job.queue];
  }

  private async syncSchedulers(): Promise<void> {
    for (const job of SCHEDULED_JOBS) {
      const queue = this.queueFor(job);
      await queue.upsertJobScheduler(
        job.id,
        { pattern: job.cron, tz: job.tz },
        { name: job.jobName, data: job.data ?? {} },
      );
      this.logger.log({ msg: 'schedule:upserted', id: job.id, cron: job.cron });
    }

    await this.pruneStaleSchedulers();
  }

  private async pruneStaleSchedulers(): Promise<void> {
    const configIds = new Set(SCHEDULED_JOBS.map((j) => j.id));

    const allQueues = [...new Set(SCHEDULED_JOBS.map((j) => j.queue))];
    for (const queueName of allQueues) {
      const queue = this.queueFor({ queue: queueName } as ScheduledJob);
      const existing = await queue.getJobSchedulers();
      for (const s of existing) {
        if (!configIds.has(s.key)) {
          await queue.removeJobScheduler(s.key);
          this.logger.warn({ msg: 'schedule:pruned', id: s.key });
        }
      }
    }
  }
}
```

- [ ] **Step 5: Create `schedule.module.ts`**

```typescript
// backend/src/infra/queue/schedule/schedule.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from '../queue.constants';
import { ScheduleRegistrar } from './schedule.registrar';

@Module({
  imports: [BullModule.registerQueue({ name: QueueName.EXAMPLE })],
  providers: [ScheduleRegistrar],
})
export class InfraScheduleModule {}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd backend && yarn test --testPathPattern="schedule.registrar" --no-coverage
```

Expected: PASS — 3 tests.

- [ ] **Step 7: Verify compile check now resolves `InfraScheduleModule` in `queue.module.ts`**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors (both `ExampleProcessor` and `InfraScheduleModule` are now in place).

- [ ] **Step 8: Commit**

```bash
git add backend/src/infra/queue/schedule/
git commit -m "feat(infra/queue): add schedule sub-module with BullMQ Job Scheduler upsert/prune"
```

---

### Task 8: ReadinessService + HealthModule

**Files:**
- Create: `backend/src/infra/health/readiness.service.ts`
- Create: `backend/src/infra/health/health.module.ts`
- Test: `backend/src/infra/health/readiness.service.spec.ts`

**Interfaces:**
- Consumes:
  - `ApplicationDBProvider` (globally available from `ApplicationDbModule @Global`)
  - `Cache` via `@Inject(CACHE_MANAGER)` (globally available from `InfraCacheModule @Global`)
  - `Queue` via `@InjectQueue(QueueName.EXAMPLE)` (provided by `BullModule.registerQueue` in `HealthModule`)
- Produces:
  - `ReadinessService.check(): Promise<{ db: string; redisCache: string; redisBull: string }>` — throws `BusinessException(SERVICE_UNAVAILABLE)` if any ping fails
  - `HealthModule` — NestJS module (imported by `AppModule` in Task 9)

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/infra/health/readiness.service.spec.ts
import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getQueueToken } from '@nestjs/bullmq';
import { ReadinessService } from './readiness.service';
import ApplicationDBProvider from '../application-db/db-connection';
import { QueueName } from '../queue/queue.constants';
import { BusinessException } from 'src/utils/exception.provider';

const mockDbPing = jest.fn();
const mockCacheClientPing = jest.fn();
const mockBullClientPing = jest.fn();

const mockCache = { store: { client: { ping: mockCacheClientPing } } };
const mockQueue = { client: Promise.resolve({ ping: mockBullClientPing }) };

describe('ReadinessService', () => {
  let service: ReadinessService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ReadinessService,
        { provide: ApplicationDBProvider, useValue: { ping: mockDbPing } },
        { provide: CACHE_MANAGER, useValue: mockCache },
        { provide: getQueueToken(QueueName.EXAMPLE), useValue: mockQueue },
      ],
    }).compile();
    service = module.get(ReadinessService);
  });

  it('returns { db, redisCache, redisBull } all "up" when all pings pass', async () => {
    mockDbPing.mockResolvedValue(true);
    mockCacheClientPing.mockResolvedValue('PONG');
    mockBullClientPing.mockResolvedValue('PONG');

    const result = await service.check();
    expect(result).toEqual({ db: 'up', redisCache: 'up', redisBull: 'up' });
  });

  it('throws SERVICE_UNAVAILABLE BusinessException when db ping fails', async () => {
    mockDbPing.mockRejectedValue(new Error('db down'));
    mockCacheClientPing.mockResolvedValue('PONG');
    mockBullClientPing.mockResolvedValue('PONG');

    await expect(service.check()).rejects.toBeInstanceOf(BusinessException);
    await expect(service.check()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('throws SERVICE_UNAVAILABLE BusinessException when cache ping fails', async () => {
    mockDbPing.mockResolvedValue(true);
    mockCacheClientPing.mockRejectedValue(new Error('redis down'));
    mockBullClientPing.mockResolvedValue('PONG');

    await expect(service.check()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('throws SERVICE_UNAVAILABLE BusinessException when BullMQ ping fails', async () => {
    mockDbPing.mockResolvedValue(true);
    mockCacheClientPing.mockResolvedValue('PONG');
    mockBullClientPing.mockRejectedValue(new Error('bull down'));

    await expect(service.check()).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && yarn test --testPathPattern="readiness.service" --no-coverage
```

Expected: FAIL — `Cannot find module './readiness.service'`.

- [ ] **Step 3: Create `readiness.service.ts`**

```typescript
// backend/src/infra/health/readiness.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectQueue } from '@nestjs/bullmq';
import { Cache } from 'cache-manager';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import ApplicationDBProvider from '../application-db/db-connection';
import { QueueName } from '../queue/queue.constants';
import { AppException } from 'src/utils/exception.provider';

@Injectable()
export class ReadinessService {
  constructor(
    private readonly db: ApplicationDBProvider,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectQueue(QueueName.EXAMPLE) private readonly exampleQueue: Queue,
  ) {}

  async check(): Promise<{ db: string; redisCache: string; redisBull: string }> {
    const [dbResult, cacheResult, bullResult] = await Promise.allSettled([
      this.db.ping(),
      this.pingCache(),
      this.pingBullMq(),
    ]);

    const anyFailed = [dbResult, cacheResult, bullResult].some(
      (r) => r.status === 'rejected',
    );
    if (anyFailed) {
      AppException.throw('SERVICE_UNAVAILABLE', 'One or more dependencies are unreachable');
    }

    return { db: 'up', redisCache: 'up', redisBull: 'up' };
  }

  private async pingCache(): Promise<void> {
    const store = this.cache.store as { client: Redis };
    await store.client.ping();
  }

  private async pingBullMq(): Promise<void> {
    const client = await this.exampleQueue.client;
    await client.ping();
  }
}
```

- [ ] **Step 4: Create `health.module.ts`**

```typescript
// backend/src/infra/health/health.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from '../queue/queue.constants';
import { ReadinessService } from './readiness.service';

@Module({
  imports: [BullModule.registerQueue({ name: QueueName.EXAMPLE })],
  providers: [ReadinessService],
  exports: [ReadinessService],
})
export class HealthModule {}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && yarn test --testPathPattern="readiness.service" --no-coverage
```

Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add backend/src/infra/health/
git commit -m "feat(infra/health): add ReadinessService aggregating db + redisCache + redisBull pings"
```

---

### Task 9: App wiring + remove @nestjs/schedule

Wire all infra modules into `AppModule`, update `AppController` to delegate to `ReadinessService`, and remove `@nestjs/schedule`.

**Files:**
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/app.controller.ts`
- Modify: `backend/package.json` (via yarn remove)

**Interfaces:**
- Consumes: `InfraCacheModule`, `QueueModule`, `HealthModule`, `ReadinessService`

- [ ] **Step 1: Update `app.module.ts`**

```typescript
// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { MainModule } from './modules/main.module';
import { ApplicationDbModule } from './infra/application-db/application-db.module';
import { InfraCacheModule } from './infra/cache/cache.module';
import { QueueModule } from './infra/queue/queue.module';
import { HealthModule } from './infra/health/health.module';
import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PoliciesGuard } from './common/casl/policies.guard';
import { CaslModule } from './common/casl/casl.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    ApplicationDbModule,
    InfraCacheModule,
    QueueModule,
    HealthModule,
    CaslModule,
    MainModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PoliciesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Update `app.controller.ts`**

```typescript
// backend/src/app.controller.ts
import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { ReadinessService } from 'src/infra/health/readiness.service';

@Public()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class AppController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get()
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    return this.readiness.check();
  }
}
```

- [ ] **Step 3: Remove `@nestjs/schedule` package**

```bash
cd backend && yarn remove @nestjs/schedule
```

Expected: `@nestjs/schedule` removed from `backend/package.json` and `yarn.lock`.

- [ ] **Step 4: Full compile check**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run full test suite**

```bash
cd backend && yarn test --no-coverage
```

Expected: all tests pass (including new specs for BaseProcessor, ExampleProcessor, ScheduleRegistrar, ReadinessService). Count should be ≥ existing tests + 10 new assertions.

- [ ] **Step 6: Commit**

```bash
git add backend/src/app.module.ts backend/src/app.controller.ts backend/package.json backend/yarn.lock
git commit -m "feat(infra): wire CacheModule, QueueModule, HealthModule into AppModule; replace @nestjs/schedule with BullMQ scheduler"
```
