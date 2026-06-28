# Cybernetic — Centralized Error Definition & Handling

> Status: **Approved design**, ready for implementation planning.
> Scope: backend (`backend/src`). The frontend contract is preserved unchanged.

## 1. Summary

The backend already routes **100%** of thrown errors through `AppException.throw(code, message)`, caught by a single global `GlobalExceptionFilter` and rendered into a uniform response envelope. The wiring and discipline are sound. What is missing is the *definition* layer: codes are not type-safe, every call site must hand-write a message (causing wording drift), and there is no place to attach structured context.

This design keeps the existing architecture and tightens the core into a **single typed catalog** with **default messages**, an **optional metadata channel** (logs-only), and **one ergonomic helper** (`notFound`) for the dominant case. It is a refactor-in-place, not a rewrite.

## 2. Goals & Non-Goals

### Goals
- **Type-safe codes** — an unknown/mistyped code is a compile error, not a silent HTTP 500.
- **Default messages** — `AppException.throw('SERVICE_UNAVAILABLE')` works with no message; one source of truth per code.
- **Kill message drift** — collapse the 29 hand-written "X not found" variants into one canonical format.
- **Structured context** — attach `metadata` to an error for server-side logs.
- **Zero client-contract change** — the response envelope stays byte-identical; the frontend is untouched.
- **Backward-compatible signature** — all existing `throw(code, message)` call sites keep compiling.

### Non-Goals (this iteration)
- Domain-specific codes (`OBJECTIVE_NOT_FOUND`, …). Deferred under YAGNI — the frontend branches on `message`, not codes.
- Exposing `metadata` in the client envelope. Logs-only for now; additive later if a client need appears.
- Switching `BusinessException` to extend `HttpException`. The filter stays the single point of HTTP translation.
- Stable opaque codes (`AUTH_001`), exception categories, `create()`/`native()` helpers, request-id correlation. Not needed yet.

## 3. Current State

| File | Role | Assessment |
|------|------|------------|
| `utils/exception.provider.ts` | `CODE_STATUS` map, `BusinessException`, `AppException.throw` | Keep & extend |
| `common/filters/exception.filter.ts` | `@Catch()` global filter, envelope + 5xx redaction | Minor change (log metadata) |
| `common/interceptors/response.interceptor.ts` | wraps success into envelope | No change |
| `utils/shared/response.factory.ts` / `interface.ts` | `IBaseResponse`, `buildOk/buildCreated` | No change |
| `app.module.ts` | registers `APP_FILTER` + `APP_INTERCEPTOR` | No change (already wired) |
| `infra/application-db/query-runner.ts` | normalizes DB errors → `DATABASE_QUERY_FAILED` | Use metadata for cause |

### Gaps being closed
1. **Illusory typing** — `throw(code: keyof typeof CODE_STATUS | string, …)` (`exception.provider.ts:26`). The `| string` accepts any string; `'RESOUCE_NOT_FOUND'` compiles and maps to 500.
2. **Mandatory message → drift** — no defaults. Examples of the same intent worded differently:
   - `Objective id ${id} not found` (`objective.repo.ts:83`)
   - `Objective with slug '${slug}' not found` (`alignment.service.ts:35`)
   - `Error occurred during updating department, department id: ${id} not found` (`department.repo.ts:78`)
3. **No structured context** — the only way to be specific is more free-form message strings (which *is* gap #2).

### Constraints preserved
- **Response envelope** `{ data, status_code, message, error, timestamp }` — the frontend (`frontend/src/lib/api-client.ts:42-46`) branches on `error` truthiness and renders `message`. New data must be additive and server-side only.
- **5xx redaction** — internal detail logged server-side, generic message to client (`exception.filter.ts:30-38`).

## 4. Design

### 4.1 Error catalog — one typed source of truth

A single `as const` registry in `utils/exception.provider.ts`. Same 8 codes already in use, now with default messages and a derived `ErrorCode` type.

```ts
import { HttpStatus } from '@nestjs/common';

export const ERROR_CATALOG = {
  DATABASE_QUERY_FAILED: { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Database operation failed' },
  RESOURCE_NOT_FOUND:    { status: HttpStatus.NOT_FOUND,              message: 'Resource not found' },
  RESOURCE_CONFLICT:     { status: HttpStatus.CONFLICT,              message: 'Resource already exists' },
  VALIDATION_FAILED:     { status: HttpStatus.BAD_REQUEST,           message: 'Validation failed' },
  UNAUTHORIZED:          { status: HttpStatus.UNAUTHORIZED,          message: 'Authentication required' },
  FORBIDDEN:             { status: HttpStatus.FORBIDDEN,             message: 'You do not have permission to perform this action' },
  SYSTEM_INTERNAL_ERROR: { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' },
  SERVICE_UNAVAILABLE:   { status: HttpStatus.SERVICE_UNAVAILABLE,   message: 'Service temporarily unavailable' },
} as const satisfies Record<string, { status: HttpStatus; message: string }>;

export type ErrorCode = keyof typeof ERROR_CATALOG;
```

Adding a code later is a one-line entry; `ErrorCode` updates automatically.

### 4.2 `BusinessException`

Continues to extend `Error` (decision §8). Adds an optional `metadata` field. The positional `(code, message, status)` constructor is preserved so existing tests compile; `metadata` is an optional 4th arg.

```ts
export class BusinessException extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BusinessException';
  }
}
```

### 4.3 `AppException` API

```ts
export class AppException {
  // Overloads: throw(code) | throw(code, message) | throw(code, metadata) | throw(code, message, metadata)
  static throw(code: ErrorCode, message?: string, metadata?: Record<string, unknown>): never;
  static throw(code: ErrorCode, metadata: Record<string, unknown>): never;
  static throw(
    code: ErrorCode,
    a?: string | Record<string, unknown>,
    b?: Record<string, unknown>,
  ): never {
    const def = ERROR_CATALOG[code];
    const [message, metadata] = typeof a === 'string' ? [a, b] : [def.message, a];
    throw new BusinessException(code, message ?? def.message, def.status, metadata);
  }

  /** Canonical not-found. Replaces 29 hand-written variants. */
  static notFound(entity: string, idOrSlug?: string | number): never {
    const message = idOrSlug == null ? `${entity} not found` : `${entity} ${idOrSlug} not found`;
    AppException.throw('RESOURCE_NOT_FOUND', message, { entity, id: idOrSlug });
  }

  static isBusinessException(error: unknown): error is BusinessException {
    return error instanceof BusinessException;
  }
}
```

Behavior:
- `throw('RESOURCE_NOT_FOUND')` → 404, default message `"Resource not found"`.
- `throw('DATABASE_QUERY_FAILED', { cause: e.message })` → 500, default message, `cause` carried in metadata (logged, never sent to client).
- `throw('FORBIDDEN', 'You cannot delete this objective')` → 403, custom message (unchanged usage).
- `notFound('Objective', id)` → 404, `"Objective 42 not found"`, metadata `{ entity:'Objective', id:42 }`.
- `throw('RESOUCE_NOT_FOUND')` → **compile error** (`TS2345`).

### 4.4 Global filter — log metadata, leak nothing

The filter already branches `BusinessException` first. One change: in the **5xx** path, append `metadata` to the server-side error log. 4xx are routine and expected (a 404 per missing row), so they are **not** logged — that avoids log spam, and their `metadata` (e.g. `notFound`'s `{ entity, id }`) is already redundant with the user-facing message. The client envelope is unchanged, and 5xx still redacts `message` to a generic string. Metadata is never written to the response.

```ts
if (exception instanceof BusinessException) {
  status_code = exception.status;
  error = exception.code;
  if (status_code >= HttpStatus.INTERNAL_SERVER_ERROR) {
    const meta = exception.metadata ? ` ${JSON.stringify(exception.metadata)}` : '';
    this.logger.error(`${error} on ${req?.method ?? ''} ${req?.url ?? ''}: ${exception.message}${meta}`, exception.stack);
    message = 'Internal server error';            // redacted
  } else {
    message = exception.message;                    // 4xx user-facing, safe; not logged
  }
}
```

### 4.5 Response contract — unchanged

Both success and error envelopes remain `{ data, status_code, message, error, timestamp }`. No field added or removed. The frontend requires no change.

## 5. File-by-file changes

| File | Change |
|------|--------|
| `utils/exception.provider.ts` | Replace `CODE_STATUS` with `ERROR_CATALOG`; export `ErrorCode`; add `metadata` to `BusinessException`; overload `throw`; add `notFound` + `isBusinessException`. |
| `common/filters/exception.filter.ts` | Log `metadata` (server-side only) in the `BusinessException` branch; behavior otherwise unchanged. |
| `infra/application-db/query-runner.ts` | `throw('DATABASE_QUERY_FAILED', { cause: e.message })`; reuse `AppException.isBusinessException` for the propagate check. |
| 29 not-found call sites (services, repos, controllers) | → `AppException.notFound(Entity, idOrSlug)`. |
| `utils/exception.provider.spec.ts` | Drop the `UNKNOWN_CODE` test (now a compile error); add catalog-coverage + `notFound` + metadata tests. |
| `common/filters/exception.filter.spec.ts` | Add a metadata-logging assertion; existing cases still pass (constructor compatible). |

## 6. Migration plan (full sweep)

**Not-found sites → `notFound(...)`** (29):
- Services (19): `person` (×3), `organization` (×3), `objective` (×2), `initiative` (×2), `key-result` (×2), `intervention` (×2), `okr-tree` (×2), `team`, `department`, `alignment`.
- Repos (8) (`update()` guards — verbose `"Error occurred during updating…"` messages collapse to the canonical format): `objective`, `department`, `key-result`, `person`, `initiative`, `organization`, `team`, `intervention`.
- Controller (2): `tracking.controller.ts` (×2).

**Other codes:** keep `throw(code, …)`. Drop redundant messages where the catalog default already says it; keep specific messages where they add value (e.g. `assertAbility`'s `"You cannot ${action} this ${subject}"`).

**Sequencing:** (1) land the catalog/API/filter + tests green, (2) mechanical call-site sweep, (3) `npm run build && npm test` after each step.

## 7. Testing strategy

- **`AppException`** — every catalog code maps to its status; default message used when omitted; custom message overrides; metadata passes through; `notFound` formats with/without id and sets metadata.
- **Type-safety** — covered by the compiler (the removed `UNKNOWN_CODE` test demonstrates the change).
- **Filter** — `BusinessException` 4xx exposes message; 5xx redacts; metadata appears in logs (spy on `Logger`) but **never** in the response body; existing `HttpException`/validation/generic-error cases stay green.
- **Regression** — full `npm run build && npm test` (137 unit + e2e baseline) must remain green.

## 8. Decisions log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Lean & typed** code vocabulary (keep ~8 generic codes) | Frontend branches on `message`, not codes; granular codes are speculative (YAGNI). |
| 2 | `BusinessException` keeps extending **`Error`** | Filter remains the single place that maps domain → HTTP; avoids encoding status twice. |
| 3 | Add **`notFound`** helper only (no `conflict`) | Not-found is 23/~60 throws; conflict is 1. Add others only when a case earns it. |
| 4 | `metadata` is **logs-only** | Keeps the envelope/frontend untouched; safe (no 5xx leak); additive later if needed. |
| 5 | **Full sweep** migration | Mechanical; leaves the codebase uniform in one pass. |
| 6 | Catalog lives **in `exception.provider.ts`** (single file) | ~70 lines; one import surface. Split only if it grows. |

## 9. Out of scope / future seams
- Domain-specific codes and exception categories — add to `ERROR_CATALOG` when the frontend needs to branch.
- Exposing `metadata.code`-style stable identifiers in the envelope — additive, non-breaking when wanted.
- Request-id / correlation-id in logs — orthogonal observability concern.
