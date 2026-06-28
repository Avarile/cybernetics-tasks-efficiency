# Redis Cache + BullMQ Infra Modules — Design

**Date:** 2026-06-28
**Status:** Approved (pending spec review)
**Scope:** `backend/` — new `infra/cache` and `infra/queue` modules, with a
BullMQ-based scheduler under `infra/queue/schedule`.

## Overview

Add two infrastructure modules to the backend, mirroring the existing
hand-rolled `infra/application-db` conventions (global module, env-driven
config):

1. **Cache module** — Redis-backed caching via `@nestjs/cache-manager`.
2. **Queue module** — BullMQ over Redis, with a reusable base processor.
   1. **Schedule sub-module** — cron-style scheduling built on BullMQ Job
      Schedulers (replaces `@nestjs/schedule`).

Both share a single Redis server on **separate logical DB indexes** with
**separate connections** (BullMQ requires its own connection with
`maxRetriesPerRequest: null` and uses blocking commands, so it must not share
the cache client).

## Decisions (resolved)

| Decision | Choice |
|---|---|
| Cache implementation | `@nestjs/cache-manager` + `cache-manager` + `cache-manager-ioredis-yet`; consumers use the `CACHE_MANAGER` token **directly** (no custom wrapper service) |
| Redis topology | One server, separate DB index per purpose, separate ioredis connections |
| BullMQ scope | Infra + patterns only (connection, base processor, one example queue); no business jobs yet |
| Scheduling | BullMQ Job Schedulers only; **remove** `@nestjs/schedule` |
| Cache client lib | `cache-manager-ioredis-yet` (ioredis) so cache + BullMQ share one Redis client library |
| Readiness | `/api/health/ready` also pings Redis; returns `503` if Redis is unreachable |

## Module layout

```
infra/
  cache/
    cache.module.ts          # @Global CacheModule.registerAsync (ioredis redis store)
    cache.constants.ts       # namespaced key builders + TTL constants
  queue/
    queue.module.ts          # @Global BullModule.forRootAsync + registers example queue + schedule
    queue.constants.ts       # QueueName enum + DEFAULT_JOB_OPTIONS
    base.processor.ts        # abstract WorkerHost: structured logging, timing, error rethrow
    base.processor.spec.ts
    example/
      example.processor.ts   # ExampleProcessor extends BaseProcessor (proves the pattern)
      example.processor.spec.ts
    schedule/
      schedule.module.ts     # wires ScheduleRegistrar + the queues it targets
      schedule.config.ts     # declarative source-of-truth list of scheduled jobs
      schedule.registrar.ts  # upserts + prunes BullMQ job schedulers on bootstrap
      schedule.registrar.spec.ts
  health/
    readiness.service.ts     # aggregates db + redis(cache) + redis(bullmq) pings
    readiness.service.spec.ts
```

## Cache module

- Deps: `@nestjs/cache-manager`, `cache-manager` (v5), `cache-manager-ioredis-yet` (v2).
- `cache.module.ts`: `@Global()` wrapping `CacheModule.registerAsync({ isGlobal: true, useFactory })`. The factory builds an ioredis-backed store via `redisStore({ host, port, password, db: REDIS_CACHE_DB })` and a default TTL (`CACHE_DEFAULT_TTL_MS`).
- Consumers inject `@Inject(CACHE_MANAGER) cache: Cache` and use `cache.get/set/del` directly. `cache.wrap(key, fn, ttl)` is available for cache-aside.
- `CacheInterceptor` (from `@nestjs/cache-manager`) is available for opt-in HTTP-response caching via `@UseInterceptors(CacheInterceptor)` + `@CacheKey`/`@CacheTTL` on specific GET routes. Not applied globally.
- `cache.constants.ts`:
  - `CACHE_DEFAULT_TTL_MS` and a few named TTLs (e.g. `CACHE_TTL_SHORT`, `CACHE_TTL_MEDIUM`).
  - Namespaced key builders, e.g. `cacheKey.person(id) => 'cyb:person:<id>'`, to keep key conventions in one place. Convention: `cyb:<domain>:<identifier>`.
- **No `CacheService` wrapper** — per decision, code uses `CACHE_MANAGER` directly. The constants file is the only shared cache helper.

## Queue module (BullMQ)

- Deps: `@nestjs/bullmq`, `bullmq` (already installed), `ioredis` (already installed).
- `queue.module.ts`: `@Global()` `BullModule.forRootAsync({ useFactory })` producing:
  - `connection: { host, port, password, db: REDIS_BULLMQ_DB, maxRetriesPerRequest: null }`
  - `defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: { count: 1000 }, removeOnFail: { count: 5000 } }`
  - Also `BullModule.registerQueue({ name: QueueName.EXAMPLE })` and imports the schedule module.
- `queue.constants.ts`:
  - `enum QueueName { EXAMPLE = 'example' }` — single source of truth for queue names. New queues add an entry here.
  - `DEFAULT_JOB_OPTIONS` exported for reuse/override.
- Concrete queues are registered with `BullModule.registerQueue({ name })` in the owning feature module and produced via an injected `Queue` (`@InjectQueue(QueueName.X)`).

### BaseProcessor

`base.processor.ts` — abstract class extending `WorkerHost` (from `@nestjs/bullmq`):

- Implements `process(job: Job)`: records start time, calls abstract `handle(job)`, logs success with `{ queue, jobId, name, attemptsMade, durationMs }`. On throw: logs the failure with the same context and **rethrows** so BullMQ applies the configured retry/backoff. Stalled jobs are recovered by BullMQ automatically.
- `@OnWorkerEvent('failed' | 'completed' | 'stalled')` hooks emit structured logs for observability.
- Subclasses implement only `async handle(job): Promise<T>` and are annotated `@Processor(QueueName.X)`.

### Example queue

- `example/example.processor.ts`: `@Processor(QueueName.EXAMPLE)` `ExampleProcessor extends BaseProcessor`; `handle(job)` logs the payload. Proves registration → enqueue → process → retry path. No business logic.

## Schedule sub-module (BullMQ Job Schedulers)

Rationale (vs `@nestjs/schedule`): cluster-safe single execution, durability
across restarts, retries/backoff via the same worker path, and observability —
all of which fit this project's background workloads (AI scoring, projection
rebuilds, interventions). `@nestjs/schedule` only wins on zero-infra simplicity,
which is moot since Redis is already required. `@nestjs/schedule` is removed.

- `schedule.config.ts`: the **source of truth** — a typed array of
  `ScheduledJob = { id: string; queue: QueueName; jobName: string; cron: string; data?: Record<string, unknown>; tz?: string }`.
  Ships with one example entry (a heartbeat on `QueueName.EXAMPLE`, e.g. every
  minute) so the mechanism is exercised end-to-end.
- `schedule.registrar.ts`: `ScheduleRegistrar implements OnApplicationBootstrap`.
  Holds references to the target queues (injected via `@InjectQueue`). On
  bootstrap:
  1. For each config entry: `queue.upsertJobScheduler(id, { pattern: cron, tz }, { name: jobName, data })` — idempotent; cluster-safe (keyed by `id`).
  2. **Prune**: `queue.getJobSchedulers()` per queue; remove any scheduler whose
     id is not in `schedule.config.ts` via `queue.removeJobScheduler(id)`. Config
     is authoritative, so deleting an entry removes the schedule on next boot.
- Scheduled jobs are ordinary named jobs on their target queue; the queue's
  `BaseProcessor` runs them. `handle()` switches on `job.name` when a queue has
  multiple job types.

## Config / env

Refactor the Redis env block to a **shared connection + per-purpose DB index**.

Remove: `REDIS_BULLMQ_HOST`, `REDIS_BULLMQ_PORT`, `REDIS_BULLMQ_PASSWORD`.
Add/keep:

```
REDIS_HOST       (default 'localhost')
REDIS_PORT       (default 6379)
REDIS_PASSWORD   (optional)
REDIS_CACHE_DB   (default 1)
REDIS_BULLMQ_DB  (default 0)
```

`backend/.env` (and any deployment env) must be updated to the new names. This
is a breaking rename, but the affected infra is currently unused.

## Health readiness

Extend the existing `GET /api/health/ready` to reflect all infra:

- New `infra/health/readiness.service.ts` (`ReadinessService`) aggregates pings:
  - `db` — existing `ApplicationDBProvider.ping()`.
  - `redisCache` — `PING` via the cache manager's underlying ioredis client.
  - `redisBull` — `PING` via the BullMQ connection (an injected `Queue.client`).
- Runs the three checks in parallel. Returns `{ db, redisCache, redisBull }` each
  `'up'` on success. If **any** check fails, throw `SERVICE_UNAVAILABLE` (503).
- `ReadinessService` is provided and exported by a small `HealthModule`
  (`infra/health/health.module.ts`) that `AppModule` imports; `AppController`
  injects `ReadinessService` instead of `ApplicationDBProvider` directly.
- `app.controller.ts` readiness handler delegates to `ReadinessService`. Liveness
  (`GET /api/health`) is unchanged and stays version-neutral.

## App wiring

- `app.module.ts`: import `CacheModule` (infra/cache) and `QueueModule`
  (infra/queue, which pulls in the schedule sub-module + example queue). Both are
  `@Global`.
- **Remove** `ScheduleModule.forRoot()` (`@nestjs/schedule`) from `app.module.ts`.
- `ReadinessService` provided where the health controller can inject it (likely a
  small `HealthModule` or via the global infra modules exporting it).

## Dependencies

- **Add:** `@nestjs/cache-manager` (^2), `cache-manager` (^5), `cache-manager-ioredis-yet` (^2).
- **Remove:** `@nestjs/schedule`.
- **Unchanged:** `@nestjs/bullmq`, `bullmq`, `ioredis`.

## Testing

- `base.processor.spec.ts` — success path logs + returns; failure path logs +
  rethrows (so BullMQ retries). Mocked `Job`.
- `example.processor.spec.ts` — `handle()` processes the payload.
- `schedule.registrar.spec.ts` — upserts each config entry; prunes schedulers not
  in config. Mocked queues asserting `upsertJobScheduler` / `getJobSchedulers` /
  `removeJobScheduler` calls.
- `readiness.service.spec.ts` — all-up returns the status map; any failing ping →
  `SERVICE_UNAVAILABLE`. Mocked db/cache/queue clients.
- Cache has no custom logic to unit test (used via `CACHE_MANAGER` directly);
  covered by an **optional Redis-backed integration test** (a set→get→del
  round-trip + an enqueue→process job round-trip), guarded like the existing
  Postgres integration tests so it is skipped when Redis is absent.

## Out of scope

- Concrete business queues/jobs (AI scoring, projections, notifications) — Phase 2+.
- A Bull Board / queue dashboard UI.
- Splitting workers into a separate process (current monolith runs API + worker
  together).
- Caching the JWT active-account lookup — deliberately deferred (revocation
  staleness tradeoff); the cache infra simply makes it possible later.

## Migration notes

- Update `backend/.env` to the new `REDIS_*` names before running.
- Removing `@nestjs/schedule` requires deleting its `forRoot()` wiring; there are
  currently no `@Cron`/`@Interval` usages, so nothing else breaks.
- BullMQ scheduled jobs require a running worker; in the current monolith this is
  automatic.
