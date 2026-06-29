# Email Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable email-sending module (`module-email`) — SMTP transport, Handlebars templates, async BullMQ delivery, no-config dev-log mode, per-recipient rate limiting, typed transactional send methods, and an admin test-transport endpoint.

**Architecture:** A NestJS feature module at `src/modules/module-email/`. `@nestjs-modules/mailer` (Handlebars adapter) renders one `normal` page that dynamically includes a body partial selected by a `partialBody` context key. `EmailService` rate-limits then enqueues an `EMAIL` BullMQ job; `EmailProcessor` (extends the repo's `BaseProcessor`) calls `MailerService.sendMail`. When SMTP env is absent, a Nodemailer `jsonTransport` no-op is used and the email is logged, not sent. The admin test endpoint sends synchronously for immediate feedback.

**Tech Stack:** NestJS 10, `@nestjs-modules/mailer@1.11.2`, `nodemailer@6.9.13`, `handlebars@4.7.8`, `@nestjs/bullmq` (BullMQ), `@nestjs/cache-manager` (cache-manager v5), `class-validator`, Jest, Yarn workspaces, TypeScript 5.7.

## Global Constraints

- **Branch:** `feat-email-module` (already created off `dev`).
- **Spec:** `docs/superpowers/specs/2026-06-30-email-module-design.md` — every task implements part of it.
- **TypeScript module interop:** `esModuleInterop` is NOT enabled (only `allowSyntheticDefaultImports`). Do **not** default-import CommonJS modules. Use named/namespace imports: `import { join } from 'path'`, `import { createTransport } from 'nodemailer'`.
- **Dependencies via Yarn workspace only** (root `../yarn.lock`, workspaces `["backend","frontend"]`). Never `npm install`. Pin the versions in Task 1.
- **Git discipline:** explicit `git add <paths>` only — never `git add -A`/`git add .`. No destructive git (`reset`/`checkout <ref>`/`clean`/`stash`/`rebase`). No `Co-Authored-By` trailer.
- **No Redis in tests:** never import the full `EmailModule` in a `*.spec.ts` (it registers the BullMQ queue → needs Redis). Construct providers directly with mocks, or import `MailerModule` only via the exported `mailerOptionsFactory()`.
- **`EMAIL` is an event-driven queue:** do NOT add it to `SCHEDULED_JOBS` or `ScheduleRegistrar` (mirrors `FILE_CROP`). The registrar only iterates cron jobs, so adding the enum value is safe.
- **Conventions:** `AppException.throw(code, msg)` for errors; `buildOk`/`buildCreated` response envelopes; `class-validator` DTOs with `@ApiProperty`; services take `ctx: IDBConfigOptions` (from `src/infra/application-db/application-db.module`) and use `ctx.schema_id` for tenant-scoped cache keys; processors extend `BaseProcessor`.
- **File size:** keep every file under 500 lines.
- Run all commands from `backend/`. Test runner: `npx jest <path>`. Build: `npm run build` (runs `nest build`).

---

### Task 1: Dependencies, env vars, queue/cache/error constants, nest-cli assets

**Files:**
- Modify: `backend/package.json` (add deps)
- Modify: `backend/src/utils/env.ts` (add `MAIL_*` + `PUBLIC_ORIGIN`)
- Modify: `backend/src/infra/queue/queue.constants.ts` (add `EMAIL` + `SEND_EMAIL_JOB`)
- Modify: `backend/src/infra/cache/cache.constants.ts` (add `mailRate`)
- Modify: `backend/src/utils/exception.provider.ts` (add 3 error codes)
- Modify: `backend/nest-cli.json` (add template asset copy)
- Test: `backend/src/infra/cache/cache.constants.spec.ts`

**Interfaces:**
- Produces: env keys `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_AUTH_USER`, `MAIL_AUTH_PASS`, `MAIL_SENDER`, `MAIL_SENDER_NAME`, `MAIL_CONNECTION_TIMEOUT`, `MAIL_GREETING_TIMEOUT`, `MAIL_DNS_TIMEOUT`, `MAIL_RATE_LIMIT_SECONDS`, `PUBLIC_ORIGIN`; `QueueName.EMAIL`; `SEND_EMAIL_JOB`; `cacheKey.mailRate(schema, purpose, email)`; error codes `EMAIL_SEND_FAILED`, `MAIL_TRANSPORT_INVALID`, `MAIL_RATE_LIMITED`.

- [ ] **Step 1: Install dependencies (Yarn workspace)**

Run from `backend/`:
```bash
yarn add @nestjs-modules/mailer@1.11.2 nodemailer@6.9.13 handlebars@4.7.8
yarn add -D @types/nodemailer@6.4.14
```
Expected: deps added to `backend/package.json`, root `../yarn.lock` updated, no peer-dependency errors (`@nestjs-modules/mailer@1.11.2` peers on `@nestjs/common ^8||^9||^10`; repo is `^10.4.19`).

- [ ] **Step 2: Add env vars**

In `backend/src/utils/env.ts`, add inside `z.object({ ... })` immediately before the closing `})` (after the `MINIO_INTERNAL_PORT` line):
```ts
  // email / mail-sender
  MAIL_HOST: z.string().optional(),
  MAIL_PORT: z.coerce.number().default(465),
  MAIL_SECURE: z.string().transform((v) => v === 'true').default('true'),
  MAIL_AUTH_USER: z.string().optional(),
  MAIL_AUTH_PASS: z.string().optional(),
  MAIL_SENDER: z.string().default('noreply@cybernetic.local'),
  MAIL_SENDER_NAME: z.string().default('Cybernetic'),
  MAIL_CONNECTION_TIMEOUT: z.coerce.number().default(10000),
  MAIL_GREETING_TIMEOUT: z.coerce.number().default(10000),
  MAIL_DNS_TIMEOUT: z.coerce.number().default(5000),
  MAIL_RATE_LIMIT_SECONDS: z.coerce.number().default(60),
  PUBLIC_ORIGIN: z.string().default('http://localhost:3000'),
```

- [ ] **Step 3: Add queue constants**

In `backend/src/infra/queue/queue.constants.ts`, extend the enum and add a job-name const (place after `FILE_CROP_JOB`):
```ts
export enum QueueName {
  EXAMPLE = 'example',
  FILE_CROP = 'file-crop',
  EMAIL = 'email',
}

export const FILE_CROP_JOB = 'crop_image';
export const SEND_EMAIL_JOB = 'send_email';
```
(Leave `DEFAULT_JOB_OPTIONS` unchanged. Do NOT touch `schedule.config.ts` / `ScheduleRegistrar` — `EMAIL` is event-driven.)

- [ ] **Step 4: Add cache key helper**

In `backend/src/infra/cache/cache.constants.ts`, add inside the `cacheKey` object (after `filePreview`):
```ts
  mailRate: (schema: string, purpose: string, email: string) => `cyb:${schema}:mail:rate:${purpose}:${email}`,
```

- [ ] **Step 5: Add error codes**

In `backend/src/utils/exception.provider.ts`, add to `ERROR_CATALOG` (after `STORAGE_OPERATION_FAILED`):
```ts
  EMAIL_SEND_FAILED:        { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Email send operation failed' },
  MAIL_TRANSPORT_INVALID:   { status: HttpStatus.BAD_REQUEST,            message: 'Invalid mail transport configuration' },
  MAIL_RATE_LIMITED:        { status: HttpStatus.TOO_MANY_REQUESTS,      message: 'Too many email requests; try again later' },
```

- [ ] **Step 6: Add nest-cli asset copy**

Replace the contents of `backend/nest-cli.json` with:
```json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "assets": [
      { "include": "modules/module-email/templates/**/*.hbs", "outDir": "dist", "watchAssets": true }
    ]
  }
}
```

- [ ] **Step 7: Write the failing test**

Create `backend/src/infra/cache/cache.constants.spec.ts`:
```ts
import { cacheKey } from './cache.constants';
import { QueueName, SEND_EMAIL_JOB } from '../queue/queue.constants';

describe('email infra constants', () => {
  it('cacheKey.mailRate is tenant + purpose + email scoped', () => {
    expect(cacheKey.mailRate('public', 'signup', 'a@b.com')).toBe('cyb:public:mail:rate:signup:a@b.com');
  });

  it('EMAIL queue and send-email job name exist', () => {
    expect(QueueName.EMAIL).toBe('email');
    expect(SEND_EMAIL_JOB).toBe('send_email');
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npx jest src/infra/cache/cache.constants.spec.ts`
Expected: FAIL — `cacheKey.mailRate is not a function` (until Step 4 is saved) or compile error on `QueueName.EMAIL`. (If steps 3–4 were saved first, it passes — that is acceptable; the point is the assertions exist.)

- [ ] **Step 9: Run test to verify it passes**

Run: `npx jest src/infra/cache/cache.constants.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 10: Verify build**

Run: `npm run build`
Expected: exit 0, no TypeScript errors.

- [ ] **Step 11: Commit**

Run from `backend/` (paths are relative to `backend/`; the root lockfile is `../yarn.lock`):
```bash
git add package.json ../yarn.lock src/utils/env.ts src/infra/queue/queue.constants.ts src/infra/cache/cache.constants.ts src/utils/exception.provider.ts nest-cli.json src/infra/cache/cache.constants.spec.ts
git commit -m "feat(email): deps, env, queue/cache/error constants, template assets"
```
Verify with `git status` that `../yarn.lock` is staged.

---

### Task 2: Mail helpers + interfaces

**Files:**
- Create: `backend/src/modules/module-email/email.interface.ts`
- Create: `backend/src/modules/module-email/mail.helpers.ts`
- Test: `backend/src/modules/module-email/mail.helpers.spec.ts`

**Interfaces:**
- Consumes: `AppException` from `src/utils/exception.provider`.
- Produces:
  - `email.interface.ts`: `IEmailJob`, `ISendPayload`, `IVerificationCodePayload`, `IPasswordResetPayload`, `IChangeEmailPayload`.
  - `mail.helpers.ts`: `buildEmailFrom(sender, senderName?)`, `verifyTransport(config)`, `createNoOpTransport()`, `hbsHelpers(publicOrigin)`, `isMailConfigured(host?, user?, pass?)`, `buildSmtpOptions(env)`, `ISmtpEnv`.

- [ ] **Step 1: Create the interfaces**

Create `backend/src/modules/module-email/email.interface.ts`:
```ts
// The BullMQ job payload. Every email renders the `normal` page; `context.partialBody`
// selects the body partial. The processor sets `template: 'normal'` itself.
export interface IEmailJob {
  to: string;
  subject: string;
  context: Record<string, unknown>;
}

export interface ISendPayload {
  to: string;
  subject: string;
  partialBody: string;
  context?: Record<string, unknown>;
}

export interface IVerificationCodePayload {
  to: string;
  code: string;
  expiresMinutes: number;
}

export interface IPasswordResetPayload {
  to: string;
  resetLink: string;
  expiresMinutes: number;
}

export interface IChangeEmailPayload {
  to: string;
  code: string;
  expiresMinutes: number;
}
```

- [ ] **Step 2: Write the failing test**

Create `backend/src/modules/module-email/mail.helpers.spec.ts`:
```ts
const mockVerify = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ verify: mockVerify, jsonTransport: true })),
}));

import { createTransport } from 'nodemailer';
import {
  buildEmailFrom, verifyTransport, createNoOpTransport, hbsHelpers,
  isMailConfigured, buildSmtpOptions,
} from './mail.helpers';

describe('mail.helpers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('buildEmailFrom formats name + address, or bare address', () => {
    expect(buildEmailFrom('a@b.com', 'Cyb')).toBe('Cyb <a@b.com>');
    expect(buildEmailFrom('a@b.com')).toBe('a@b.com');
  });

  it('isMailConfigured requires host, user and pass', () => {
    expect(isMailConfigured('h', 'u', 'p')).toBe(true);
    expect(isMailConfigured('h', undefined, 'p')).toBe(false);
    expect(isMailConfigured(undefined, undefined, undefined)).toBe(false);
  });

  it('buildSmtpOptions maps env to a nodemailer transport config', () => {
    const opts = buildSmtpOptions({
      MAIL_HOST: 'smtp.x', MAIL_PORT: 465, MAIL_SECURE: true,
      MAIL_AUTH_USER: 'u', MAIL_AUTH_PASS: 'p',
      MAIL_CONNECTION_TIMEOUT: 1, MAIL_GREETING_TIMEOUT: 2, MAIL_DNS_TIMEOUT: 3,
    });
    expect(opts).toEqual({
      host: 'smtp.x', port: 465, secure: true,
      auth: { user: 'u', pass: 'p' },
      connectionTimeout: 1, greetingTimeout: 2, dnsTimeout: 3,
    });
  });

  it('verifyTransport resolves when nodemailer verify succeeds', async () => {
    mockVerify.mockResolvedValue(true);
    await expect(verifyTransport({ host: 'h' })).resolves.toBe(true);
    expect(createTransport).toHaveBeenCalledWith({ host: 'h' });
  });

  it('verifyTransport throws MAIL_TRANSPORT_INVALID when verify fails', async () => {
    mockVerify.mockRejectedValue(new Error('ECONN'));
    await expect(verifyTransport({ host: 'h' })).rejects.toMatchObject({ code: 'MAIL_TRANSPORT_INVALID' });
  });

  it('createNoOpTransport returns a transport whose verify() resolves', async () => {
    const t = createNoOpTransport();
    await expect((t.verify as () => Promise<boolean>)()).resolves.toBe(true);
  });

  it('hbsHelpers expose publicOrigin and currentYear', () => {
    const h = hbsHelpers('https://app.test');
    expect(h.publicOrigin()).toBe('https://app.test');
    expect(typeof h.currentYear()).toBe('number');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/modules/module-email/mail.helpers.spec.ts`
Expected: FAIL — `Cannot find module './mail.helpers'`.

- [ ] **Step 4: Implement the helpers**

Create `backend/src/modules/module-email/mail.helpers.ts`:
```ts
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { AppException } from 'src/utils/exception.provider';

export interface ISmtpEnv {
  MAIL_HOST?: string;
  MAIL_PORT: number;
  MAIL_SECURE: boolean;
  MAIL_AUTH_USER?: string;
  MAIL_AUTH_PASS?: string;
  MAIL_CONNECTION_TIMEOUT: number;
  MAIL_GREETING_TIMEOUT: number;
  MAIL_DNS_TIMEOUT: number;
}

export function buildEmailFrom(sender: string, senderName?: string): string {
  return senderName ? `${senderName} <${sender}>` : sender;
}

export function isMailConfigured(host?: string, user?: string, pass?: string): boolean {
  return Boolean(host && user && pass);
}

export function buildSmtpOptions(e: ISmtpEnv) {
  return {
    host: e.MAIL_HOST,
    port: e.MAIL_PORT,
    secure: e.MAIL_SECURE,
    auth: { user: e.MAIL_AUTH_USER, pass: e.MAIL_AUTH_PASS },
    connectionTimeout: e.MAIL_CONNECTION_TIMEOUT,
    greetingTimeout: e.MAIL_GREETING_TIMEOUT,
    dnsTimeout: e.MAIL_DNS_TIMEOUT,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function verifyTransport(config: any): Promise<true> {
  const transporter = createTransport(config);
  try {
    await transporter.verify();
  } catch (error) {
    AppException.throw(
      'MAIL_TRANSPORT_INVALID',
      `Invalid mail transport: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
  return true;
}

/**
 * No-op transport for when SMTP is not configured. jsonTransport does not send;
 * its default verify() returns false, but @nestjs-modules/mailer calls verify().then()
 * unconditionally, so we patch verify() to resolve.
 */
export function createNoOpTransport(): Transporter {
  const transport = createTransport({ jsonTransport: true });
  const originalVerify = transport.verify.bind(transport);
  transport.verify = function (callback?: (err: Error | null, success: boolean) => void) {
    if (callback) return originalVerify(callback);
    return Promise.resolve(true);
  } as typeof transport.verify;
  return transport;
}

export function hbsHelpers(publicOrigin: string) {
  return {
    publicOrigin: () => publicOrigin,
    currentYear: () => new Date().getFullYear(),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/modules/module-email/mail.helpers.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 7: Commit**

Run from `backend/`:
```bash
git add src/modules/module-email/email.interface.ts src/modules/module-email/mail.helpers.ts src/modules/module-email/mail.helpers.spec.ts
git commit -m "feat(email): mail helpers (transport, no-op, hbs helpers) + interfaces"
```

---

### Task 3: Handlebars templates + EmailModule wiring + render integration test

**Files:**
- Create: `backend/src/modules/module-email/templates/pages/normal.hbs`
- Create: `backend/src/modules/module-email/templates/partials/header.hbs`
- Create: `backend/src/modules/module-email/templates/partials/footer.hbs`
- Create: `backend/src/modules/module-email/templates/partials/verify-code.hbs`
- Create: `backend/src/modules/module-email/templates/partials/change-email.hbs`
- Create: `backend/src/modules/module-email/templates/partials/reset-password.hbs`
- Create: `backend/src/modules/module-email/templates/partials/common-body.hbs`
- Create: `backend/src/modules/module-email/email.module.ts`
- Modify: `backend/src/modules/main.module.ts` (import `EmailModule`)
- Test: `backend/src/modules/module-email/email.template.spec.ts`

**Interfaces:**
- Consumes: `buildEmailFrom`, `hbsHelpers`, `isMailConfigured`, `buildSmtpOptions`, `createNoOpTransport` from `./mail.helpers`; `QueueName.EMAIL` from queue constants; `env`.
- Produces: `EmailModule` class; `mailerOptionsFactory(): MailerOptions` (exported for tests). At this stage `EmailModule` provides nothing yet except the mailer + queue registration — `EmailService`/`EmailProcessor`/`EmailController` are added in Tasks 4–6.

- [ ] **Step 1: Create the page layout**

Create `backend/src/modules/module-email/templates/pages/normal.hbs`:
```hbs
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style type="text/css">
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f7f7f7; }
    .email-container { min-width: 320px; max-width: 600px; margin: auto; }
    .button:hover { background-color: #20aa5c !important; }
    .code-box { font-size: 28px; letter-spacing: 6px; font-weight: bold; background: #f3f3f3; padding: 16px 24px; border-radius: 8px; display: inline-block; }
  </style>
</head>
<body style="background-color:#f7f7f7;margin:0;padding:0;">
  <table width="100%" bgcolor="#f7f7f7" border="0" cellpadding="0" cellspacing="0">
    <tr><td>
      <table align="center" class="email-container" bgcolor="#ffffff"
        style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.05);"
        border="0" cellpadding="0" cellspacing="0">
        {{> header }}
        {{> (lookup . 'partialBody') }}
        {{> footer }}
      </table>
    </td></tr>
  </table>
</body>
</html>
```

- [ ] **Step 2: Create the header/footer partials**

Create `backend/src/modules/module-email/templates/partials/header.hbs`:
```hbs
<tr>
  <td style="background:linear-gradient(135deg,#7b4397,#dc2430);padding:24px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:22px;">{{brandName}}</h1>
  </td>
</tr>
```

Create `backend/src/modules/module-email/templates/partials/footer.hbs`:
```hbs
<tr>
  <td style="background-color:#f3f3f3;padding:15px;text-align:center;color:#555;font-size:12px;">
    <p style="margin:0;">&copy;{{currentYear}} {{brandName}}</p>
    <a href="{{publicOrigin}}" style="color:#3276dc;">Help Center</a>
  </td>
</tr>
```

- [ ] **Step 3: Create the body partials**

Create `backend/src/modules/module-email/templates/partials/verify-code.hbs`:
```hbs
<tr>
  <td style="padding:30px;text-align:center;">
    <h2 style="margin:0 0 12px;">Verify your email address</h2>
    <p style="margin:0 0 20px;color:#555;">Enter this code to verify your email:</p>
    <span class="code-box">{{code}}</span>
    <p style="margin:20px 0 0;color:#888;font-size:13px;">This code expires in {{expiresMinutes}} minutes.</p>
  </td>
</tr>
```

Create `backend/src/modules/module-email/templates/partials/change-email.hbs`:
```hbs
<tr>
  <td style="padding:30px;text-align:center;">
    <h2 style="margin:0 0 12px;">Confirm your new email address</h2>
    <p style="margin:0 0 20px;color:#555;">Enter this code to confirm your new email address:</p>
    <span class="code-box">{{code}}</span>
    <p style="margin:20px 0 0;color:#888;font-size:13px;">This code expires in {{expiresMinutes}} minutes.</p>
  </td>
</tr>
```

Create `backend/src/modules/module-email/templates/partials/reset-password.hbs`:
```hbs
<tr>
  <td style="padding:30px;text-align:center;">
    <h2 style="margin:0 0 12px;">Reset your password</h2>
    <p style="margin:0 0 20px;color:#555;">Click the button below to choose a new password:</p>
    <a href="{{resetLink}}" class="button"
      style="background-color:rgb(24,24,27);color:rgb(250,250,250);padding:12px 24px;border-radius:5px;text-decoration:none;font-weight:bold;display:inline-block;margin:8px 0;">Reset password</a>
    <p style="margin:20px 0 0;color:#888;font-size:13px;">This link expires in {{expiresMinutes}} minutes.</p>
  </td>
</tr>
```

Create `backend/src/modules/module-email/templates/partials/common-body.hbs`:
```hbs
<tr>
  <td style="padding:30px;text-align:center;">
    <h2 style="margin:0 0 12px;">{{title}}</h2>
    <p style="margin:0 0 20px;color:#555;text-align:left;">{{message}}</p>
  </td>
</tr>
```

- [ ] **Step 4: Create the module**

Create `backend/src/modules/module-email/email.module.ts`:
```ts
import { join } from 'path';
import { Logger, Module } from '@nestjs/common';
import type { MailerOptions } from '@nestjs-modules/mailer';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { BullModule } from '@nestjs/bullmq';
import env from 'src/utils/env';
import { QueueName } from 'src/infra/queue/queue.constants';
import {
  buildEmailFrom, hbsHelpers, isMailConfigured, buildSmtpOptions, createNoOpTransport,
} from './mail.helpers';

export function mailerOptionsFactory(): MailerOptions {
  const configured = isMailConfigured(env.MAIL_HOST, env.MAIL_AUTH_USER, env.MAIL_AUTH_PASS);
  if (!configured) {
    Logger.warn('Mail is not configured — emails will be logged (json transport), not sent.', 'EmailModule');
  }
  return {
    transport: configured ? buildSmtpOptions(env) : createNoOpTransport(),
    defaults: { from: buildEmailFrom(env.MAIL_SENDER, env.MAIL_SENDER_NAME) },
    template: {
      dir: join(__dirname, 'templates', 'pages'),
      adapter: new HandlebarsAdapter(hbsHelpers(env.PUBLIC_ORIGIN)),
      options: { strict: true },
    },
    options: {
      partials: {
        dir: join(__dirname, 'templates', 'partials'),
        options: { strict: true },
      },
    },
  };
}

@Module({
  imports: [
    MailerModule.forRoot(mailerOptionsFactory()),
    BullModule.registerQueue({ name: QueueName.EMAIL }),
  ],
})
export class EmailModule {}
```

- [ ] **Step 5: Register the module**

In `backend/src/modules/main.module.ts`, add the import at the top (after the `FileManagementModule` import on line 15):
```ts
import { EmailModule } from './module-email/email.module';
```
and add `EmailModule` to the `imports` array (after `FileManagementModule,`):
```ts
    FileManagementModule,
    EmailModule,
```

- [ ] **Step 6: Write the failing test**

Create `backend/src/modules/module-email/email.template.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { MailerModule, MailerService } from '@nestjs-modules/mailer';
import { mailerOptionsFactory } from './email.module';

// No SMTP env in tests → mailerOptionsFactory uses the json no-op transport,
// so sendMail renders the template and returns it as a JSON string without sending.
describe('email templates (no-op render)', () => {
  let mailer: MailerService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MailerModule.forRoot(mailerOptionsFactory())],
    }).compile();
    mailer = moduleRef.get(MailerService);
  });

  it('renders the verify-code body with the code and brand', async () => {
    const info = (await mailer.sendMail({
      to: 'user@example.com',
      subject: 'Verify your email address',
      template: 'normal',
      context: { brandName: 'Cybernetic', partialBody: 'verify-code', code: '123456', expiresMinutes: 30 },
    })) as { message: string };
    const rendered = JSON.parse(info.message);
    expect(rendered.html).toContain('123456');
    expect(rendered.html).toContain('Cybernetic');
    expect(rendered.html).toContain('expires in 30 minutes');
  });

  it('renders the reset-password body with the link', async () => {
    const info = (await mailer.sendMail({
      to: 'user@example.com',
      subject: 'Reset your password',
      template: 'normal',
      context: { brandName: 'Cybernetic', partialBody: 'reset-password', resetLink: 'https://app.test/r/abc', expiresMinutes: 15 },
    })) as { message: string };
    const rendered = JSON.parse(info.message);
    expect(rendered.html).toContain('https://app.test/r/abc');
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx jest src/modules/module-email/email.template.spec.ts`
Expected: FAIL — `Cannot find module './email.module'` (until Step 4 is saved). After Step 4, it should pass.

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest src/modules/module-email/email.template.spec.ts`
Expected: PASS (2 tests). If it fails with a Handlebars "strict" missing-property error, confirm the context includes every variable the chosen partial references.

- [ ] **Step 9: Verify build**

Run: `npm run build`
Expected: exit 0. Confirm templates were copied:
```bash
ls dist/modules/module-email/templates/pages/normal.hbs
```
Expected: the file exists (proves the nest-cli assets entry works).

- [ ] **Step 10: Commit**

Run from `backend/`:
```bash
git add src/modules/module-email/templates src/modules/module-email/email.module.ts src/modules/main.module.ts src/modules/module-email/email.template.spec.ts
git commit -m "feat(email): handlebars templates + MailerModule wiring + render test"
```

---

### Task 4: EmailService — rate-limit + enqueue

**Files:**
- Create: `backend/src/modules/module-email/email.service.ts`
- Modify: `backend/src/modules/module-email/email.module.ts` (add `EmailService` to providers + exports)
- Test: `backend/src/modules/module-email/email.service.spec.ts`

**Interfaces:**
- Consumes: `QueueName.EMAIL`, `SEND_EMAIL_JOB`; `cacheKey.mailRate`; `AppException`; `env`; `IDBConfigOptions` from `src/infra/application-db/application-db.module`; `MailerService` from `@nestjs-modules/mailer`; `isMailConfigured`, `buildSmtpOptions`, `verifyTransport` from `./mail.helpers`; payload types from `./email.interface`.
- Produces: `EmailService` with `send(payload)`, `sendVerificationCode(payload, ctx)`, `sendPasswordReset(payload, ctx)`, `sendChangeEmailCode(payload, ctx)`, `sendTestEmail(to)`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/module-email/email.service.spec.ts`:
```ts
jest.mock('src/utils/env', () => ({
  default: { MAIL_SENDER_NAME: 'Cybernetic', MAIL_RATE_LIMIT_SECONDS: 60, MAIL_HOST: 'smtp.x', MAIL_AUTH_USER: 'u', MAIL_AUTH_PASS: 'p' },
}));
jest.mock('./mail.helpers', () => ({
  isMailConfigured: jest.fn(),
  buildSmtpOptions: jest.fn(() => ({ host: 'smtp.x' })),
  verifyTransport: jest.fn(),
}));

import { EmailService } from './email.service';
import { isMailConfigured, verifyTransport } from './mail.helpers';
import { SEND_EMAIL_JOB } from 'src/infra/queue/queue.constants';

const CTX = { database_uri: 'u', schema_id: 'public', user_id: 1 } as any;

function make() {
  const queue = { add: jest.fn() } as any;
  const cache = { get: jest.fn(), set: jest.fn() } as any;
  const mailer = { sendMail: jest.fn() } as any;
  return { queue, cache, mailer, svc: new EmailService(queue, cache, mailer) };
}

describe('EmailService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sendVerificationCode enqueues a verify-code job after a rate-limit miss', async () => {
    const { svc, queue, cache } = make();
    cache.get.mockResolvedValue(undefined);
    await svc.sendVerificationCode({ to: 'a@b.com', code: '123456', expiresMinutes: 30 }, CTX);
    expect(cache.set).toHaveBeenCalledWith('cyb:public:mail:rate:signup:a@b.com', 1, 60000);
    expect(queue.add).toHaveBeenCalledWith(SEND_EMAIL_JOB, expect.objectContaining({
      to: 'a@b.com',
      subject: 'Verify your email address',
      context: expect.objectContaining({ partialBody: 'verify-code', code: '123456', expiresMinutes: 30, brandName: 'Cybernetic' }),
    }));
  });

  it('rejects with MAIL_RATE_LIMITED and does not enqueue when a key already exists', async () => {
    const { svc, queue, cache } = make();
    cache.get.mockResolvedValue(1);
    await expect(svc.sendPasswordReset({ to: 'a@b.com', resetLink: 'x', expiresMinutes: 15 }, CTX))
      .rejects.toMatchObject({ code: 'MAIL_RATE_LIMITED' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('generic send enqueues without rate limiting', async () => {
    const { svc, queue, cache } = make();
    await svc.send({ to: 'a@b.com', subject: 'Hi', partialBody: 'common-body', context: { title: 'T', message: 'M' } });
    expect(cache.get).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(SEND_EMAIL_JOB, expect.objectContaining({
      subject: 'Hi',
      context: expect.objectContaining({ partialBody: 'common-body', title: 'T', message: 'M', brandName: 'Cybernetic' }),
    }));
  });

  it('sendTestEmail throws MAIL_TRANSPORT_INVALID when not configured', async () => {
    const { svc, mailer } = make();
    (isMailConfigured as jest.Mock).mockReturnValue(false);
    await expect(svc.sendTestEmail('a@b.com')).rejects.toMatchObject({ code: 'MAIL_TRANSPORT_INVALID' });
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  it('sendTestEmail verifies transport then sends directly when configured', async () => {
    const { svc, mailer } = make();
    (isMailConfigured as jest.Mock).mockReturnValue(true);
    (verifyTransport as jest.Mock).mockResolvedValue(true);
    await svc.sendTestEmail('a@b.com');
    expect(verifyTransport).toHaveBeenCalled();
    expect(mailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@b.com', template: 'normal',
      context: expect.objectContaining({ partialBody: 'common-body' }),
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/modules/module-email/email.service.spec.ts`
Expected: FAIL — `Cannot find module './email.service'`.

- [ ] **Step 3: Implement the service**

Create `backend/src/modules/module-email/email.service.ts`:
```ts
import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MailerService } from '@nestjs-modules/mailer';
import env from 'src/utils/env';
import { QueueName, SEND_EMAIL_JOB } from 'src/infra/queue/queue.constants';
import { cacheKey } from 'src/infra/cache/cache.constants';
import { AppException } from 'src/utils/exception.provider';
import { IDBConfigOptions } from 'src/infra/application-db/application-db.module';
import { buildSmtpOptions, isMailConfigured, verifyTransport } from './mail.helpers';
import {
  IEmailJob, ISendPayload, IVerificationCodePayload, IPasswordResetPayload, IChangeEmailPayload,
} from './email.interface';

@Injectable()
export class EmailService {
  constructor(
    @InjectQueue(QueueName.EMAIL) private readonly queue: Queue<IEmailJob>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly mailer: MailerService,
  ) {}

  private baseContext(): Record<string, unknown> {
    return { brandName: env.MAIL_SENDER_NAME };
  }

  private async enqueue(job: IEmailJob): Promise<void> {
    await this.queue.add(SEND_EMAIL_JOB, job);
  }

  private async rateLimit(schemaId: string, purpose: string, email: string): Promise<void> {
    const key = cacheKey.mailRate(schemaId, purpose, email);
    if (await this.cache.get(key)) {
      AppException.throw('MAIL_RATE_LIMITED', `Too many ${purpose} emails for ${email}`);
    }
    await this.cache.set(key, 1, env.MAIL_RATE_LIMIT_SECONDS * 1000);
  }

  async send(payload: ISendPayload): Promise<void> {
    await this.enqueue({
      to: payload.to,
      subject: payload.subject,
      context: { ...this.baseContext(), partialBody: payload.partialBody, ...(payload.context ?? {}) },
    });
  }

  async sendVerificationCode(p: IVerificationCodePayload, ctx: IDBConfigOptions): Promise<void> {
    await this.rateLimit(ctx.schema_id, 'signup', p.to);
    await this.enqueue({
      to: p.to,
      subject: 'Verify your email address',
      context: { ...this.baseContext(), partialBody: 'verify-code', code: p.code, expiresMinutes: p.expiresMinutes },
    });
  }

  async sendPasswordReset(p: IPasswordResetPayload, ctx: IDBConfigOptions): Promise<void> {
    await this.rateLimit(ctx.schema_id, 'reset', p.to);
    await this.enqueue({
      to: p.to,
      subject: 'Reset your password',
      context: { ...this.baseContext(), partialBody: 'reset-password', resetLink: p.resetLink, expiresMinutes: p.expiresMinutes },
    });
  }

  async sendChangeEmailCode(p: IChangeEmailPayload, ctx: IDBConfigOptions): Promise<void> {
    await this.rateLimit(ctx.schema_id, 'change-email', p.to);
    await this.enqueue({
      to: p.to,
      subject: 'Confirm your new email address',
      context: { ...this.baseContext(), partialBody: 'change-email', code: p.code, expiresMinutes: p.expiresMinutes },
    });
  }

  // The one synchronous send: the admin test endpoint needs immediate verify-and-send feedback.
  async sendTestEmail(to: string): Promise<void> {
    if (!isMailConfigured(env.MAIL_HOST, env.MAIL_AUTH_USER, env.MAIL_AUTH_PASS)) {
      AppException.throw('MAIL_TRANSPORT_INVALID', 'Mail transport is not configured');
    }
    await verifyTransport(buildSmtpOptions(env));
    await this.mailer.sendMail({
      to,
      subject: 'Cybernetic test email',
      template: 'normal',
      context: { ...this.baseContext(), partialBody: 'common-body', title: 'Test email', message: 'Your mail transport is working.' },
    });
  }
}
```

- [ ] **Step 4: Register the service in the module**

In `backend/src/modules/module-email/email.module.ts`, add the import:
```ts
import { EmailService } from './email.service';
```
and add `providers` + `exports` to the `@Module` decorator (alongside the existing `imports`):
```ts
@Module({
  imports: [
    MailerModule.forRoot(mailerOptionsFactory()),
    BullModule.registerQueue({ name: QueueName.EMAIL }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/modules/module-email/email.service.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 7: Commit**

Run from `backend/`:
```bash
git add src/modules/module-email/email.service.ts src/modules/module-email/email.module.ts src/modules/module-email/email.service.spec.ts
git commit -m "feat(email): EmailService rate-limit + enqueue + sync test send"
```

---

### Task 5: EmailProcessor — async delivery

**Files:**
- Create: `backend/src/modules/module-email/email.processor.ts`
- Modify: `backend/src/modules/module-email/email.module.ts` (add `EmailProcessor` to providers)
- Test: `backend/src/modules/module-email/email.processor.spec.ts`

**Interfaces:**
- Consumes: `BaseProcessor` from `src/infra/queue/base.processor`; `QueueName.EMAIL`; `MailerService`; `IEmailJob`.
- Produces: `EmailProcessor` (`@Processor(QueueName.EMAIL)`), `handle(job)` → `mailerService.sendMail({ to, subject, template: 'normal', context })`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/modules/module-email/email.processor.spec.ts`:
```ts
import { EmailProcessor } from './email.processor';
import { Job } from 'bullmq';

function job(data: any): Job {
  return { data, queueName: 'email', id: '1', name: 'send_email', attemptsMade: 0 } as unknown as Job;
}

describe('EmailProcessor', () => {
  it('handle sends via MailerService using the normal page + job context', async () => {
    const mailer = { sendMail: jest.fn().mockResolvedValue({}) } as any;
    const proc = new EmailProcessor(mailer);
    await proc.handle(job({ to: 'a@b.com', subject: 'Hi', context: { partialBody: 'verify-code', code: '1' } }));
    expect(mailer.sendMail).toHaveBeenCalledWith({
      to: 'a@b.com',
      subject: 'Hi',
      template: 'normal',
      context: { partialBody: 'verify-code', code: '1' },
    });
  });

  it('handle propagates send errors so BullMQ retries', async () => {
    const mailer = { sendMail: jest.fn().mockRejectedValue(new Error('smtp down')) } as any;
    const proc = new EmailProcessor(mailer);
    await expect(proc.handle(job({ to: 'a@b.com', subject: 'Hi', context: {} }))).rejects.toThrow('smtp down');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/modules/module-email/email.processor.spec.ts`
Expected: FAIL — `Cannot find module './email.processor'`.

- [ ] **Step 3: Implement the processor**

Create `backend/src/modules/module-email/email.processor.ts`:
```ts
import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import { BaseProcessor } from 'src/infra/queue/base.processor';
import { QueueName } from 'src/infra/queue/queue.constants';
import { IEmailJob } from './email.interface';

@Processor(QueueName.EMAIL)
export class EmailProcessor extends BaseProcessor {
  constructor(private readonly mailer: MailerService) {
    super();
  }

  async handle(job: Job<IEmailJob>): Promise<void> {
    const { to, subject, context } = job.data;
    // When SMTP is unconfigured the transport is the json no-op, so this logs (BaseProcessor
    // records job:completed) instead of sending. When configured it sends for real.
    this.logger.log({ msg: 'email:sending', to, subject });
    await this.mailer.sendMail({ to, subject, template: 'normal', context });
  }
}
```

- [ ] **Step 4: Register the processor in the module**

In `backend/src/modules/module-email/email.module.ts`, add the import:
```ts
import { EmailProcessor } from './email.processor';
```
and add `EmailProcessor` to `providers`:
```ts
  providers: [EmailService, EmailProcessor],
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/modules/module-email/email.processor.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 7: Commit**

Run from `backend/`:
```bash
git add src/modules/module-email/email.processor.ts src/modules/module-email/email.module.ts src/modules/module-email/email.processor.spec.ts
git commit -m "feat(email): BullMQ EmailProcessor (async delivery)"
```

---

### Task 6: Admin test-transport controller + DTO + full verification

**Files:**
- Create: `backend/src/modules/module-email/email.dto.ts`
- Create: `backend/src/modules/module-email/email.controller.ts`
- Modify: `backend/src/modules/module-email/email.module.ts` (add `EmailController` to controllers)
- Test: `backend/src/modules/module-email/email.controller.spec.ts`

**Interfaces:**
- Consumes: `EmailService.sendTestEmail`; `buildOk`; `IBaseResponse`; `CheckPolicies`.
- Produces: `TestTransportDTO { to: string }`; `EmailController` with `POST /mail/test-transport`.

- [ ] **Step 1: Create the DTO**

Create `backend/src/modules/module-email/email.dto.ts`:
```ts
import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TestTransportDTO {
  @ApiProperty() @IsEmail() to!: string;
}
```

- [ ] **Step 2: Write the failing test**

Create `backend/src/modules/module-email/email.controller.spec.ts`:
```ts
import { EmailController } from './email.controller';

describe('EmailController', () => {
  it('test-transport calls sendTestEmail and returns an OK envelope', async () => {
    const emailService = { sendTestEmail: jest.fn().mockResolvedValue(undefined) } as any;
    const controller = new EmailController(emailService);
    const res = await controller.testTransport({ to: 'admin@x.com' });
    expect(emailService.sendTestEmail).toHaveBeenCalledWith('admin@x.com');
    expect(res).toMatchObject({ status_code: 200, message: 'Test email sent', error: null });
  });

  it('test-transport propagates a transport error from the service', async () => {
    const emailService = { sendTestEmail: jest.fn().mockRejectedValue({ code: 'MAIL_TRANSPORT_INVALID' }) } as any;
    const controller = new EmailController(emailService);
    await expect(controller.testTransport({ to: 'admin@x.com' })).rejects.toMatchObject({ code: 'MAIL_TRANSPORT_INVALID' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/modules/module-email/email.controller.spec.ts`
Expected: FAIL — `Cannot find module './email.controller'`.

- [ ] **Step 4: Implement the controller**

Create `backend/src/modules/module-email/email.controller.ts`:
```ts
import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EmailService } from './email.service';
import { TestTransportDTO } from './email.dto';
import { IBaseResponse } from 'src/utils/shared/interface';
import { buildOk } from 'src/utils/shared/response.factory';
import { CheckPolicies } from 'src/common/casl/policy.types';

@ApiTags('mail')
@Controller('mail')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('test-transport')
  @CheckPolicies((a) => a.can('manage', 'all'))
  @ApiOperation({ summary: 'Send a test email via the configured transport (admin only)' })
  async testTransport(@Body() dto: TestTransportDTO): Promise<IBaseResponse> {
    await this.emailService.sendTestEmail(dto.to);
    return buildOk(null, 'Test email sent');
  }
}
```
(`a.can('manage', 'all')` — `ability.factory.ts` grants `manage`/`all` only to `admin`, so this is an admin-only gate. The global `PoliciesGuard` + `JwtAuthGuard` enforce it; the route is not `@Public`.)

- [ ] **Step 5: Register the controller in the module**

In `backend/src/modules/module-email/email.module.ts`, add the import:
```ts
import { EmailController } from './email.controller';
```
and add the `controllers` array to the `@Module` decorator:
```ts
  controllers: [EmailController],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
```

- [ ] **Step 6: Run the new test to verify it passes**

Run: `npx jest src/modules/module-email/email.controller.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Run the whole email module suite**

Run: `npx jest src/modules/module-email`
Expected: PASS — 5 suites (`mail.helpers`, `email.template`, `email.service`, `email.processor`, `email.controller`).

- [ ] **Step 8: Full-suite regression + build**

Run:
```bash
npm test
npm run build
```
Expected: all suites pass (prior baseline was 55 suites / 263 tests — expect that plus the new email suites/tests), build exit 0.

- [ ] **Step 9: Commit**

Run from `backend/`:
```bash
git add src/modules/module-email/email.dto.ts src/modules/module-email/email.controller.ts src/modules/module-email/email.module.ts src/modules/module-email/email.controller.spec.ts
git commit -m "feat(email): admin test-transport endpoint + DTO; wire controller"
```

---

## Deferred / follow-ups

- **Boot smoke test** (GET against a live app with Redis + SMTP) is deferred — the unit/integration tests deliberately avoid Redis, so full `EmailModule` DI (queue + processor) is first exercised at real app boot, same as the file-management module.
- **Spec 2** (separate plan): auth flows — signup-verify, forgot/reset-password, change-email endpoints + verification-code storage + `email_verified` schema if needed — which call `EmailService.sendVerificationCode` / `sendPasswordReset` / `sendChangeEmailCode`.
- The `EMAIL_SEND_FAILED` error code is defined for use by callers/Spec 2; in Spec 1 send failures surface as BullMQ job errors (async path) rather than a synchronous HTTP error.
