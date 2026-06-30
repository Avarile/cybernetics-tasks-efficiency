# File-Management Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-contained file-management capability (presigned upload → object store → time-limited signed file-link, plus async image thumbnails) with pluggable **local** and **MinIO** backends.

**Architecture:** A `controller → service → repo` stack (matching the repo's existing modules) over a pluggable `StorageAdapter` abstraction chosen at runtime from `env.FILE_STORAGE_PROVIDER`. Standalone `attachment` rows are addressable by `token` (presign-time handle) and `slug` (uuid). All Redis cache ownership lives in the service layer (which holds tenant `ctx`); adapters are ctx/cache-free and pure-I/O. Thumbnails run async on a BullMQ queue.

**Tech Stack:** NestJS 10, Drizzle ORM (node-postgres), BullMQ, `cache-manager` (ioredis), CASL, class-validator, Zod, `minio`, `sharp`, `fs-extra`, `mime-types`. Spec: `docs/superpowers/specs/2026-06-29-file-management-design.md`.

## Global Constraints

- Files stay **under 500 lines**; one responsibility per file.
- **Never commit secrets**; MinIO credentials live only in the gitignored `backend/.env`.
- **No `Co-Authored-By` trailer** on commits (project CLAUDE.md; attribution not enabled).
- Read a file before editing it; follow existing module patterns (`module-task` is the template).
- All repo methods take `ctx: IDBConfigOptions` and run via `runQuery(this.dbProvider, ctx, fn, executor?)`.
- Errors raise via `AppException.throw(<ERROR_CATALOG code>, message?)`; never throw raw `HttpException`.
- Validate at boundaries: size ≤ `env.FILE_MAX_UPLOAD_SIZE`; reject path traversal on local reads.
- All commands run **from `backend/`**. Test runner: `npx jest <path>` (jest `rootDir` is `backend/`, `testRegex` `.*\.spec\.ts$`).
- **Package manager is yarn (workspaces).** Add deps with `yarn add <pkg>` / `yarn add -D <pkg>` from `backend/`; this updates the **root** `yarn.lock` (stage it as `../yarn.lock`). Never run `npm install`.
- **Destructive git is forbidden:** no `git reset`, `git checkout <ref>`, `git clean`, `git stash`, `git rebase`, or `git add -A`/`git add .`. Stage explicit paths only, then commit.
- **`env` is parsed once at import time** (`src/utils/env.ts`). Tests must not rely on setting `process.env.*` in `beforeAll` to influence it — inject values via constructor params instead.
- Real-DB specs (`*.repo.spec.ts`, `*.integration.spec.ts`) require the dev Postgres in `backend/.env` to be running; pure-unit specs do not.
- Dropped vs. reference: S3/Aliyun adapters, `attachments_table` join, server-side multipart, upload-from-URL, `nestjs-cls`, v2 url-signer.

## File Structure

| File | Responsibility |
|---|---|
| `src/infra/application-db/schema/file.schema.ts` | `attachment` table + `file_purpose` enum |
| `src/modules/module-file-management/file.interface.ts` | entities, `FilePurpose`, presign/meta types |
| `src/modules/module-file-management/file.util.ts` | token gen, sha256, duration parse, mime checks, AES token cipher, path guard |
| `src/modules/module-file-management/plugins/adapter.ts` | abstract `StorageAdapter` + routing + DI token |
| `src/modules/module-file-management/plugins/local.ts` | local filesystem adapter |
| `src/modules/module-file-management/plugins/minio.ts` | MinIO dual-client adapter |
| `src/modules/module-file-management/plugins/storage.provider.ts` | DI factory (Local \| MinIO) |
| `src/modules/module-file-management/file.repo.ts` | Drizzle data access |
| `src/modules/module-file-management/file.storage.service.ts` | preview-URL (+cache) + thumbnail helpers |
| `src/modules/module-file-management/file.service.ts` | signature / upload / notify / link / delete |
| `src/modules/module-file-management/file.crop.processor.ts` | BullMQ image-thumbnail worker |
| `src/modules/module-file-management/file.dto.ts` | request DTOs |
| `src/modules/module-file-management/file.controller.ts` | HTTP routes |
| `src/modules/module-file-management/file.module.ts` | wiring |
| Edits | `env.ts`, `cache.constants.ts`, `queue.constants.ts`, `exception.provider.ts`, `ability.types.ts`, `ability.factory.ts`, `schema/index.ts`, `main.module.ts`, `package.json` |

---

### Task 1: Schema, interfaces & migration

**Files:**
- Create: `src/infra/application-db/schema/file.schema.ts`
- Create: `src/modules/module-file-management/file.interface.ts`
- Modify: `src/infra/application-db/schema/index.ts` (add export)
- Test: `src/infra/application-db/schema/file.schema.spec.ts`

**Interfaces:**
- Produces: `attachment` table; `filePurpose` pgEnum; `FilePurpose` enum (`General='general'`, `Public='public'`); `IPresignParams`, `IPresignRes`, `IObjectMeta`, `IRespHeaders`, `IAttachmentProfile`, `INewAttachment`, `IUpdateAttachment`, `IAttachmentEntity`, `IQueryAttachmentParams`, `INotifyResult`.

- [ ] **Step 1: Write the failing test**

Create `src/infra/application-db/schema/file.schema.spec.ts`:
```ts
import { getTableConfig } from 'drizzle-orm/pg-core';
import { attachment } from './file.schema';

describe('attachment schema', () => {
  it('maps to the attachment table with required columns', () => {
    const { name, columns } = getTableConfig(attachment);
    const names = columns.map((c) => c.name);
    expect(name).toBe('attachment');
    expect(names).toEqual(
      expect.arrayContaining([
        'token', 'bucket', 'path', 'hash', 'size', 'mimetype',
        'purpose', 'created_by_person_id', 'id', 'slug', 'is_deleted',
      ]),
    );
  });

  it('token is not nullable', () => {
    const { columns } = getTableConfig(attachment);
    const token = columns.find((c) => c.name === 'token')!;
    expect(token.notNull).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/infra/application-db/schema/file.schema.spec.ts`
Expected: FAIL — `Cannot find module './file.schema'`.

- [ ] **Step 3: Create the schema**

Create `src/infra/application-db/schema/file.schema.ts`:
```ts
import {
  bigint, index, integer, pgEnum, pgTable, text, uniqueIndex, varchar,
} from 'drizzle-orm/pg-core';
import { defaultFields } from './common.schema';

export const filePurpose = pgEnum('file_purpose', ['general', 'public']);

export const attachment = pgTable(
  'attachment',
  {
    token: varchar('token', { length: 64 }).notNull(),
    bucket: varchar('bucket', { length: 128 }).notNull(),
    path: varchar('path', { length: 1024 }).notNull(),
    hash: varchar('hash', { length: 128 }).notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    mimetype: varchar('mimetype', { length: 255 }).notNull(),
    width: integer('width'),
    height: integer('height'),
    thumbnailPath: text('thumbnail_path'),
    purpose: filePurpose('purpose').notNull().default('general'),
    createdByPersonId: integer('created_by_person_id').notNull(),
    ...defaultFields,
  },
  (t) => [
    uniqueIndex('attachment_token_index').on(t.token),
    index('attachment_hash_index').on(t.hash),
    index('attachment_created_by_index').on(t.createdByPersonId),
  ],
);
```

- [ ] **Step 4: Create the interfaces**

Create `src/modules/module-file-management/file.interface.ts`:
```ts
import { DefaultFields, IBaseQueryParams, UpdatableDefaultFields } from 'src/utils/shared/interface';

export enum FilePurpose {
  General = 'general',
  Public = 'public',
}

export interface IPresignParams {
  contentType: string;
  contentLength: number;
  expiresIn?: number;
  hash?: string;
  internal?: boolean;
}

export interface IPresignRes {
  token: string;
  path: string;
  url: string;
  uploadMethod: string;
  requestHeaders: Record<string, unknown>;
}

export interface IObjectMeta {
  size: number;
  mimetype: string;
  hash: string;
  url: string;
  width?: number;
  height?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IRespHeaders = Record<string, any>;

export interface IAttachmentProfile {
  token: string;
  bucket: string;
  path: string;
  hash: string;
  size: number;
  mimetype: string;
  width?: number | null;
  height?: number | null;
  thumbnailPath?: string | null;
  purpose: FilePurpose;
  createdByPersonId: number;
}

export interface INewAttachment extends IAttachmentProfile {}

export interface IUpdateAttachment
  extends Partial<Omit<IAttachmentProfile, 'createdByPersonId'>>,
    UpdatableDefaultFields {}

export interface IAttachmentEntity extends DefaultFields, IAttachmentProfile {
  width: number | null;
  height: number | null;
  thumbnailPath: string | null;
}

export interface IQueryAttachmentParams
  extends Partial<IAttachmentProfile>,
    Partial<IBaseQueryParams> {}

export interface INotifyResult {
  token: string;
  slug: string;
  path: string;
  size: number;
  mimetype: string;
  width?: number | null;
  height?: number | null;
  url: string;
  presignedUrl: string;
}
```

- [ ] **Step 5: Export the schema**

In `src/infra/application-db/schema/index.ts`, add at the end:
```ts
export * from './file.schema';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/infra/application-db/schema/file.schema.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Generate the migration**

Run: `npm run db:generate`
Expected: a new SQL file appears under `src/infra/application-db/migrations/` containing `CREATE TABLE "attachment"` and `CREATE TYPE "public"."file_purpose"`. (This file is what the test-schema harness replays, so it must exist before Task 6.)

- [ ] **Step 8: Commit**

```bash
git add src/infra/application-db/schema/file.schema.ts src/modules/module-file-management/file.interface.ts src/infra/application-db/schema/index.ts src/infra/application-db/schema/file.schema.spec.ts src/infra/application-db/migrations
git commit -m "feat(file-management): attachment schema, interfaces, migration"
```

---

### Task 2: Utilities, env vars & shared constants

**Files:**
- Create: `src/modules/module-file-management/file.util.ts`
- Modify: `src/utils/env.ts` (add `FILE_*` / `MINIO_*` block)
- Modify: `src/infra/cache/cache.constants.ts` (add `file*` keys)
- Modify: `src/infra/queue/queue.constants.ts` (add `FILE_CROP`, `FILE_CROP_JOB`)
- Modify: `src/utils/exception.provider.ts` (add 4 error codes)
- Test: `src/modules/module-file-management/file.util.spec.ts`

**Interfaces:**
- Consumes: `AppException` from `src/utils/exception.provider`.
- Produces: `randomToken(bytes?)`, `sha256Buffer(buf)`, `sha256File(path)`, `parseDurationSeconds(str)`, `isImage(mime)`, `isPdf(mime)`, `getExtensionPreview(mime)`, `assertPathWithinStorage(rel, dir)`, `TokenCipher` (`encrypt`/`decrypt`), `ILocalReadToken`; env keys; `cacheKey.fileSig/fileLocalSig/fileUpload/filePreview`; `QueueName.FILE_CROP`, `FILE_CROP_JOB`; error codes `FILE_TOKEN_INVALID`, `FILE_TOO_LARGE`, `FILE_TYPE_REJECTED`, `STORAGE_OPERATION_FAILED`.

- [ ] **Step 1: Add the error codes**

In `src/utils/exception.provider.ts`, add to `ERROR_CATALOG` (after `SERVICE_UNAVAILABLE`):
```ts
  FILE_TOKEN_INVALID:       { status: HttpStatus.BAD_REQUEST,            message: 'Invalid or expired file token' },
  FILE_TOO_LARGE:           { status: HttpStatus.PAYLOAD_TOO_LARGE,      message: 'File exceeds maximum upload size' },
  FILE_TYPE_REJECTED:       { status: HttpStatus.UNSUPPORTED_MEDIA_TYPE, message: 'File type not allowed' },
  STORAGE_OPERATION_FAILED: { status: HttpStatus.INTERNAL_SERVER_ERROR,  message: 'Storage operation failed' },
```

- [ ] **Step 2: Add env vars**

In `src/utils/env.ts`, add inside `z.object({ ... })` (before the closing `})`):
```ts
  // file management / storage
  FILE_STORAGE_PROVIDER: z.enum(['local', 'minio']).default('local'),
  FILE_PRIVATE_BUCKET: z.string().default('private'),
  FILE_PUBLIC_BUCKET: z.string().default('public'),
  FILE_UPLOAD_METHOD: z.string().default('PUT'),
  FILE_TOKEN_EXPIRE_IN: z.string().default('6d'),
  FILE_URL_EXPIRE_IN: z.string().default('6d'),
  FILE_MAX_UPLOAD_SIZE: z.coerce.number().default(52428800),
  FILE_TOKEN_SECRET: z.string().default('dev-insecure-file-token-secret-change-me'),
  FILE_LOCAL_PATH: z.string().default('.storage'),
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.string().transform((v) => v === 'true').default('false'),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_REGION: z.string().optional(),
  MINIO_INTERNAL_ENDPOINT: z.string().optional(),
  MINIO_INTERNAL_PORT: z.coerce.number().default(9000),
```
(`FILE_TOKEN_SECRET` has a dev default so build/tests pass; production sets a real value in `.env`.)

- [ ] **Step 3: Add cache keys**

In `src/infra/cache/cache.constants.ts`, add inside the `cacheKey` object:
```ts
  fileSig: (schema: string, token: string) => `cyb:${schema}:file:sig:${token}`,
  fileLocalSig: (schema: string, token: string) => `cyb:${schema}:file:lsig:${token}`,
  fileUpload: (schema: string, token: string) => `cyb:${schema}:file:upload:${token}`,
  filePreview: (schema: string, token: string) => `cyb:${schema}:file:preview:${token}`,
```

- [ ] **Step 4: Add queue constants**

In `src/infra/queue/queue.constants.ts`, change the enum and add a job-name const:
```ts
export enum QueueName {
  EXAMPLE = 'example',
  FILE_CROP = 'file-crop',
}

export const FILE_CROP_JOB = 'crop_image';
```

- [ ] **Step 5: Write the failing util test**

Create `src/modules/module-file-management/file.util.spec.ts`:
```ts
import {
  randomToken, sha256Buffer, parseDurationSeconds, isImage, isPdf,
  getExtensionPreview, assertPathWithinStorage, TokenCipher,
} from './file.util';

describe('file.util', () => {
  it('sha256Buffer hashes a known vector', () => {
    expect(sha256Buffer(Buffer.from(''))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('parseDurationSeconds parses units and raw seconds', () => {
    expect(parseDurationSeconds('6d')).toBe(518400);
    expect(parseDurationSeconds('30s')).toBe(30);
    expect(parseDurationSeconds('90')).toBe(90);
  });

  it('isImage / isPdf classify mimetypes', () => {
    expect(isImage('image/png')).toBe(true);
    expect(isImage('text/plain')).toBe(false);
    expect(isPdf('application/pdf')).toBe(true);
  });

  it('getExtensionPreview only allows safe inline types', () => {
    expect(getExtensionPreview('image/png')).toBe('image/png');
    expect(getExtensionPreview('text/html')).toBe('application/octet-stream');
  });

  it('randomToken returns url-safe tokens', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('TokenCipher round-trips a payload', () => {
    const cipher = new TokenCipher('test-secret');
    const token = cipher.encrypt({ expiresDate: 123, respHeaders: { 'Content-Type': 'image/png' } });
    expect(cipher.decrypt(token)).toEqual({ expiresDate: 123, respHeaders: { 'Content-Type': 'image/png' } });
  });

  it('assertPathWithinStorage rejects traversal and absolute paths', () => {
    expect(() => assertPathWithinStorage('../escape', '/srv/store')).toThrow();
    expect(() => assertPathWithinStorage('/etc/passwd', '/srv/store')).toThrow();
    expect(assertPathWithinStorage('private/general/abc', '/srv/store')).toBe('/srv/store/private/general/abc');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest src/modules/module-file-management/file.util.spec.ts`
Expected: FAIL — `Cannot find module './file.util'`.

- [ ] **Step 7: Implement the utilities**

Create `src/modules/module-file-management/file.util.ts`:
```ts
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';
import { createReadStream } from 'fs';
import { isAbsolute, resolve } from 'path';
import { AppException } from 'src/utils/exception.provider';

const IMAGE_RE = /^image\/(png|jpe?g|gif|webp|bmp|svg\+xml|tiff)$/i;
const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
const INLINE_PREVIEW = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp',
  'application/pdf', 'text/plain',
]);

export function randomToken(bytes = 16): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolveP, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolveP(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export function parseDurationSeconds(input: string): number {
  const m = /^(\d+)\s*([smhd])$/.exec(input.trim());
  if (m) return Number(m[1]) * UNIT_SECONDS[m[2]];
  const n = Number(input);
  if (!Number.isNaN(n)) return n;
  AppException.throw('VALIDATION_FAILED', `Invalid duration: ${input}`);
}

export function isImage(mimetype: string): boolean {
  return IMAGE_RE.test(mimetype ?? '');
}

export function isPdf(mimetype: string): boolean {
  return (mimetype ?? '').toLowerCase() === 'application/pdf';
}

export function getExtensionPreview(mimetype: string): string {
  return INLINE_PREVIEW.has((mimetype ?? '').toLowerCase()) ? mimetype : 'application/octet-stream';
}

export function assertPathWithinStorage(relativePath: string, storageDir: string): string {
  if (!relativePath || !storageDir || relativePath.includes('..') || isAbsolute(relativePath)) {
    AppException.throw('FILE_TOKEN_INVALID', 'Invalid file path');
  }
  const resolved = resolve(storageDir, relativePath);
  if (!resolved.startsWith(storageDir + '/')) {
    AppException.throw('FILE_TOKEN_INVALID', 'Invalid file path');
  }
  return resolved;
}

export interface ILocalReadToken {
  expiresDate: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  respHeaders?: Record<string, any>;
}

export class TokenCipher {
  private readonly key: Buffer;
  constructor(secret: string) {
    this.key = scryptSync(secret, 'cyb-file-token', 32);
  }
  encrypt(payload: ILocalReadToken): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, data]).toString('base64url');
  }
  decrypt(token: string): ILocalReadToken {
    const raw = Buffer.from(token, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const out = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    return JSON.parse(out.toString('utf8')) as ILocalReadToken;
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest src/modules/module-file-management/file.util.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 9: Verify build**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add src/modules/module-file-management/file.util.ts src/modules/module-file-management/file.util.spec.ts src/utils/env.ts src/infra/cache/cache.constants.ts src/infra/queue/queue.constants.ts src/utils/exception.provider.ts
git commit -m "feat(file-management): storage utils, env, cache/queue/error constants"
```

---

### Task 3: Storage adapter contract

**Files:**
- Create: `src/modules/module-file-management/plugins/adapter.ts`
- Test: `src/modules/module-file-management/plugins/adapter.spec.ts`

**Interfaces:**
- Consumes: `FilePurpose`, `IPresignParams`, `IPresignRes`, `IObjectMeta`, `IRespHeaders` (Task 1); `env` (Task 2).
- Produces: `STORAGE_ADAPTER` symbol; `InjectStorageAdapter()`; abstract class `StorageAdapter` with statics `getBucket(purpose)`, `getDir(purpose)`, `isPublicBucket(bucket)`, `TEMPORARY_DIR`, and abstract methods `presigned`, `getObjectMeta`, `getPreviewUrl`, `uploadFile`, `uploadFileWithPath`, `cropImage`, `downloadFile`, `deleteFile`, `deleteDir`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/module-file-management/plugins/adapter.spec.ts`:
```ts
import { StorageAdapter } from './adapter';
import { FilePurpose } from '../file.interface';

describe('StorageAdapter routing', () => {
  it('routes general → private bucket, public → public bucket', () => {
    expect(StorageAdapter.getBucket(FilePurpose.General)).toBe('private');
    expect(StorageAdapter.getBucket(FilePurpose.Public)).toBe('public');
  });

  it('getDir mirrors the purpose value', () => {
    expect(StorageAdapter.getDir(FilePurpose.General)).toBe('general');
  });

  it('isPublicBucket recognises the public bucket', () => {
    expect(StorageAdapter.isPublicBucket('public')).toBe(true);
    expect(StorageAdapter.isPublicBucket('private')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/modules/module-file-management/plugins/adapter.spec.ts`
Expected: FAIL — `Cannot find module './adapter'`.

- [ ] **Step 3: Implement the contract**

Create `src/modules/module-file-management/plugins/adapter.ts`:
```ts
import type { Readable } from 'node:stream';
import { resolve } from 'path';
import { Inject } from '@nestjs/common';
import env from 'src/utils/env';
import { FilePurpose, IObjectMeta, IPresignParams, IPresignRes, IRespHeaders } from '../file.interface';

export const STORAGE_ADAPTER = Symbol.for('STORAGE_ADAPTER');
export const InjectStorageAdapter = () => Inject(STORAGE_ADAPTER);

export interface IObjectHint {
  mimetype?: string;
  hash?: string;
  size?: number;
}

export abstract class StorageAdapter {
  static readonly TEMPORARY_DIR = resolve(process.cwd(), '.temporary');

  static getBucket(purpose: FilePurpose): string {
    return purpose === FilePurpose.Public ? env.FILE_PUBLIC_BUCKET : env.FILE_PRIVATE_BUCKET;
  }

  static getDir(purpose: FilePurpose): string {
    return purpose;
  }

  static isPublicBucket(bucket: string): boolean {
    return bucket === env.FILE_PUBLIC_BUCKET;
  }

  abstract presigned(bucket: string, dir: string, params: IPresignParams): Promise<IPresignRes>;
  abstract getObjectMeta(bucket: string, path: string, hint?: IObjectHint): Promise<IObjectMeta>;
  abstract getPreviewUrl(bucket: string, path: string, expiresIn?: number, respHeaders?: IRespHeaders): Promise<string>;
  abstract uploadFile(bucket: string, path: string, body: Buffer | Readable, metadata?: Record<string, unknown>): Promise<{ hash: string; path: string }>;
  abstract uploadFileWithPath(bucket: string, path: string, filePath: string, metadata?: Record<string, unknown>): Promise<{ hash: string; path: string }>;
  abstract cropImage(bucket: string, path: string, width?: number, height?: number, newPath?: string): Promise<string>;
  abstract downloadFile(bucket: string, path: string): Promise<Readable>;
  abstract deleteFile(bucket: string, path: string): Promise<void>;
  abstract deleteDir(bucket: string, path: string, throwError?: boolean): Promise<void>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/modules/module-file-management/plugins/adapter.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/module-file-management/plugins/adapter.ts src/modules/module-file-management/plugins/adapter.spec.ts
git commit -m "feat(file-management): StorageAdapter contract + bucket routing"
```

---

### Task 4: LocalStorage adapter

**Files:**
- Create: `src/modules/module-file-management/plugins/local.ts`
- Test: `src/modules/module-file-management/plugins/local.spec.ts`

**Interfaces:**
- Consumes: `StorageAdapter`, `IObjectHint` (Task 3); `TokenCipher`, `sha256File`, `randomToken`, `assertPathWithinStorage` (Task 2); `env`.
- Produces: `class LocalStorage extends StorageAdapter` plus local-only helpers used by the service: `saveTemporaryFile(req): Promise<ILocalFileUpload>`, `validateUpload(file, expected)`, `save(tempPath, relPath)`, `read(relPath): Readable`, `getLastModifiedTime(relPath): number | undefined`, `parsePath(path): { bucket; token }`, `verifyReadToken(token): { respHeaders }`, `storageDir: string`. `ILocalFileUpload = { path; size; mimetype }`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/module-file-management/plugins/local.spec.ts`:
```ts
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { LocalStorage } from './local';

describe('LocalStorage', () => {
  let storage: LocalStorage;
  const dir = mkdtempSync(join(tmpdir(), 'cyb-local-'));

  beforeAll(() => {
    storage = new LocalStorage(dir, 'unit-test-secret');
  });

  it('presigned returns an app upload url and PUT method', async () => {
    const res = await storage.presigned('private', 'general', { contentType: 'image/png', contentLength: 3 });
    expect(res.url).toContain('/api/files/upload/');
    expect(res.uploadMethod).toBe('PUT');
    expect(res.path).toBe(join('general', res.token));
  });

  it('uploadFile writes bytes and getObjectMeta reports them back', async () => {
    const body = Buffer.from('hello');
    await storage.uploadFile('private', 'general/abc', body, { 'Content-Type': 'text/plain' });
    const meta = await storage.getObjectMeta('private', 'general/abc', {
      mimetype: 'text/plain', hash: 'h', size: body.length,
    });
    expect(meta.size).toBe(5);
    expect(meta.mimetype).toBe('text/plain');
    expect(meta.url).toContain('/api/files/read/');
    // the bytes really landed on disk
    expect(readFileSync(resolve(storage.storageDir, 'private', 'general/abc')).toString()).toBe('hello');
  });

  it('getPreviewUrl emits a token that verifyReadToken accepts', async () => {
    const url = await storage.getPreviewUrl('private', 'general/abc', 600, { 'Content-Type': 'text/plain' });
    const token = new URL('http://x' + url).searchParams.get('token')!;
    expect(storage.verifyReadToken(token).respHeaders).toEqual({ 'Content-Type': 'text/plain' });
  });

  it('verifyReadToken rejects an expired token', async () => {
    const url = await storage.getPreviewUrl('private', 'general/abc', -1, {});
    const token = new URL('http://x' + url).searchParams.get('token')!;
    expect(() => storage.verifyReadToken(token)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/modules/module-file-management/plugins/local.spec.ts`
Expected: FAIL — `Cannot find module './local'`.

- [ ] **Step 3: Add dependencies and ignore runtime dirs**

Run (from `backend/`): `yarn add fs-extra sharp && yarn add -D @types/fs-extra`
Then append these two lines to the repo-root `.gitignore` (dev/test storage artifacts):
```
.storage/
.temporary/
```
Expected: `fs-extra`/`sharp` in `backend/package.json`; root `yarn.lock` updated; `.gitignore` has the two entries.

- [ ] **Step 4: Implement LocalStorage**

Create `src/modules/module-file-management/plugins/local.ts` (adapted from reference `plugins/local.ts`; cache removed, exceptions → `AppException`, hashing → `sha256File`):
```ts
import { createWriteStream, existsSync, rmSync, unlinkSync } from 'fs';
import type { Readable } from 'node:stream';
import { join, resolve } from 'path';
import type { Request } from 'express';
import * as fse from 'fs-extra';
// sharp v0.35 is a dual-package whose default-resolved types are a non-callable
// namespace under this repo's tsconfig (moduleResolution:node, esModuleInterop:false);
// target the CJS declaration (callable `export =`) and load via require for CJS runtime.
const sharp: typeof import('sharp/dist/index.cjs') = require('sharp');
import env from 'src/utils/env';
import { AppException } from 'src/utils/exception.provider';
import { IObjectHint, StorageAdapter } from './adapter';
import { IObjectMeta, IPresignParams, IPresignRes, IRespHeaders } from '../file.interface';
import { assertPathWithinStorage, ILocalReadToken, isImage, randomToken, sha256File, TokenCipher } from '../file.util';

export interface ILocalFileUpload {
  path: string;
  size: number;
  mimetype: string;
}

const READ_PREFIX = '/api/files/read';
const UPLOAD_PREFIX = '/api/files/upload';

export class LocalStorage extends StorageAdapter {
  readonly storageDir: string;
  private readonly cipher: TokenCipher;

  // storageDir/tokenSecret are injectable so tests stay hermetic; production
  // construction (the DI factory) passes nothing and falls back to env.
  constructor(storageDir?: string, tokenSecret?: string) {
    super();
    this.storageDir = storageDir ?? resolve(process.cwd(), env.FILE_LOCAL_PATH);
    this.cipher = new TokenCipher(tokenSecret ?? env.FILE_TOKEN_SECRET);
    fse.ensureDirSync(StorageAdapter.TEMPORARY_DIR);
    fse.ensureDirSync(this.storageDir);
  }

  async presigned(_bucket: string, dir: string, params: IPresignParams): Promise<IPresignRes> {
    const token = randomToken();
    const filename = params.hash ?? token;
    const path = join(dir, filename);
    const baseUrl = params.internal ? `http://localhost:${env.PORT}` : '';
    return {
      token,
      path,
      url: `${baseUrl}${UPLOAD_PREFIX}/${token}`,
      uploadMethod: env.FILE_UPLOAD_METHOD,
      requestHeaders: { 'Content-Type': params.contentType, 'Content-Length': params.contentLength },
    };
  }

  async saveTemporaryFile(req: Request): Promise<ILocalFileUpload> {
    const name = randomToken();
    const path = resolve(StorageAdapter.TEMPORARY_DIR, name);
    let size = 0;
    return new Promise<ILocalFileUpload>((resolveP, reject) => {
      const fileStream = createWriteStream(path);
      req.on('data', (chunk) => {
        fileStream.write(chunk);
        size += chunk.length;
      });
      req.on('end', () => fileStream.end());
      req.on('error', (err) => {
        fileStream.end();
        reject(err);
      });
      fileStream.on('error', reject);
      fileStream.on('finish', () =>
        resolveP({ size, mimetype: req.headers['content-type'] as string, path }),
      );
    });
  }

  validateUpload(file: ILocalFileUpload, expected: { contentLength?: number; contentType?: string }): void {
    if (expected.contentLength != null && expected.contentLength !== file.size) {
      AppException.throw('FILE_TOKEN_INVALID', 'Upload size mismatch');
    }
    if (expected.contentType && file.mimetype && expected.contentType !== file.mimetype) {
      AppException.throw('FILE_TYPE_REJECTED', `Not allowed to upload ${file.mimetype}`);
    }
  }

  async save(tempPath: string, relPath: string): Promise<string> {
    const dest = resolve(this.storageDir, relPath);
    await fse.ensureDir(resolve(dest, '..'));
    await fse.copy(tempPath, dest);
    this.deleteLocal(tempPath);
    return relPath;
  }

  read(relPath: string): Readable {
    return fse.createReadStream(resolve(this.storageDir, relPath));
  }

  getLastModifiedTime(relPath: string): number | undefined {
    const full = resolve(this.storageDir, relPath);
    return existsSync(full) ? fse.statSync(full).mtimeMs : undefined;
  }

  parsePath(path: string): { bucket: string; token: string } {
    const parts = path.split('/');
    return { bucket: parts[0], token: parts[parts.length - 1] };
  }

  private buildReadUrl(bucket: string, path: string, payload: ILocalReadToken): string {
    const token = this.cipher.encrypt(payload);
    const disposition = payload.respHeaders?.['Content-Disposition'];
    const suffix = disposition ? `&response-content-disposition=${encodeURIComponent(disposition)}` : '';
    return `${READ_PREFIX}/${join(bucket, path)}?token=${token}${suffix}`;
  }

  verifyReadToken(token: string): { respHeaders?: IRespHeaders } {
    let payload: ILocalReadToken;
    try {
      payload = this.cipher.decrypt(token);
    } catch {
      AppException.throw('FILE_TOKEN_INVALID', 'Invalid read token');
    }
    if (payload.expiresDate > 0 && Math.floor(Date.now() / 1000) > payload.expiresDate) {
      AppException.throw('FILE_TOKEN_INVALID', 'Read token expired');
    }
    return { respHeaders: payload.respHeaders };
  }

  async getObjectMeta(bucket: string, path: string, hint?: IObjectHint): Promise<IObjectMeta> {
    if (!hint?.mimetype || hint.hash == null || hint.size == null) {
      AppException.throw('STORAGE_OPERATION_FAILED', 'Local getObjectMeta requires upload hint');
    }
    const meta: IObjectMeta = {
      hash: hint.hash,
      size: hint.size,
      mimetype: hint.mimetype,
      url: this.buildReadUrl(bucket, path, { expiresDate: -1, respHeaders: { 'Content-Type': hint.mimetype } }),
    };
    if (!isImage(hint.mimetype)) return meta;
    try {
      const { width, height } = await sharp(resolve(this.storageDir, bucket, path)).metadata();
      return { ...meta, width, height };
    } catch {
      return meta;
    }
  }

  async getPreviewUrl(bucket: string, path: string, expiresIn = 0, respHeaders?: IRespHeaders): Promise<string> {
    return this.buildReadUrl(bucket, path, {
      expiresDate: Math.floor(Date.now() / 1000) + expiresIn,
      respHeaders,
    });
  }

  async uploadFile(bucket: string, path: string, body: Buffer | Readable): Promise<{ hash: string; path: string }> {
    const temp = resolve(StorageAdapter.TEMPORARY_DIR, randomToken());
    if (Buffer.isBuffer(body)) {
      await fse.writeFile(temp, body);
    } else {
      await new Promise<void>((resolveP, reject) => {
        const writer = createWriteStream(temp);
        body.pipe(writer);
        body.on('error', reject);
        writer.on('finish', resolveP);
        writer.on('error', reject);
      });
    }
    const hash = await sha256File(temp);
    await this.save(temp, join(bucket, path));
    return { hash, path };
  }

  async uploadFileWithPath(bucket: string, path: string, filePath: string): Promise<{ hash: string; path: string }> {
    const hash = await sha256File(filePath);
    const dest = resolve(this.storageDir, bucket, path);
    await fse.ensureDir(resolve(dest, '..'));
    await fse.copy(filePath, dest);
    return { hash, path };
  }

  async cropImage(bucket: string, path: string, width?: number, height?: number, newPath?: string): Promise<string> {
    const out = newPath || `${path}_${width ?? 0}_${height ?? 0}`;
    const outFull = resolve(this.storageDir, bucket, out);
    if (existsSync(outFull)) return out;
    const image = sharp(resolve(this.storageDir, bucket, path), { failOn: 'none', unlimited: true });
    const meta = await image.metadata();
    if (!meta.width || !meta.height) {
      AppException.throw('STORAGE_OPERATION_FAILED', 'Invalid image for crop');
    }
    await fse.ensureDir(resolve(outFull, '..'));
    await image.resize(width, height).toFile(outFull);
    return out;
  }

  async downloadFile(bucket: string, path: string): Promise<Readable> {
    return fse.createReadStream(resolve(this.storageDir, bucket, path));
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    this.deleteLocal(resolve(this.storageDir, bucket, path));
  }

  async deleteDir(bucket: string, path: string, throwError = true): Promise<void> {
    const dir = resolve(this.storageDir, bucket, path);
    try {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    } catch (err) {
      if (!throwError) return;
      throw err;
    }
  }

  private deleteLocal(filePath: string): void {
    try {
      unlinkSync(filePath);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code !== 'ENOENT') throw err;
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/modules/module-file-management/plugins/local.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/modules/module-file-management/plugins/local.ts src/modules/module-file-management/plugins/local.spec.ts package.json ../yarn.lock ../.gitignore
git commit -m "feat(file-management): local filesystem storage adapter"
```

---

### Task 5: MinioStorage adapter

**Files:**
- Create: `src/modules/module-file-management/plugins/minio.ts`
- Test: `src/modules/module-file-management/plugins/minio.spec.ts`

**Interfaces:**
- Consumes: `StorageAdapter`, `IObjectHint` (Task 3); `env`; `minio`, `sharp`.
- Produces: `class MinioStorage extends StorageAdapter` with two `minio.Client`s (`minioClient` public, `minioClientInternal` internal). All server-side ops use the internal client; `presigned`/`getPreviewUrl` use the public client.

- [ ] **Step 1: Add the `minio` dependency**

Run (from `backend/`): `yarn add minio`
Expected: `minio` in `backend/package.json`; root `yarn.lock` updated. (`sharp`/`fs-extra` were installed in Task 4.)

- [ ] **Step 2: Write the failing test**

Create `src/modules/module-file-management/plugins/minio.spec.ts`:
```ts
const presignedUrl = jest.fn().mockResolvedValue('http://minio/upload');
const presignedGetObject = jest.fn().mockResolvedValue('http://minio/get');
const statObject = jest.fn().mockResolvedValue({ size: 7, etag: 'etag123', metaData: { 'content-type': 'text/plain' } });
const putObject = jest.fn().mockResolvedValue({ etag: 'etag123' });
const removeObject = jest.fn().mockResolvedValue(undefined);

jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    presignedUrl, presignedGetObject, statObject, putObject, removeObject,
  })),
}));

import { MinioStorage } from './minio';

describe('MinioStorage', () => {
  // The minio.Client is mocked, so the constructor's env-derived args don't matter.
  beforeEach(() => jest.clearAllMocks());

  it('presigned builds a url and a token', async () => {
    const storage = new MinioStorage();
    const res = await storage.presigned('private', 'general', { contentType: 'text/plain', contentLength: 7 });
    expect(res.url).toBe('http://minio/upload');
    expect(res.token).toBeTruthy();
    expect(presignedUrl).toHaveBeenCalled();
  });

  it('getObjectMeta maps statObject (etag→hash) ignoring the hint', async () => {
    const storage = new MinioStorage();
    const meta = await storage.getObjectMeta('private', 'general/x');
    expect(meta).toMatchObject({ size: 7, hash: 'etag123', mimetype: 'text/plain' });
  });

  it('deleteFile uses removeObject', async () => {
    const storage = new MinioStorage();
    await storage.deleteFile('private', 'general/x');
    expect(removeObject).toHaveBeenCalledWith('private', 'general/x');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/modules/module-file-management/plugins/minio.spec.ts`
Expected: FAIL — `Cannot find module './minio'`.

- [ ] **Step 4: Implement MinioStorage**

Create `src/modules/module-file-management/plugins/minio.ts` (adapted from reference `plugins/minio.ts`; config → `env`, exceptions → `AppException`):
```ts
import type { Readable } from 'node:stream';
import { join, resolve } from 'path';
import * as minio from 'minio';
import * as fse from 'fs-extra';
// sharp v0.35 is a dual-package whose default-resolved types are a non-callable
// namespace under this repo's tsconfig (moduleResolution:node, esModuleInterop:false);
// target the CJS declaration (callable `export =`) and load via require for CJS runtime.
const sharp: typeof import('sharp/dist/index.cjs') = require('sharp');
import env from 'src/utils/env';
import { AppException } from 'src/utils/exception.provider';
import { parseDurationSeconds, randomToken, isImage } from '../file.util';
import { IObjectHint, StorageAdapter } from './adapter';
import { IObjectMeta, IPresignParams, IPresignRes, IRespHeaders } from '../file.interface';

export class MinioStorage extends StorageAdapter {
  private readonly client: minio.Client;
  private readonly internal: minio.Client;

  constructor() {
    super();
    this.client = new minio.Client({
      endPoint: env.MINIO_ENDPOINT as string,
      port: env.MINIO_PORT,
      useSSL: env.MINIO_USE_SSL,
      accessKey: env.MINIO_ACCESS_KEY as string,
      secretKey: env.MINIO_SECRET_KEY as string,
      region: env.MINIO_REGION,
    });
    this.internal = env.MINIO_INTERNAL_ENDPOINT
      ? new minio.Client({
          endPoint: env.MINIO_INTERNAL_ENDPOINT,
          port: env.MINIO_INTERNAL_PORT,
          useSSL: false,
          accessKey: env.MINIO_ACCESS_KEY as string,
          secretKey: env.MINIO_SECRET_KEY as string,
          region: env.MINIO_REGION,
        })
      : this.client;
    fse.ensureDirSync(StorageAdapter.TEMPORARY_DIR);
  }

  async presigned(bucket: string, dir: string, params: IPresignParams): Promise<IPresignRes> {
    const token = randomToken();
    const path = join(dir, params.hash ?? token);
    const requestHeaders = {
      'Content-Type': params.contentType,
      'Content-Length': params.contentLength,
      'response-cache-control': 'max-age=31536000, immutable',
    };
    const expiry = params.expiresIn ?? parseDurationSeconds(env.FILE_TOKEN_EXPIRE_IN);
    try {
      const client = params.internal ? this.internal : this.client;
      const url = await client.presignedUrl(env.FILE_UPLOAD_METHOD, bucket, path, expiry, requestHeaders);
      return { url, path, token, uploadMethod: env.FILE_UPLOAD_METHOD, requestHeaders };
    } catch (e) {
      AppException.throw('STORAGE_OPERATION_FAILED', e instanceof Error ? e.message : 'presign failed');
    }
  }

  async getObjectMeta(bucket: string, path: string, _hint?: IObjectHint): Promise<IObjectMeta> {
    const { size, etag: hash, metaData } = await this.internal.statObject(bucket, path);
    const mimetype = metaData['content-type'] as string;
    const url = `/${bucket}/${path}`;
    if (!isImage(mimetype ?? '')) return { hash, size, mimetype, url };
    return { ...(await this.getShape(bucket, path)), hash, size, mimetype, url };
  }

  private async getShape(bucket: string, path: string): Promise<{ width?: number; height?: number }> {
    const stream = await this.internal.getObject(bucket, path);
    try {
      const { width, height } = await stream.pipe(sharp()).metadata();
      return { width, height };
    } catch {
      return {};
    } finally {
      stream.removeAllListeners();
      stream.destroy();
    }
  }

  async getPreviewUrl(bucket: string, path: string, expiresIn?: number, respHeaders?: IRespHeaders): Promise<string> {
    const expiry = expiresIn ?? parseDurationSeconds(env.FILE_URL_EXPIRE_IN);
    const { 'Content-Disposition': disposition, ...rest } = respHeaders ?? {};
    return this.client.presignedGetObject(bucket, path, expiry, {
      ...rest,
      'response-content-disposition': disposition,
    });
  }

  async uploadFile(bucket: string, path: string, body: Buffer | Readable, metadata?: Record<string, unknown>): Promise<{ hash: string; path: string }> {
    const { etag: hash } = await this.internal.putObject(bucket, path, body as never, undefined, metadata as never);
    return { hash, path };
  }

  async uploadFileWithPath(bucket: string, path: string, filePath: string, metadata?: Record<string, unknown>): Promise<{ hash: string; path: string }> {
    const { etag: hash } = await this.internal.fPutObject(bucket, path, filePath, metadata as never);
    return { hash, path };
  }

  async cropImage(bucket: string, path: string, width?: number, height?: number, newPath?: string): Promise<string> {
    const out = newPath || `${path}_${width ?? 0}_${height ?? 0}`;
    const source = resolve(StorageAdapter.TEMPORARY_DIR, encodeURIComponent(path));
    const resized = resolve(StorageAdapter.TEMPORARY_DIR, encodeURIComponent(join(bucket, out)));
    const stream = await this.internal.getObject(bucket, path);
    await new Promise<void>((resolveP, reject) => {
      const writer = fse.createWriteStream(source);
      stream.pipe(writer);
      stream.on('error', reject);
      writer.on('finish', resolveP);
      writer.on('error', reject);
    });
    await sharp(source, { failOn: 'none', unlimited: true }).resize(width, height).toFile(resized);
    await this.uploadFileWithPath(bucket, out, resized);
    fse.removeSync(source);
    fse.removeSync(resized);
    return out;
  }

  async downloadFile(bucket: string, path: string): Promise<Readable> {
    return this.internal.getObject(bucket, path);
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    await this.internal.removeObject(bucket, path);
  }

  async deleteDir(bucket: string, path: string, throwError = true): Promise<void> {
    try {
      const prefix = path.endsWith('/') ? path : `${path}/`;
      const names: string[] = [];
      const stream = this.internal.listObjects(bucket, prefix, true);
      await new Promise<void>((resolveP, reject) => {
        stream.on('data', (o) => o.name && names.push(o.name));
        stream.on('end', () => resolveP());
        stream.on('error', reject);
      });
      if (names.length) await this.internal.removeObjects(bucket, names);
    } catch (err) {
      if (!throwError) return;
      AppException.throw('STORAGE_OPERATION_FAILED', err instanceof Error ? err.message : 'deleteDir failed');
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/modules/module-file-management/plugins/minio.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/modules/module-file-management/plugins/minio.ts src/modules/module-file-management/plugins/minio.spec.ts package.json ../yarn.lock
git commit -m "feat(file-management): MinIO dual-client storage adapter"
```

---

### Task 6: FileRepository

**Files:**
- Create: `src/modules/module-file-management/file.repo.ts`
- Test: `src/modules/module-file-management/file.repo.spec.ts`

**Interfaces:**
- Consumes: `attachment` table (Task 1); `ApplicationDBProvider`, `runQuery`, `IDBConfigOptions`, `BaseRepo`, `IAttachmentEntity`, `INewAttachment`, `IUpdateAttachment`, `DbExecutor`.
- Produces: `class FileRepository` methods — `create(item, ctx)`, `findById(id, ctx)`, `findBySlug(slug, ctx)`, `findByToken(token, ctx)`, `update(id, payload, ctx)`, `delete(id, ctx)`, `setThumbnailPath(token, thumbnailPath, ctx, executor?)`, `findAll(params, ctx)`, `query(params, ctx)`, `countAll(ctx, where?)`.

- [ ] **Step 1: Write the failing test** (requires dev Postgres)

Create `src/modules/module-file-management/file.repo.spec.ts`:
```ts
import 'dotenv/config';
import { useTestSchema } from '../../../test/db-setup';
import ApplicationDBProvider from 'src/infra/application-db/db-connection';
import { FileRepository } from './file.repo';
import { FilePurpose, INewAttachment } from './file.interface';

describe('FileRepository (real DB)', () => {
  const { getCtx } = useTestSchema();
  let repo: FileRepository;
  beforeAll(() => { repo = new FileRepository(new ApplicationDBProvider()); });

  const base = (token: string): INewAttachment => ({
    token, bucket: 'private', path: `general/${token}`, hash: 'h', size: 10,
    mimetype: 'text/plain', purpose: FilePurpose.General, createdByPersonId: 1,
  });

  it('create then findByToken / findBySlug round-trips', async () => {
    const ctx = getCtx();
    const row = await repo.create(base('tok-a'), ctx);
    expect(row.slug).toBeTruthy();
    expect((await repo.findByToken('tok-a', ctx))!.id).toBe(row.id);
    expect((await repo.findBySlug(row.slug, ctx))!.token).toBe('tok-a');
  });

  it('setThumbnailPath persists JSON', async () => {
    const ctx = getCtx();
    await repo.create(base('tok-b'), ctx);
    await repo.setThumbnailPath('tok-b', JSON.stringify({ sm: 's', lg: 'l' }), ctx);
    expect((await repo.findByToken('tok-b', ctx))!.thumbnailPath).toBe('{"sm":"s","lg":"l"}');
  });

  it('delete soft-deletes', async () => {
    const ctx = getCtx();
    const row = await repo.create(base('tok-c'), ctx);
    await repo.delete(row.id, ctx);
    expect(await repo.findById(row.id, ctx)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/modules/module-file-management/file.repo.spec.ts`
Expected: FAIL — `Cannot find module './file.repo'`.

- [ ] **Step 3: Implement the repository**

Create `src/modules/module-file-management/file.repo.ts`:
```ts
import { HttpStatus, Injectable } from '@nestjs/common';
import { and, count, desc, eq, getTableColumns, inArray, SQL } from 'drizzle-orm';
import { PgColumn } from 'drizzle-orm/pg-core';
import ApplicationDBProvider, { DbExecutor } from 'src/infra/application-db/db-connection';
import { runQuery } from 'src/infra/application-db/query-runner';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { attachment } from 'src/infra/application-db/schema/file.schema';
import { AppException } from 'src/utils/exception.provider';
import { BaseRepo } from 'src/utils/shared/base.abstract';
import { IBaseQueryResult } from 'src/utils/shared/interface';
import { withPagination } from 'src/utils/shared/query';
import { IAttachmentEntity, INewAttachment, IQueryAttachmentParams, IUpdateAttachment } from './file.interface';

@Injectable()
export class FileRepository implements BaseRepo<IAttachmentEntity> {
  constructor(private readonly dbProvider: ApplicationDBProvider) {}

  async create(item: INewAttachment, ctx: IDBConfigOptions): Promise<IAttachmentEntity> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db.insert(attachment).values({
        token: item.token,
        bucket: item.bucket,
        path: item.path,
        hash: item.hash,
        size: item.size,
        mimetype: item.mimetype,
        width: item.width ?? null,
        height: item.height ?? null,
        thumbnailPath: item.thumbnailPath ?? null,
        purpose: item.purpose,
        createdByPersonId: item.createdByPersonId,
      }).returning();
      return row as IAttachmentEntity;
    });
  }

  async findById(id: string | number, ctx: IDBConfigOptions): Promise<IAttachmentEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db.select({ ...getTableColumns(attachment) }).from(attachment)
        .where(and(eq(attachment.id, Number(id)), eq(attachment.isDeleted, false)));
      return (row as IAttachmentEntity) || null;
    });
  }

  async findBySlug(slug: string, ctx: IDBConfigOptions): Promise<IAttachmentEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db.select({ ...getTableColumns(attachment) }).from(attachment)
        .where(and(eq(attachment.slug, slug), eq(attachment.isDeleted, false)));
      return (row as IAttachmentEntity) || null;
    });
  }

  async findByToken(token: string, ctx: IDBConfigOptions): Promise<IAttachmentEntity | null> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [row] = await db.select({ ...getTableColumns(attachment) }).from(attachment)
        .where(and(eq(attachment.token, token), eq(attachment.isDeleted, false)));
      return (row as IAttachmentEntity) || null;
    });
  }

  async setThumbnailPath(token: string, thumbnailPath: string, ctx: IDBConfigOptions, executor?: DbExecutor): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db.update(attachment)
        .set({ thumbnailPath, updatedAt: new Date().toISOString() })
        .where(eq(attachment.token, token));
    }, executor);
  }

  async update(id: string | number, payload: IUpdateAttachment, ctx: IDBConfigOptions): Promise<IAttachmentEntity> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [existing] = await db.select({ id: attachment.id }).from(attachment)
        .where(and(eq(attachment.id, Number(id)), eq(attachment.isDeleted, false)));
      if (!existing) AppException.notFound('Attachment', id);
      const { id: _i, slug: _s, createdAt: _c, ...rest } = payload as Record<string, unknown>;
      const [row] = await db.update(attachment)
        .set({ ...rest, updatedAt: new Date().toISOString() })
        .where(eq(attachment.id, Number(id))).returning();
      return row as IAttachmentEntity;
    });
  }

  async delete(id: string | number, ctx: IDBConfigOptions): Promise<void> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      await db.update(attachment)
        .set({ isDeleted: true, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(attachment.id, Number(id)));
    });
  }

  async countAll(ctx: IDBConfigOptions, where?: SQL): Promise<number> {
    return runQuery(this.dbProvider, ctx, async (db) => {
      const [{ c }] = await db.select({ c: count() }).from(attachment)
        .where(where ?? eq(attachment.isDeleted, false));
      return Number(c);
    });
  }

  async query(params: IQueryAttachmentParams, ctx: IDBConfigOptions): Promise<IBaseQueryResult> {
    const { token, hash, purpose, createdByPersonId, ids, page = 1, pageSize = 50 } = params;
    const conditions: SQL[] = [eq(attachment.isDeleted, false)];
    if (token) conditions.push(eq(attachment.token, token));
    if (hash) conditions.push(eq(attachment.hash, hash));
    if (purpose) conditions.push(eq(attachment.purpose, purpose));
    if (createdByPersonId) conditions.push(eq(attachment.createdByPersonId, createdByPersonId));
    if (ids?.length) conditions.push(inArray(attachment.id, ids));
    const where = and(...conditions);
    return runQuery(this.dbProvider, ctx, async (db) => {
      const columnMap: Record<string, PgColumn> = {
        createdAt: attachment.createdAt as unknown as PgColumn,
        id: attachment.id as unknown as PgColumn,
      };
      const order = [desc(columnMap.createdAt)];
      const q = db.select({ ...getTableColumns(attachment) }).from(attachment).where(where).orderBy(...order).$dynamic();
      const data = await withPagination(q, page, pageSize);
      const total = await this.countAll(ctx, where);
      return {
        data: data as IAttachmentEntity[],
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        status_code: HttpStatus.OK,
        message: 'Attachment query successful',
        timestamp: new Date(),
        error: null,
      };
    });
  }

  async findAll(params: IQueryAttachmentParams, ctx: IDBConfigOptions): Promise<IAttachmentEntity[]> {
    const res = await this.query(params, ctx);
    return res.data as IAttachmentEntity[];
  }
}
```
(Ordering uses `desc(createdAt)`, mirroring the sibling repos' list-query pattern.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/modules/module-file-management/file.repo.spec.ts`
Expected: PASS (3 tests). If it errors with `relation "attachment" does not exist`, the Task 1 migration was not generated — run `npm run db:generate` and retry.

- [ ] **Step 5: Verify build & commit**

```bash
npm run build
git add src/modules/module-file-management/file.repo.ts src/modules/module-file-management/file.repo.spec.ts
git commit -m "feat(file-management): FileRepository (Drizzle data access)"
```

---

### Task 7: FileStorageService (preview URL + thumbnail helpers)

**Files:**
- Create: `src/modules/module-file-management/file.storage.service.ts`
- Test: `src/modules/module-file-management/file.storage.service.spec.ts`

**Interfaces:**
- Consumes: `StorageAdapter`/`InjectStorageAdapter` (Task 3); `CACHE_MANAGER` `Cache`; `cacheKey.filePreview` (Task 2); `parseDurationSeconds`, `isImage` (Task 2); `env`.
- Produces: `class FileStorageService` — `getPreviewUrlByPath(schema, bucket, path, token, expiresIn?, respHeaders?): Promise<string>`, `cropImageThumbnails(bucket, path, height): Promise<{ sm?: string; lg?: string }>`, `uploadThumbnailsFromBuffer(bucket, path, buffer, height): Promise<{ sm?: string; lg?: string }>`. Constants `THUMB_SM = 56`, `THUMB_LG = 525`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/module-file-management/file.storage.service.spec.ts`:
```ts
import { FileStorageService } from './file.storage.service';

const makeCache = () => {
  const store = new Map<string, unknown>();
  return {
    get: jest.fn(async (k: string) => store.get(k)),
    set: jest.fn(async (k: string, v: unknown) => void store.set(k, v)),
    _store: store,
  };
};

describe('FileStorageService', () => {
  it('caches the preview url under the second call', async () => {
    const cache = makeCache();
    const adapter = { getPreviewUrl: jest.fn().mockResolvedValue('signed://url') } as any;
    const svc = new FileStorageService(cache as any, adapter);

    const a = await svc.getPreviewUrlByPath('public', 'private', 'general/x', 'tok');
    const b = await svc.getPreviewUrlByPath('public', 'private', 'general/x', 'tok');

    expect(a).toBe('signed://url');
    expect(b).toBe('signed://url');
    expect(adapter.getPreviewUrl).toHaveBeenCalledTimes(1); // second served from cache
  });

  it('cropImageThumbnails only makes the sizes the height supports', async () => {
    const cache = makeCache();
    const adapter = { cropImage: jest.fn().mockImplementation(async (_b, _p, _w, h) => `thumb-${h}`) } as any;
    const svc = new FileStorageService(cache as any, adapter);

    const out = await svc.cropImageThumbnails('private', 'general/x', 100); // > 56, < 525
    expect(out.sm).toBe('thumb-56');
    expect(out.lg).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/modules/module-file-management/file.storage.service.spec.ts`
Expected: FAIL — `Cannot find module './file.storage.service'`.

- [ ] **Step 3: Implement the service**

Create `src/modules/module-file-management/file.storage.service.ts`:
```ts
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
// sharp v0.35 is a dual-package whose default-resolved types are a non-callable
// namespace under this repo's tsconfig (moduleResolution:node, esModuleInterop:false);
// target the CJS declaration (callable `export =`) and load via require for CJS runtime.
const sharp: typeof import('sharp/dist/index.cjs') = require('sharp');
import env from 'src/utils/env';
import { cacheKey } from 'src/infra/cache/cache.constants';
import { InjectStorageAdapter, StorageAdapter } from './plugins/adapter';
import { parseDurationSeconds } from './file.util';
import { IRespHeaders } from './file.interface';

export const THUMB_SM = 56;
export const THUMB_LG = 525;
const THUMB_MIMETYPE = 'image/png';

@Injectable()
export class FileStorageService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectStorageAdapter() private readonly adapter: StorageAdapter,
  ) {}

  async getPreviewUrlByPath(
    schema: string,
    bucket: string,
    path: string,
    token: string,
    expiresIn?: number,
    respHeaders?: IRespHeaders,
  ): Promise<string> {
    const expiry = expiresIn ?? parseDurationSeconds(env.FILE_URL_EXPIRE_IN);
    const key = cacheKey.filePreview(schema, token);
    const cached = await this.cache.get<{ url: string }>(key);
    if (cached?.url) return cached.url;
    const url = await this.adapter.getPreviewUrl(bucket, path, expiry, respHeaders);
    await this.cache.set(key, { url }, Math.floor(expiry * 0.5) * 1000);
    return url;
  }

  async cropImageThumbnails(bucket: string, path: string): Promise<{ sm?: string; lg?: string }>;
  async cropImageThumbnails(bucket: string, path: string, height: number): Promise<{ sm?: string; lg?: string }>;
  async cropImageThumbnails(bucket: string, path: string, height = Infinity): Promise<{ sm?: string; lg?: string }> {
    const sm = height > THUMB_SM ? await this.adapter.cropImage(bucket, path, undefined, THUMB_SM, `${path}_sm`) : undefined;
    const lg = height > THUMB_LG ? await this.adapter.cropImage(bucket, path, undefined, THUMB_LG, `${path}_lg`) : undefined;
    return { sm, lg };
  }

  async uploadThumbnailsFromBuffer(
    bucket: string,
    path: string,
    buffer: Buffer,
    height: number,
  ): Promise<{ sm?: string; lg?: string }> {
    const image = sharp(buffer, { failOn: 'none', unlimited: true });
    let sm: string | undefined;
    let lg: string | undefined;
    if (height > THUMB_SM) {
      const buf = await image.clone().resize(undefined, THUMB_SM).png().toBuffer();
      sm = (await this.adapter.uploadFile(bucket, `${path}_sm`, buf, { 'Content-Type': THUMB_MIMETYPE })).path;
    }
    if (height > THUMB_LG) {
      const buf = await image.clone().resize(undefined, THUMB_LG).png().toBuffer();
      lg = (await this.adapter.uploadFile(bucket, `${path}_lg`, buf, { 'Content-Type': THUMB_MIMETYPE })).path;
    }
    return { sm, lg };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/modules/module-file-management/file.storage.service.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/module-file-management/file.storage.service.ts src/modules/module-file-management/file.storage.service.spec.ts
git commit -m "feat(file-management): preview-url caching + thumbnail helpers"
```

---

### Task 8: FileService (signature / upload / notify / link / delete)

**Files:**
- Create: `src/modules/module-file-management/file.service.ts`
- Test: `src/modules/module-file-management/file.service.spec.ts`

**Interfaces:**
- Consumes: `FileRepository` (Task 6), `FileStorageService` (Task 7), `StorageAdapter`/`InjectStorageAdapter` (Task 3), `LocalStorage` type (Task 4), `CACHE_MANAGER` `Cache`, `cacheKey.*` (Task 2), `QueueName.FILE_CROP`/`FILE_CROP_JOB` + `@InjectQueue` `Queue`, `StorageAdapter.getBucket/getDir`, `AppException`, `assertAbility`, `AppAbility`, `IDBConfigOptions`, `env`.
- Produces: `class FileService` — `signature(dto, ctx): Promise<IPresignRes>`, `notify(token, ctx, filename?): Promise<INotifyResult>`, `uploadLocal(req, token): Promise<void>`, `readLocalFile(path, token?): Promise<{ fileStream; headers }>`, `localConditionalCaching(path, reqHeaders, res): boolean`, `requireBySlugAuthorized(slug, ctx, ability): Promise<IAttachmentEntity>`, `getLink(slug, ctx, ability): Promise<string>`, `remove(slug, ctx, ability): Promise<void>`. `signature` dto = `{ purpose: FilePurpose; contentType: string; contentLength: number; hash?: string; internal?: boolean }`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/module-file-management/file.service.spec.ts`:
```ts
import { FileService } from './file.service';
import { FilePurpose } from './file.interface';

const ctx = { database_uri: 'x', schema_id: 'public', user_id: 7 } as any;

const makeCache = () => {
  const store = new Map<string, unknown>();
  return {
    get: jest.fn(async (k: string) => store.get(k)),
    set: jest.fn(async (k: string, v: unknown) => void store.set(k, v)),
    del: jest.fn(async (k: string) => void store.delete(k)),
  };
};

describe('FileService', () => {
  let repo: any; let storageSvc: any; let adapter: any; let cache: any; let queue: any; let svc: FileService;

  beforeEach(() => {
    repo = {
      create: jest.fn(async (i) => ({ id: 1, slug: 'slug-1', ...i })),
      findByToken: jest.fn(),
    };
    storageSvc = { getPreviewUrlByPath: jest.fn(async () => 'signed://url') };
    adapter = {
      presigned: jest.fn(async () => ({ token: 'tok', path: 'general/tok', url: 'u', uploadMethod: 'PUT', requestHeaders: {} })),
      getObjectMeta: jest.fn(async () => ({ hash: 'h', size: 5, mimetype: 'text/plain', url: '/private/general/tok' })),
    };
    cache = makeCache();
    queue = { add: jest.fn() };
    // 6th arg is DbContextService; only uploadLocal/readLocalFile use it (untested here)
    svc = new FileService(repo, storageSvc, adapter, cache, queue, { system: () => ctx } as any);
  });

  it('signature rejects oversized files', async () => {
    await expect(
      svc.signature({ purpose: FilePurpose.General, contentType: 'text/plain', contentLength: 999999999999 }, ctx),
    ).rejects.toBeDefined();
    expect(adapter.presigned).not.toHaveBeenCalled();
  });

  it('signature presigns and caches the token', async () => {
    const res = await svc.signature({ purpose: FilePurpose.General, contentType: 'text/plain', contentLength: 5 }, ctx);
    expect(res.token).toBe('tok');
    expect(cache.set).toHaveBeenCalledWith(expect.stringContaining('file:sig:tok'), expect.objectContaining({ bucket: 'private' }), expect.any(Number));
  });

  it('notify throws on an unknown token', async () => {
    await expect(svc.notify('missing', ctx)).rejects.toBeDefined();
  });

  it('notify creates the row, enqueues a crop job, and returns a link', async () => {
    await svc.signature({ purpose: FilePurpose.General, contentType: 'text/plain', contentLength: 5 }, ctx);
    const out = await svc.notify('tok', ctx);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok', createdByPersonId: 7 }), ctx);
    expect(queue.add).toHaveBeenCalled();
    expect(out.presignedUrl).toBe('signed://url');
    expect(out.slug).toBe('slug-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/modules/module-file-management/file.service.spec.ts`
Expected: FAIL — `Cannot find module './file.service'`.

- [ ] **Step 3: Implement the service**

Create `src/modules/module-file-management/file.service.ts`:
```ts
import type { IncomingHttpHeaders } from 'http';
import type { Request, Response } from 'express';
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectQueue } from '@nestjs/bullmq';
import { Cache } from 'cache-manager';
import { Queue } from 'bullmq';
import env from 'src/utils/env';
import { AppException } from 'src/utils/exception.provider';
import { assertAbility } from 'src/common/casl/assert-ability';
import { AppAbility } from 'src/common/casl/ability.types';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { cacheKey } from 'src/infra/cache/cache.constants';
import { DbContextService } from 'src/infra/application-db/db-context';
import { FILE_CROP_JOB, QueueName } from 'src/infra/queue/queue.constants';
import { FileRepository } from './file.repo';
import { FileStorageService } from './file.storage.service';
import { InjectStorageAdapter, StorageAdapter } from './plugins/adapter';
import { LocalStorage } from './plugins/local';
import { getExtensionPreview, parseDurationSeconds } from './file.util';
import { FilePurpose, IAttachmentEntity, INotifyResult, IPresignRes } from './file.interface';

interface ISignatureInput {
  purpose: FilePurpose;
  contentType: string;
  contentLength: number;
  hash?: string;
  internal?: boolean;
}

@Injectable()
export class FileService {
  constructor(
    private readonly repo: FileRepository,
    private readonly storage: FileStorageService,
    @InjectStorageAdapter() private readonly adapter: StorageAdapter,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectQueue(QueueName.FILE_CROP) private readonly cropQueue: Queue,
    private readonly dbContext: DbContextService,
  ) {}

  async signature(input: ISignatureInput, ctx: IDBConfigOptions): Promise<IPresignRes> {
    if (input.contentLength > env.FILE_MAX_UPLOAD_SIZE) {
      AppException.throw('FILE_TOO_LARGE', `Max upload size is ${env.FILE_MAX_UPLOAD_SIZE} bytes`);
    }
    const bucket = StorageAdapter.getBucket(input.purpose);
    const dir = StorageAdapter.getDir(input.purpose);
    const res = await this.adapter.presigned(bucket, dir, {
      contentType: input.contentType,
      contentLength: input.contentLength,
      hash: input.hash,
      internal: input.internal,
    });
    const ttl = parseDurationSeconds(env.FILE_TOKEN_EXPIRE_IN) * 1000;
    await this.cache.set(
      cacheKey.fileSig(ctx.schema_id, res.token),
      { path: res.path, bucket, hash: input.hash, purpose: input.purpose },
      ttl,
    );
    if (env.FILE_STORAGE_PROVIDER === 'local') {
      await this.cache.set(
        cacheKey.fileLocalSig(ctx.schema_id, res.token),
        { contentLength: input.contentLength, contentType: input.contentType },
        ttl,
      );
    }
    return res;
  }

  async uploadLocal(req: Request, token: string): Promise<void> {
    const ctx = this.dbContext.system();
    const sig = await this.cache.get<{ path: string; bucket: string }>(cacheKey.fileSig(ctx.schema_id, token));
    if (!sig) AppException.throw('FILE_TOKEN_INVALID', 'Unknown upload token');
    const local = this.adapter as LocalStorage;
    const file = await local.saveTemporaryFile(req);
    const expected = await this.cache.get<{ contentLength?: number; contentType?: string }>(
      cacheKey.fileLocalSig(ctx.schema_id, token),
    );
    local.validateUpload(file, expected ?? {});
    const { hash } = await local.uploadFileWithPath(sig.bucket, sig.path, file.path);
    await this.cache.set(
      cacheKey.fileUpload(ctx.schema_id, token),
      { mimetype: file.mimetype, hash, size: file.size },
      parseDurationSeconds(env.FILE_TOKEN_EXPIRE_IN) * 1000,
    );
  }

  async notify(token: string, ctx: IDBConfigOptions, filename?: string): Promise<INotifyResult> {
    const sig = await this.cache.get<{ path: string; bucket: string; purpose: FilePurpose }>(
      cacheKey.fileSig(ctx.schema_id, token),
    );
    if (!sig) AppException.throw('FILE_TOKEN_INVALID', 'Unknown token');
    const hint =
      env.FILE_STORAGE_PROVIDER === 'local'
        ? await this.cache.get<{ mimetype: string; hash: string; size: number }>(cacheKey.fileUpload(ctx.schema_id, token))
        : undefined;
    if (env.FILE_STORAGE_PROVIDER === 'local' && !hint) {
      AppException.throw('FILE_TOKEN_INVALID', 'Upload not completed');
    }
    const meta = await this.adapter.getObjectMeta(sig.bucket, sig.path, hint);
    const row = await this.repo.create(
      {
        token,
        bucket: sig.bucket,
        path: sig.path,
        hash: meta.hash,
        size: meta.size,
        mimetype: meta.mimetype,
        width: meta.width ?? null,
        height: meta.height ?? null,
        purpose: sig.purpose,
        createdByPersonId: ctx.user_id,
      },
      ctx,
    );
    await this.cropQueue.add(FILE_CROP_JOB, {
      bucket: sig.bucket,
      token,
      path: sig.path,
      mimetype: meta.mimetype,
      height: meta.height ?? null,
      userId: ctx.user_id,
    });
    const filenameHeader = filename
      ? { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` }
      : {};
    const presignedUrl = await this.storage.getPreviewUrlByPath(
      ctx.schema_id, sig.bucket, sig.path, token, undefined,
      { 'Content-Type': meta.mimetype, ...filenameHeader },
    );
    return {
      token, slug: row.slug, path: sig.path, size: meta.size, mimetype: meta.mimetype,
      width: meta.width ?? null, height: meta.height ?? null, url: meta.url, presignedUrl,
    };
  }

  async readLocalFile(path: string, token?: string): Promise<{ fileStream: NodeJS.ReadableStream; headers: Record<string, string> }> {
    const local = this.adapter as LocalStorage;
    const { bucket } = local.parsePath(path);
    let headers: Record<string, string> = {};
    if (token && !StorageAdapter.isPublicBucket(bucket)) {
      headers = (local.verifyReadToken(token).respHeaders as Record<string, string>) ?? {};
    } else {
      const att = await this.repo.findByToken(local.parsePath(path).token, this.dbContext.system());
      if (!att) AppException.throw('FILE_TOKEN_INVALID', 'Invalid path');
      headers['Content-Type'] = getExtensionPreview(att.mimetype);
    }
    headers['Cross-Origin-Resource-Policy'] = 'unsafe-none';
    return { fileStream: local.read(path), headers };
  }

  localConditionalCaching(path: string, reqHeaders: IncomingHttpHeaders, res: Response): boolean {
    const local = this.adapter as LocalStorage;
    const lastModified = local.getLastModifiedTime(path);
    if (!lastModified) AppException.throw('FILE_TOKEN_INVALID', 'Attachment not found');
    const ifModifiedSince = reqHeaders['if-modified-since'];
    if (!ifModifiedSince || Math.floor(new Date(ifModifiedSince).getTime() / 1000) < Math.floor(lastModified / 1000)) {
      res.set('Last-Modified', new Date(lastModified).toUTCString());
      return false;
    }
    return true;
  }

  async requireBySlugAuthorized(slug: string, ctx: IDBConfigOptions, ability: AppAbility): Promise<IAttachmentEntity> {
    const row = await this.repo.findBySlug(slug, ctx);
    if (!row) AppException.notFound('Attachment', slug);
    assertAbility(ability, 'read', 'Attachment', row!, 'You cannot view this attachment');
    return row!;
  }

  async getLink(slug: string, ctx: IDBConfigOptions, ability: AppAbility): Promise<string> {
    const row = await this.requireBySlugAuthorized(slug, ctx, ability);
    return this.storage.getPreviewUrlByPath(ctx.schema_id, row.bucket, row.path, row.token, undefined, {
      'Content-Type': row.mimetype,
    });
  }

  async remove(slug: string, ctx: IDBConfigOptions, ability: AppAbility): Promise<void> {
    const row = await this.repo.findBySlug(slug, ctx);
    if (!row) AppException.notFound('Attachment', slug);
    assertAbility(ability, 'delete', 'Attachment', row!, 'You cannot delete this attachment');
    await this.adapter.deleteFile(row!.bucket, row!.path);
    await this.repo.delete(row!.id, ctx);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/modules/module-file-management/file.service.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/module-file-management/file.service.ts src/modules/module-file-management/file.service.spec.ts
git commit -m "feat(file-management): FileService upload/notify/link/delete orchestration"
```

---

### Task 9: FileCropProcessor (image thumbnails)

**Files:**
- Create: `src/modules/module-file-management/file.crop.processor.ts`
- Test: `src/modules/module-file-management/file.crop.processor.spec.ts`

**Interfaces:**
- Consumes: `BaseProcessor` (`src/infra/queue/base.processor`), `@Processor`, `Job`, `QueueName.FILE_CROP` (Task 2), `FileRepository` (Task 6), `FileStorageService` (Task 7), `DbContextService`, `isImage` (Task 2).
- Produces: `class FileCropProcessor extends BaseProcessor` with `handle(job: Job<IFileCropJob>): Promise<void>`. `IFileCropJob = { bucket; token; path; mimetype; height?: number | null; userId: number }`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/module-file-management/file.crop.processor.spec.ts`:
```ts
import { FileCropProcessor } from './file.crop.processor';

const job = (data: any) => ({ data, queueName: 'file-crop', id: '1', name: 'crop_image', attemptsMade: 0 }) as any;

describe('FileCropProcessor', () => {
  let repo: any; let storage: any; let dbContext: any; let proc: FileCropProcessor;

  beforeEach(() => {
    repo = { findByToken: jest.fn(), setThumbnailPath: jest.fn() };
    storage = { cropImageThumbnails: jest.fn(async () => ({ sm: 's', lg: 'l' })) };
    dbContext = { forUser: jest.fn(() => ({ schema_id: 'public', user_id: 1 })) };
    proc = new FileCropProcessor(repo, storage, dbContext);
  });

  it('skips when the attachment already has a thumbnail', async () => {
    repo.findByToken.mockResolvedValue({ thumbnailPath: 'x' });
    await proc.handle(job({ bucket: 'private', token: 't', path: 'p', mimetype: 'image/png', height: 100, userId: 1 }));
    expect(storage.cropImageThumbnails).not.toHaveBeenCalled();
  });

  it('crops images and persists thumbnailPath JSON', async () => {
    repo.findByToken.mockResolvedValue({ thumbnailPath: null });
    await proc.handle(job({ bucket: 'private', token: 't', path: 'p', mimetype: 'image/png', height: 100, userId: 1 }));
    expect(storage.cropImageThumbnails).toHaveBeenCalledWith('private', 'p', 100);
    expect(repo.setThumbnailPath).toHaveBeenCalledWith('t', JSON.stringify({ sm: 's', lg: 'l' }), expect.anything());
  });

  it('no-ops on non-image types', async () => {
    repo.findByToken.mockResolvedValue({ thumbnailPath: null });
    await proc.handle(job({ bucket: 'private', token: 't', path: 'p', mimetype: 'application/pdf', height: 100, userId: 1 }));
    expect(storage.cropImageThumbnails).not.toHaveBeenCalled();
    expect(repo.setThumbnailPath).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/modules/module-file-management/file.crop.processor.spec.ts`
Expected: FAIL — `Cannot find module './file.crop.processor'`.

- [ ] **Step 3: Implement the processor**

Create `src/modules/module-file-management/file.crop.processor.ts`:
```ts
import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from 'src/infra/queue/base.processor';
import { QueueName } from 'src/infra/queue/queue.constants';
import { DbContextService } from 'src/infra/application-db/db-context';
import { FileRepository } from './file.repo';
import { FileStorageService } from './file.storage.service';
import { isImage } from './file.util';

export interface IFileCropJob {
  bucket: string;
  token: string;
  path: string;
  mimetype: string;
  height?: number | null;
  userId: number;
}

@Processor(QueueName.FILE_CROP)
export class FileCropProcessor extends BaseProcessor {
  constructor(
    private readonly repo: FileRepository,
    private readonly storage: FileStorageService,
    private readonly dbContext: DbContextService,
  ) {
    super();
  }

  async handle(job: Job<IFileCropJob>): Promise<void> {
    const { bucket, token, path, mimetype, height, userId } = job.data;
    const ctx = this.dbContext.forUser(userId);

    const existing = await this.repo.findByToken(token, ctx);
    if (!existing) {
      this.logger.warn(`crop: attachment ${token} not found`);
      return;
    }
    if (existing.thumbnailPath) return;

    // v1: images only. PDF first-page rendering is a documented follow-up
    // (needs a native canvas dep); non-image types are intentionally skipped.
    if (!isImage(mimetype) || !height) {
      this.logger.debug(`crop: ${token} (${mimetype}) not eligible for thumbnails`);
      return;
    }

    const { sm, lg } = await this.storage.cropImageThumbnails(bucket, path, height);
    await this.repo.setThumbnailPath(token, JSON.stringify({ sm, lg }), ctx);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/modules/module-file-management/file.crop.processor.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/module-file-management/file.crop.processor.ts src/modules/module-file-management/file.crop.processor.spec.ts
git commit -m "feat(file-management): image thumbnail crop processor"
```

---

### Task 10: CASL `Attachment` subject + grants

**Files:**
- Modify: `src/common/casl/ability.types.ts` (add `'Attachment'`)
- Modify: `src/common/casl/ability.factory.ts` (grant rules)
- Test: `src/common/casl/ability.factory.spec.ts` (add cases)

**Interfaces:**
- Produces: `'Attachment'` in `AppSubjectName`; member/manager can `create Attachment` and `read`/`delete` own (`{ createdByPersonId: user.id }`); admin manage all; executive read all.

- [ ] **Step 1: Add the failing CASL cases**

In `src/common/casl/ability.factory.spec.ts`, add inside `describe('defineAbilityFor', ...)`:
```ts
  it('member can create attachments and manage only their own', () => {
    const a = defineAbilityFor(user({ id: 7, role: 'member' }));
    expect(a.can('create', 'Attachment')).toBe(true);
    expect(a.can('read', subject('Attachment', { createdByPersonId: 7 }))).toBe(true);
    expect(a.can('delete', subject('Attachment', { createdByPersonId: 8 }))).toBe(false);
  });

  it('executive can read attachments but not create', () => {
    const a = defineAbilityFor(user({ role: 'executive' }));
    expect(a.can('read', 'Attachment')).toBe(true);
    expect(a.can('create', 'Attachment')).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/common/casl/ability.factory.spec.ts`
Expected: FAIL — member `create Attachment` is `false` (not yet granted).

- [ ] **Step 3: Add the subject**

In `src/common/casl/ability.types.ts`, add `'Attachment'` to the `AppSubjectName` union (after `'Label'`):
```ts
  | 'Label'
  | 'Attachment'
```

- [ ] **Step 4: Grant the rules**

In `src/common/casl/ability.factory.ts`, add to the `manager` case (before `break;`):
```ts
      can('create', 'Attachment');
      can(['read', 'delete'], 'Attachment', { createdByPersonId: user.id });
```
And to the `member` case (before `break;`):
```ts
      can('create', 'Attachment');
      can(['read', 'delete'], 'Attachment', { createdByPersonId: user.id });
```
(`admin` already has `manage all`; `executive` already has `read all`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/common/casl/ability.factory.spec.ts`
Expected: PASS (all prior cases + 2 new).

- [ ] **Step 6: Commit**

```bash
git add src/common/casl/ability.types.ts src/common/casl/ability.factory.ts src/common/casl/ability.factory.spec.ts
git commit -m "feat(file-management): add Attachment CASL subject and grants"
```

---

### Task 11: Factory, DTOs, controller, module wiring & integration test

**Files:**
- Create: `src/modules/module-file-management/plugins/storage.provider.ts`
- Create: `src/modules/module-file-management/file.dto.ts`
- Create: `src/modules/module-file-management/file.controller.ts`
- Create: `src/modules/module-file-management/file.module.ts`
- Modify: `src/modules/main.module.ts` (import `FileManagementModule`)
- Test: `src/modules/module-file-management/file.integration.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–10.
- Produces: `storageAdapterProvider` (binds `STORAGE_ADAPTER`); `SignatureDTO`, `FindBySlugDTO`; `FileController`; `FileManagementModule` (exports `FileService`, `FileStorageService`).

- [ ] **Step 1: Create the DI factory**

Create `src/modules/module-file-management/plugins/storage.provider.ts`:
```ts
import type { Provider } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import env from 'src/utils/env';
import { STORAGE_ADAPTER } from './adapter';
import { LocalStorage } from './local';
import { MinioStorage } from './minio';

export const storageAdapterProvider: Provider = {
  provide: STORAGE_ADAPTER,
  useFactory: () => {
    Logger.log(`[Storage provider]: ${env.FILE_STORAGE_PROVIDER}`, 'FileManagement');
    return env.FILE_STORAGE_PROVIDER === 'minio' ? new MinioStorage() : new LocalStorage();
  },
};
```

- [ ] **Step 2: Create the DTOs**

Create `src/modules/module-file-management/file.dto.ts`:
```ts
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { FilePurpose } from './file.interface';

export class SignatureDTO {
  @ApiProperty({ enum: FilePurpose }) @IsEnum(FilePurpose) purpose!: FilePurpose;
  @ApiProperty() @IsString() contentType!: string;
  @ApiProperty() @IsInt() @Min(1) @Type(() => Number) contentLength!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() hash?: string;
}

export class FindBySlugDTO {
  @ApiProperty() @IsString() slug!: string;
}
```

- [ ] **Step 3: Create the controller**

Create `src/modules/module-file-management/file.controller.ts`:
```ts
import {
  Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res, StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { FileService } from './file.service';
import { SignatureDTO, FindBySlugDTO } from './file.dto';
import { IBaseResponse } from 'src/utils/shared/interface';
import { buildOk, buildCreated } from 'src/utils/shared/response.factory';
import { CheckPolicies } from 'src/common/casl/policy.types';
import { CurrentAbility } from 'src/common/casl/current-ability.decorator';
import { AppAbility } from 'src/common/casl/ability.types';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { IUserSession } from 'src/modules/module-auth/current-user-module/session.interface';
import { DbContextService } from 'src/infra/application-db/db-context';

@ApiTags('files')
@Controller('files')
export class FileController {
  constructor(
    private readonly fileService: FileService,
    private readonly ctx: DbContextService,
  ) {}

  @Post('signature')
  @CheckPolicies((a) => a.can('create', 'Attachment'))
  @ApiOperation({ summary: 'Request a presigned upload URL' })
  async signature(@CurrentUser() user: IUserSession, @Body() dto: SignatureDTO): Promise<IBaseResponse> {
    const res = await this.fileService.signature(dto, this.ctx.forUser(user.id));
    return buildCreated(res, 'Signature created');
  }

  @Post('notify/:token')
  @CheckPolicies((a) => a.can('create', 'Attachment'))
  @ApiOperation({ summary: 'Confirm upload complete and persist the attachment' })
  async notify(
    @CurrentUser() user: IUserSession,
    @Param('token') token: string,
    @Query('filename') filename?: string,
  ): Promise<IBaseResponse> {
    const res = await this.fileService.notify(token, this.ctx.forUser(user.id), filename);
    return buildCreated(res, 'Attachment created');
  }

  @Public()
  @Put('upload/:token')
  @ApiOperation({ summary: 'Local upload target (PUT)' })
  async uploadPut(@Req() req: Request, @Param('token') token: string): Promise<IBaseResponse> {
    await this.fileService.uploadLocal(req, token);
    return buildOk(null, 'Uploaded');
  }

  @Public()
  @Post('upload/:token')
  @ApiOperation({ summary: 'Local upload target (POST)' })
  async uploadPost(@Req() req: Request, @Param('token') token: string): Promise<IBaseResponse> {
    await this.fileService.uploadLocal(req, token);
    return buildOk(null, 'Uploaded');
  }

  @Public()
  @Get('read/:path(*)')
  @ApiOperation({ summary: 'Serve a local file' })
  async read(
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
    @Param('path') path: string,
    @Query('token') token?: string,
  ): Promise<StreamableFile | void> {
    if (this.fileService.localConditionalCaching(path, req.headers, res)) {
      res.status(304);
      return;
    }
    const { fileStream, headers } = await this.fileService.readLocalFile(path, token);
    res.set(headers);
    return new StreamableFile(fileStream);
  }

  @Get(':slug/link')
  @CheckPolicies((a) => a.can('read', 'Attachment'))
  @ApiOperation({ summary: 'Get a signed preview/download link' })
  async link(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindBySlugDTO,
  ): Promise<IBaseResponse> {
    const url = await this.fileService.getLink(params.slug, this.ctx.forUser(user.id), ability);
    return buildOk({ url }, 'Link generated');
  }

  @Get(':slug')
  @CheckPolicies((a) => a.can('read', 'Attachment'))
  @ApiOperation({ summary: 'Get attachment metadata' })
  async getBySlug(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindBySlugDTO,
  ): Promise<IBaseResponse> {
    const row = await this.fileService.requireBySlugAuthorized(params.slug, this.ctx.forUser(user.id), ability);
    return buildOk(row, 'Attachment found');
  }

  @Delete(':slug')
  @CheckPolicies((a) => a.can('delete', 'Attachment'))
  @ApiOperation({ summary: 'Delete an attachment' })
  async remove(
    @CurrentUser() user: IUserSession,
    @CurrentAbility() ability: AppAbility,
    @Param() params: FindBySlugDTO,
  ): Promise<IBaseResponse> {
    await this.fileService.remove(params.slug, this.ctx.forUser(user.id), ability);
    return buildOk(null, 'Attachment deleted');
  }
}
```

- [ ] **Step 4: Create the module**

Create `src/modules/module-file-management/file.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from 'src/infra/queue/queue.constants';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { FileStorageService } from './file.storage.service';
import { FileRepository } from './file.repo';
import { FileCropProcessor } from './file.crop.processor';
import { storageAdapterProvider } from './plugins/storage.provider';

@Module({
  imports: [BullModule.registerQueue({ name: QueueName.FILE_CROP })],
  controllers: [FileController],
  providers: [FileRepository, FileService, FileStorageService, FileCropProcessor, storageAdapterProvider],
  exports: [FileService, FileStorageService],
})
export class FileManagementModule {}
```

- [ ] **Step 5: Wire into MainModule**

In `src/modules/main.module.ts`: add the import and list it in `imports`:
```ts
import { FileManagementModule } from './module-file-management/file.module';
```
Add `FileManagementModule,` to the `imports: [...]` array (after `TaskModule,`).

- [ ] **Step 6: Write the integration test** (local provider, real DB, mocked cache + queue)

Create `src/modules/module-file-management/file.integration.spec.ts`:
```ts
import 'dotenv/config';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getQueueToken } from '@nestjs/bullmq';
import { useTestSchema } from '../../../test/db-setup';
import { ApplicationDbModule } from 'src/infra/application-db/application-db.module';
import { QueueName } from 'src/infra/queue/queue.constants';
import { FileService } from './file.service';
import { FileStorageService } from './file.storage.service';
import { FileRepository } from './file.repo';
import { FilePurpose } from './file.interface';
import { STORAGE_ADAPTER } from './plugins/adapter';
import { LocalStorage } from './plugins/local';

describe('FileManagement (local provider integration)', () => {
  const { getCtx } = useTestSchema();
  const storageDir = mkdtempSync(join(tmpdir(), 'cyb-int-'));
  let service: FileService;
  let repo: FileRepository;
  let local: LocalStorage;
  const store = new Map<string, unknown>();
  const cache = {
    get: async (k: string) => store.get(k),
    set: async (k: string, v: unknown) => void store.set(k, v),
    del: async (k: string) => void store.delete(k),
  };

  beforeAll(async () => {
    // Bespoke provider set (not FileManagementModule) so we exercise the real
    // DB + local adapter without standing up the BullMQ worker / Redis.
    const moduleRef = await Test.createTestingModule({
      imports: [ApplicationDbModule],
      providers: [
        FileRepository,
        FileStorageService,
        FileService,
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: STORAGE_ADAPTER, useValue: new LocalStorage(storageDir, 'integration-secret') },
        { provide: getQueueToken(QueueName.FILE_CROP), useValue: { add: jest.fn() } },
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(FileService);
    repo = moduleRef.get(FileRepository);
    local = moduleRef.get(STORAGE_ADAPTER);
  }, 30_000);

  it('signature → place file → notify creates a row and a read link', async () => {
    const ctx = getCtx();
    // signature() and notify() both use the passed ctx (test schema); only the
    // @Public upload route uses dbContext.system(), which is why we drive notify directly here.
    const sig = await service.signature(
      { purpose: FilePurpose.General, contentType: 'text/plain', contentLength: 5 },
      ctx,
    );
    // simulate the client PUT: place the bytes where the adapter expects them
    await local.uploadFileWithPath('private', sig.path, writeTemp('hello'));
    // signature() already cached file:sig under ctx.schema_id; seed the upload
    // cache the way uploadLocal would (the @Public upload route is covered separately)
    store.set(`cyb:${ctx.schema_id}:file:upload:${sig.token}`, { mimetype: 'text/plain', hash: 'h', size: 5 });

    const res = await service.notify(sig.token, ctx);
    expect(res.presignedUrl).toContain('/api/files/read/');

    const row = await repo.findByToken(sig.token, ctx);
    expect(row).not.toBeNull();
    expect(row!.bucket).toBe('private');
  });
});

function writeTemp(content: string): string {
  const p = join(mkdtempSync(join(tmpdir(), 'cyb-src-')), 'f');
  writeFileSync(p, content);
  return p;
}
```
(The cache seeding mirrors what the `@Public` `uploadLocal` route writes; the test focuses on the `signature → notify → persisted row → read link` path against the real DB + local adapter. `FileManagementModule`'s own wiring is covered by `npm run build` + app boot in Step 8/10.)

- [ ] **Step 7: Run the integration test**

Run: `npx jest src/modules/module-file-management/file.integration.spec.ts`
Expected: PASS (1 test).

- [ ] **Step 8: Run the full module suite + build**

Run: `npx jest src/modules/module-file-management && npm run build`
Expected: all module specs green; build clean.

- [ ] **Step 9: Commit**

```bash
git add src/modules/module-file-management/plugins/storage.provider.ts src/modules/module-file-management/file.dto.ts src/modules/module-file-management/file.controller.ts src/modules/module-file-management/file.module.ts src/modules/main.module.ts src/modules/module-file-management/file.integration.spec.ts
git commit -m "feat(file-management): controller, DI factory, module wiring, integration test"
```

- [ ] **Step 10: Final full-suite check**

Run: `npm test && npm run build`
Expected: entire backend suite green, build clean. The file-management module is complete.

---

## Future / deferred (not in this plan)

- **PDF first-page thumbnails** — needs a rasterizer (e.g. `pdfjs-dist` + `@napi-rs/canvas`); the crop processor already no-ops on non-image types, so this slots in as a new branch + helper.
- New `FilePurpose` values with real consumers (e.g. `avatar`).
- Generic `attachment_link` table for entity ↔ file many-to-many links.
- Multi-tenant storage path prefixing by `schema_id`.
- Server-side multipart upload and upload-from-URL.

## Notes on env / local dev

- Local-dev MinIO (already documented in gitignored `backend/.env`): host port `30900` → container `9000`, user `minioadmin`. To exercise MinIO instead of local, set in `.env`: `FILE_STORAGE_PROVIDER=minio`, `MINIO_ENDPOINT=localhost`, `MINIO_PORT=30900`, `MINIO_ACCESS_KEY=minioadmin`, `MINIO_SECRET_KEY=<secret>`, and create the `private`/`public` buckets in MinIO.
