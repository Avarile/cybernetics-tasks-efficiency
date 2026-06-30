# File-Management Module — Design Spec

- **Date:** 2026-06-29
- **Status:** Approved (ready for implementation plan)
- **Reference implementation:** `cybernetics-data-centre/apps/nestjs-backend/src/features/attachments` (Teable-derived)
- **Related conventions:** [[cybernetic-convention-reference]]; infra specs `2026-06-28-redis-cache-bullmq-infra-design.md`, `2026-06-28-centralized-error-handling-design.md`

## 1. Summary

Add a self-contained **file-management** capability to the Cybernetic backend: upload a file, store it in a pluggable object store, and hand back a time-limited **file link** for download/preview. The design ports the reference's storage-adapter architecture into Cybernetic's stack (NestJS 10 + Drizzle + CASL + Zod `env` + `cache-manager` + BullMQ), keeping **local** and **MinIO** backends and dropping S3/Aliyun.

This is the *"File Processing (Upload) & File-Link Report"* capability described in the goal, rebuilt natively rather than copied.

## 2. Scope

### In scope (v1)
- Pluggable **StorageAdapter** abstraction with two backends: **local filesystem** (zero-config default) and **MinIO** (production object store; the goal's area of interest).
- **Presigned upload flow** (browser → object store directly for MinIO; browser → app → disk for local).
- **File-link** retrieval: signed, time-limited, cached preview URLs (private bucket) and constructed URLs (public bucket).
- **Standalone `attachment` records** addressable by `token` and `slug`. No coupling to domain entities (Task/Initiative/Person) — consumers reference an attachment later by its handle.
- **Thumbnails** (async, BullMQ): image resize + PDF first-page render.
- **Public/private bucket split** retained (config seam; private is the default since there are no public consumers yet).

### Out of scope / dropped (vs. reference)
- **S3 and Aliyun adapters** — dropped per goal.
- **`attachments_table`** (Teable grid `table/record/field` join) — Cybernetic has no grid; standalone records only.
- **Server-side multipart upload** (Multer) and **upload-from-URL** (SSRF fetch) — explicitly deferred. No `multer`/`axios` upload paths in v1.
- **v2 attachment-url-signer bridge** — Teable-specific.
- **`nestjs-cls`** — replaced by `@CurrentUser()` + `DbContextService` request context.

### Decisions taken (from brainstorming)
- (a) Module at `src/modules/module-file-management/` — a cross-cutting platform module, sibling of `module-auth`, **not** under `business-logic-modules`.
- (b) Keep the public/private bucket split.
- (c) Local-dev MinIO runs on host port **30900** (→ container `9000`), console **30901** (→ `9001`), user `minioadmin`; the **secret is stored only in the gitignored `backend/.env`** and never committed.

## 3. Architecture overview

One abstract contract, a DI factory that instantiates the backend named by `env.FILE_STORAGE_PROVIDER`, and a thin service/repo/controller stack on top — mirroring the repo's existing `controller → service → repo` layering and `runQuery(dbProvider, ctx, fn)` data-access pattern.

```
src/modules/module-file-management/
├── file.controller.ts          HTTP routes
├── file.service.ts             orchestration: signature → upload → notify
├── file.storage.service.ts     file-link (signed preview URL + cache) + thumbnail helpers
├── file.repo.ts                Drizzle data access (extends BaseRepo<IAttachmentEntity>)
├── file.dto.ts                 class-validator request DTOs
├── file.interface.ts           entities, FilePurpose enum, presign/meta types
├── file.util.ts                token gen, sha256 hash, mime checks, AES read-token cipher, path guards
├── file.crop.processor.ts      BullMQ thumbnail worker (extends BaseProcessor)
├── file.module.ts              module wiring
└── plugins/
    ├── adapter.ts              abstract StorageAdapter + bucket/dir routing + STORAGE_ADAPTER token
    ├── storage.provider.ts     factory provider: Local | MinIO selected from env
    ├── local.ts                LocalStorage
    └── minio.ts                MinioStorage (dual client)
```

- Schema: `src/infra/application-db/schema/file.schema.ts`, re-exported from `schema/index.ts`.
- Errors: new codes added to `src/utils/exception.provider.ts` `ERROR_CATALOG`.
- Cache keys: `file*` helpers added to `src/infra/cache/cache.constants.ts`.
- Queue: `QueueName.FILE_CROP` added to `src/infra/queue/queue.constants.ts`; queue registered in `file.module.ts`.
- CASL: `'Attachment'` subject added to `src/common/casl/ability.types.ts` and granted in `ability.factory.ts`.
- Wiring: `FileManagementModule` imported by `src/modules/main.module.ts`.

**Rejected alternative:** placing adapters under `src/infra/storage/` (cleaner infra separation) — the goal asks to keep everything in the file-management module, so adapters live under `plugins/`.

## 4. Reference → Cybernetic mapping

| Reference (Teable) | Cybernetic |
|---|---|
| `StorageAdapter` abstract + `Symbol.for('ObjectStorage')` factory | Kept — abstract `StorageAdapter`, DI token `STORAGE_ADAPTER`, factory reads `env.FILE_STORAGE_PROVIDER` |
| `plugins/local.ts`, `plugins/minio.ts` | Kept (adapted to local utils) |
| `plugins/s3.ts`, `plugins/aliyun.ts` | **Dropped** |
| `attachments_table` join | **Dropped** |
| `attachments-storage.service.ts` (preview URL + thumbs) | `file.storage.service.ts` |
| `attachments.service.ts` orchestration | `file.service.ts` (signature/upload/notify only — no multipart/url paths) |
| PrismaService | `FileRepository` + `runQuery(dbProvider, ctx, fn)` |
| `@teable/openapi` `UploadType` + Zod RO/VO | local `FilePurpose` enum + class-validator DTOs |
| `CustomHttpException` + i18n | `AppException.throw('CODE', msg)` + `ERROR_CATALOG` |
| `nestjs-cls` (`cls.get('user.id')`) | `@CurrentUser()` + `DbContextService.forUser()` |
| `configs/storage.ts` (`registerAs`, `@StorageConfig()`) | `FILE_*` / `MINIO_*` block in `env.ts` (Zod), plain `env` import |
| `CacheService` | `@Inject(CACHE_MANAGER)` + tenant-scoped `cacheKey.file*` |
| `@teable/core` helpers (`getRandomString`, `isImage`, `FileUtils.getHash`, `Encryptor`) | local `file.util.ts` using node `crypto` |
| `attachments-crop.processor.ts` (BullMQ) | `file.crop.processor.ts extends BaseProcessor`, `QueueName.FILE_CROP` |

## 5. Data model — `file.schema.ts`

Single table `attachment`, reusing `defaultFields` (`id` serial PK, `slug` uuid, `createdAt/updatedAt/deletedAt/isDeleted/isActive`).

```ts
export const filePurpose = pgEnum('file_purpose', ['general', 'public']);

export const attachment = pgTable('attachment', {
  token: varchar('token', { length: 64 }).notNull(),        // presign-time handle; drives flow + cache + read route
  bucket: varchar('bucket', { length: 128 }).notNull(),
  path: varchar('path', { length: 1024 }).notNull(),         // "<dir>/<hash ?? token>"
  hash: varchar('hash', { length: 128 }).notNull(),          // sha256 hex (local) | etag (minio)
  size: bigint('size', { mode: 'number' }).notNull(),
  mimetype: varchar('mimetype', { length: 255 }).notNull(),
  width: integer('width'),
  height: integer('height'),
  thumbnailPath: text('thumbnail_path'),                     // JSON { sm, lg }; set by crop worker
  purpose: filePurpose('purpose').notNull().default('general'),
  createdByPersonId: integer('created_by_person_id').notNull(),
  ...defaultFields,
}, (t) => [
  uniqueIndex('attachment_token_index').on(t.token),
  index('attachment_hash_index').on(t.hash),
  index('attachment_created_by_index').on(t.createdByPersonId),
]);
```

**Two handles, by design:** `token` is generated at presign time (before the row exists) and drives the upload/notify/read flow and all cache keys; `slug` (uuid) is DB-generated at insert and is the general-purpose public id consumers store. `id` stays internal.

`IAttachmentEntity` extends `DefaultFields` with the columns above. Interfaces follow the `module-task` pattern (`IAttachmentProfile`, `INewAttachment`, `IUpdateAttachment`, `IQueryAttachmentParams`).

## 6. Configuration — `env.ts` additions (Zod)

| Var | Default | Notes |
|---|---|---|
| `FILE_STORAGE_PROVIDER` | `local` | `'local' \| 'minio'` |
| `FILE_PRIVATE_BUCKET` | `private` | default bucket for `general` purpose |
| `FILE_PUBLIC_BUCKET` | `public` | for `public` purpose (unsigned URLs) |
| `FILE_UPLOAD_METHOD` | `PUT` | presigned upload verb |
| `FILE_TOKEN_EXPIRE_IN` | `6d` | upload-token validity (`< 7d`) |
| `FILE_URL_EXPIRE_IN` | `6d` | preview-URL validity (`< 7d`) |
| `FILE_MAX_UPLOAD_SIZE` | `52428800` (50 MB) | boundary check |
| `FILE_TOKEN_SECRET` | — (required when provider=local) | AES key for local read-token cipher |
| `FILE_LOCAL_PATH` | `.storage` | local storage root (resolved from cwd) |
| `MINIO_ENDPOINT` | — | public host (browser-reachable) |
| `MINIO_PORT` | `9000` | public port |
| `MINIO_USE_SSL` | `false` | |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | — | credentials (in gitignored `.env`) |
| `MINIO_REGION` | optional | |
| `MINIO_INTERNAL_ENDPOINT` / `MINIO_INTERNAL_PORT` | optional | server-side ops endpoint; falls back to public when unset |

Duration strings (`6d`) are parsed to seconds by a small helper in `file.util.ts`.

**Local-dev MinIO example** (values live in gitignored `backend/.env`; password omitted here):
```
FILE_STORAGE_PROVIDER=minio
MINIO_ENDPOINT=localhost
MINIO_PORT=30900            # host port → container 9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=<in .env>
```

## 7. Storage adapter contract — `plugins/adapter.ts`

Static routing helpers (shared):
- `getBucket(purpose: FilePurpose)` → `private` for `general`, `public` for `public`.
- `getDir(purpose)` → subfolder (`general`, `public`).
- `isPublicBucket(bucket)` → boolean.
- `TEMPORARY_DIR` = `<cwd>/.temporary`.

Abstract methods (trimmed to what core + thumbnails + delete need):
```ts
abstract presigned(bucket, dir, params: IPresignParams): Promise<IPresignRes>;
abstract getObjectMeta(bucket, path, token): Promise<IObjectMeta>;
abstract getPreviewUrl(bucket, path, expiresIn?, respHeaders?): Promise<string>;
abstract uploadFile(bucket, path, body: Buffer | Readable, metadata?): Promise<{ hash; path }>;
abstract uploadFileWithPath(bucket, path, filePath, metadata): Promise<{ hash; path }>;
abstract cropImage(bucket, path, width?, height?, newPath?): Promise<string>;
abstract downloadFile(bucket, path): Promise<Readable>;
abstract deleteFile(bucket, path): Promise<void>;
abstract deleteDir(bucket, path, throwError?): Promise<void>;
```
Shared types in `file.interface.ts`: `IPresignParams { contentType; contentLength; expiresIn?; hash?; internal? }`, `IPresignRes { token; path; url; uploadMethod; requestHeaders }`, `IObjectMeta { size; mimetype; hash; url; width?; height? }`.

`uploadFileStream` (reference) is folded into `uploadFile` (accepts `Buffer | Readable`).

## 8. Local adapter — `plugins/local.ts`

- `presigned()` → returns app URL `/api/files/upload/:token`; caches `file:lsig:<token>` = `{ expiresDate, contentLength, contentType }` for upload-time validation (see §14).
- `saveTemporaryFile(req)` → streams request body to `.temporary`, tracks size; `validateToken()` checks expiry/size/mimetype; `save()` moves into `<storageDir>/<bucket>/<path>`.
- `getObjectMeta()` → reads `file:upload:<token>` cache (`{ mimetype, hash, size }`), adds image dims via `sharp`.
- `getPreviewUrl()` → builds `/api/files/read/<bucket>/<path>?token=<aes>` using an **AES-256-GCM token** (`FILE_TOKEN_SECRET`) encrypting `{ expiresDate, respHeaders }`.
- `read()` + `verifyReadToken()` + `getLastModifiedTime()` serve the read route.
- Path-traversal guards (`assertPathWithinStorage`): reject `..`/absolute, require resolution within `storageDir`.
- Image ops via `sharp`; hash via sha256 of file content.

## 9. MinIO adapter — `plugins/minio.ts`

- **Dual client** (the key architectural detail): `minioClient` on the public endpoint mints presigned PUT/GET URLs the browser reaches; `minioClientInternal` on the internal endpoint does server-side stat/upload/crop/download/delete. When `MINIO_INTERNAL_ENDPOINT` is unset, both point at the public client.
- `presigned()` → `client.presignedUrl(method, bucket, path, expiry, headers)`, path = `join(dir, hash ?? token)`, immutable cache-control header.
- `getObjectMeta()` → `statObject` (etag→hash, size, content-type) + `sharp` dims for images.
- `getPreviewUrl()` → `presignedGetObject` with `response-content-disposition`.
- `cropImage()` → download to temp → `sharp` resize → re-upload thumbnail.
- `uploadFile/uploadFileWithPath/downloadFile/deleteFile/deleteDir` → internal client.

## 10. Upload & file-link flows

### A. Presigned upload (primary)
```
POST /api/files/signature      validate size; bucket+dir = route(purpose); adapter.presigned()
                               cache file:sig:<token> = { path, bucket, hash } (§14); return { token, url, path }
PUT  <url>                     MinIO: browser → object store directly
                               Local: PUT /api/files/upload/:token (app streams to disk, validates token)
POST /api/files/notify/:token  adapter.getObjectMeta() → repo.create(attachment row) →
                               enqueue FILE_CROP job → return { ...attachment, url, presignedUrl(link) }
```

### B. File-link ("get the link")
`FileStorageService.getPreviewUrlByPath(bucket, path, token, expiresIn?, respHeaders?)`:
- Check cache `file:preview:<token>` → return if hit.
- Else `adapter.getPreviewUrl(...)`; cache with TTL = `floor(expiresIn * 0.5)` (refresh before expiry).
- MinIO → presigned GET URL; Local → `/api/files/read` URL with encrypted token.
- Public bucket → unsigned constructed URL.

### C. Local read
`GET /api/files/read/:path(*)` (`@Public`): path guard → conditional caching (`If-Modified-Since` → 304) → `verifyReadToken` (skip for public bucket) → stream via `StreamableFile` with content-type / content-disposition headers.

## 11. Thumbnails — `file.crop.processor.ts`

- Queue `QueueName.FILE_CROP` (`'file-crop'`), registered in `file.module.ts`; job `crop_image { bucket, token, path, mimetype, height }` enqueued by `notify`.
- Worker (`extends BaseProcessor`): skip if `thumbnailPath` already set.
  - **Image** (`isImage`): `cropImage` to `sm`(56) and `lg`(525) heights.
  - **PDF** (`isPdf`): render first page → PNG buffer → resize → upload; skip blank pages.
  - Else: no-op.
- Persists `thumbnailPath = JSON.stringify({ sm, lg })`. Failures are **non-fatal** (frontend falls back to an icon).
- Thumbnail heights constants live in `file.interface.ts` (or a small `file.constant.ts`): `SM = 56`, `LG = 525`, default mimetype `image/png`.
- **PDF dependency note (settle in plan):** prefer pure-JS `pdfjs-dist` to avoid native binaries; if it proves heavy, ship **images-only** first and add PDF rendering as a follow-up. Image thumbnails are the guaranteed v1 path.

## 12. API surface

Base: `@Controller('files')` → `/api/files` (global prefix per `main.ts`).

| Method | Route | Guard | Policy |
|---|---|---|---|
| POST | `/files/signature` | Jwt | `create Attachment` |
| POST | `/files/notify/:token` | Jwt | `create Attachment` |
| PUT / POST | `/files/upload/:token` | `@Public` | upload-token (local only) |
| GET | `/files/read/:path(*)` | `@Public` | encrypted read-token (local only) |
| GET | `/files/:slug` | Jwt | `read Attachment` (metadata) |
| GET | `/files/:slug/link` | Jwt | `read Attachment` (refreshed signed url) |
| DELETE | `/files/:slug` | Jwt | `delete Attachment` (soft-delete row + remove object) |

Controllers return `buildOk` / `buildCreated` (`IBaseResponse`); the global `ResponseInterceptor` + `GlobalExceptionFilter` apply. DTOs: `SignatureDTO { purpose, contentType, contentLength, hash? }`, `FindBySlugDTO { slug }`, optional `?filename=` on notify, `?token=` / `?response-content-disposition=` on read.

## 13. Authorization — CASL

Add `'Attachment'` to `AppSubjectName`. Rules in `ability.factory.ts`:
- **admin** → `manage all` (already).
- **executive** → `read all` (already).
- **manager** and **member** → `can('create', 'Attachment')` (no condition — row doesn't exist yet) and `can(['read', 'delete'], 'Attachment', { createdByPersonId: user.id })` (owner-only).

`@Public` upload/read routes are gated by **token possession**, not CASL.

## 14. Caching

Add tenant-scoped helpers to `cacheKey` (keyed by `ctx.schema_id`):

| Key | Value | TTL |
|---|---|---|
| `cyb:<schema>:file:sig:<token>` | `{ path, bucket, hash }` | `FILE_TOKEN_EXPIRE_IN` |
| `cyb:<schema>:file:lsig:<token>` | `{ expiresDate, contentLength, contentType }` | `FILE_TOKEN_EXPIRE_IN` |
| `cyb:<schema>:file:upload:<token>` | `{ mimetype, hash, size }` | `FILE_TOKEN_EXPIRE_IN` |
| `cyb:<schema>:file:preview:<token>` | `{ url, expiresIn }` | `floor(FILE_URL_EXPIRE_IN * 0.5)` |

## 15. Error handling & validation

Add to `ERROR_CATALOG`:
| Code | Status |
|---|---|
| `FILE_TOKEN_INVALID` | 400 BAD_REQUEST |
| `FILE_TOO_LARGE` | 413 PAYLOAD_TOO_LARGE |
| `FILE_TYPE_REJECTED` | 415 UNSUPPORTED_MEDIA_TYPE |
| `STORAGE_OPERATION_FAILED` | 500 INTERNAL_SERVER_ERROR |

Boundary validation: `contentLength ≤ FILE_MAX_UPLOAD_SIZE` at signature; content-type/length match at local upload; path-traversal guard at read; mimetype allow-list for inline preview (else `Content-Disposition: attachment`).

## 16. Dependencies to add (`backend/package.json`)

- `minio` (MinIO SDK)
- `sharp` (image processing)
- `fs-extra` + `@types/fs-extra` (local fs)
- `mime-types` + `@types/mime-types`
- PDF render lib (recommend `pdfjs-dist`; see §11 note)

Not added: `multer`, upload-side `axios` (no server-side multipart / url-fetch in v1).

## 17. Testing strategy

Mirror the repo's colocated `.spec.ts` convention:
- `file.util.spec.ts` — token cipher round-trip, sha256, duration parse, path-traversal guards.
- `file.repo.spec.ts` — CRUD + soft-delete + token/slug lookups (against the repo's DB test setup).
- `file.service.spec.ts` — signature → notify orchestration with a **fake StorageAdapter** (no real I/O); size-limit and invalid-token paths.
- `plugins/local.spec.ts` — presign/validate/save/read/preview against a temp dir.
- `plugins/minio.spec.ts` — adapter logic with a mocked `minio.Client` (dual-client routing assertions).
- `file.crop.processor.spec.ts` — image path; PDF + blank-skip; already-thumbnailed no-op.
- Build + lint clean; follow `npm run build && npm test`.

## 18. Future extensions (not v1)

- New `FilePurpose` values with consumers (e.g. `avatar` → public bucket) when Person/UI needs them.
- Generic `attachment_link` table (entityType + entityId) if/when entities need many-to-many file links.
- Multi-tenant storage path prefixing by `schema_id` (paths are currently `<dir>/<hash|token>`; prefix is additive).
- Server-side multipart and upload-from-URL (for AI ingest) if Phase 2 needs them.

## 19. File inventory (all < 500 lines)

| File | Est. lines | Role |
|---|---|---|
| `plugins/adapter.ts` | ~110 | contract + routing + DI token |
| `plugins/storage.provider.ts` | ~40 | factory provider |
| `plugins/local.ts` | ~250 | local fs adapter |
| `plugins/minio.ts` | ~220 | minio dual-client adapter |
| `file.service.ts` | ~180 | signature / upload / notify |
| `file.storage.service.ts` | ~140 | preview-url + thumbnail helpers |
| `file.repo.ts` | ~150 | Drizzle data access |
| `file.crop.processor.ts` | ~120 | thumbnail worker |
| `file.controller.ts` | ~120 | HTTP routes |
| `file.util.ts` | ~150 | crypto/mime/path helpers |
| `file.dto.ts` / `file.interface.ts` / `file.module.ts` | small | DTOs / types / wiring |
| `schema/file.schema.ts` | ~40 | table + enum |
| edits | — | `env.ts`, `cache.constants.ts`, `queue.constants.ts`, `exception.provider.ts`, `ability.types.ts`, `ability.factory.ts`, `schema/index.ts`, `main.module.ts`, `package.json` |
