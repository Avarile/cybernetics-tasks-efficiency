# Email Module — Design (Spec 1)

- **Date:** 2026-06-30
- **Branch:** `feat-email-module` (off `dev`)
- **Reference:** `/home/avarile/Documents/codeRepo/cybernetics-data-centre/apps/nestjs-backend/src/features/mail-sender`
- **Status:** Approved design; pending implementation plan.

This is the **first of two specs**. Spec 1 (this document) builds the reusable email-sending
capability. Spec 2 (follow-up, not designed yet) builds the auth flows — signup verification,
password reset, change-email endpoints + supporting schema + code storage — that *consume* the
methods defined here.

---

## 1. Purpose & Boundaries

Provide a reusable email-sending capability for the cybernetic backend:

- SMTP transport via `@nestjs-modules/mailer` + Nodemailer.
- Handlebars-templated rendering with a shared header/footer layout.
- **Async delivery** through BullMQ with retry.
- A graceful **no-config dev-log mode** (logs instead of sending when SMTP is unconfigured).
- Per-recipient **rate limiting** for transactional emails.
- An **admin test-transport endpoint**.
- **Typed send methods** for the transactional emails (verify-code, reset-password,
  change-email) plus a generic send.

**Out of bounds for this module** (owned by Spec 2 or dropped — see §10):
auth endpoints, verification-code generation/storage, `email_verified` schema changes,
DB-overridable transports, the notification digest/merge processor, and i18n.

The module exposes its capability through `EmailService` (exported) and a single admin
controller. Spec 2 will inject `EmailService` and call its typed methods.

---

## 2. Module Layout

```
src/modules/module-email/
  email.module.ts       // MailerModule.forRootAsync + BullModule.registerQueue(EMAIL); providers + exports
  email.service.ts      // public API: rate-limit -> enqueue; transport-config + no-op builders
  email.processor.ts    // @Processor(QueueName.EMAIL) extends BaseProcessor; renders + sends
  email.controller.ts   // POST /mail/test-transport (admin-only)
  email.dto.ts          // TestTransportDTO (Zod) + job payload / option types
  email.interface.ts    // IEmailJob, ISendMailOptions, typed method payloads
  mail.helpers.ts       // buildEmailFrom, verifyTransport, handlebars helpers (publicOrigin, currentYear)
  templates/
    pages/
      normal.hbs        // layout: header partial -> {{> body}} -> footer partial
    partials/
      header.hbs
      footer.hbs
      verify-code.hbs
      reset-password.hbs
      change-email.hbs
      common-body.hbs
```

### Shared-infrastructure edits

| File | Change |
|------|--------|
| `src/utils/env.ts` | Add `MAIL_*` block + `PUBLIC_ORIGIN` to the Zod schema |
| `src/infra/queue/queue.constants.ts` | Add `EMAIL = 'email'` to `QueueName`; add `export const SEND_EMAIL_JOB = 'send_email'` |
| `src/infra/queue/queue.module.ts` | `BullModule.registerQueue({ name: QueueName.EMAIL })` |
| `src/infra/cache/cache.constants.ts` | Add `mailRate(schema, purpose, email)` to `cacheKey` |
| `src/utils/exception.provider.ts` | Add `EMAIL_SEND_FAILED`, `MAIL_TRANSPORT_INVALID`, `MAIL_RATE_LIMITED` to `ERROR_CATALOG` |
| `src/modules/main.module.ts` | Import `EmailModule` |
| `nest-cli.json` | Add `compilerOptions.assets` to copy `templates/**/*.hbs` into `dist/` |
| `package.json` (backend) | Add `@nestjs-modules/mailer`, `nodemailer`, `handlebars`, `@types/nodemailer` (via yarn; root lockfile) |

`nest-cli.json` currently has no `assets` config and sets `deleteOutDir: true`. Without an
assets entry, `.hbs` templates are not copied to `dist/` and Handlebars rendering fails at
runtime. The assets entry is therefore mandatory, e.g.:

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

---

## 3. Configuration & No-Config Dev Mode

Add to the existing Zod schema in `src/utils/env.ts` (this repo configures via a single
`env` object imported directly — **not** `@nestjs/config` + `registerAs`, which is what the
reference uses):

| Env var | Default | Purpose |
|---------|---------|---------|
| `MAIL_HOST` | *(optional)* | SMTP host (part of `isMailConfigured`) |
| `MAIL_PORT` | `465` | SMTP port |
| `MAIL_SECURE` | `true` | TLS on connect |
| `MAIL_AUTH_USER` | *(optional)* | SMTP user (part of `isMailConfigured`) |
| `MAIL_AUTH_PASS` | *(optional)* | SMTP password (part of `isMailConfigured`) |
| `MAIL_SENDER` | `noreply@cybernetic.local` | From address |
| `MAIL_SENDER_NAME` | `Cybernetic` | From display name |
| `MAIL_CONNECTION_TIMEOUT` | `10000` | nodemailer `connectionTimeout` (ms) |
| `MAIL_GREETING_TIMEOUT` | `10000` | nodemailer `greetingTimeout` (ms) |
| `MAIL_DNS_TIMEOUT` | `5000` | nodemailer `dnsTimeout` (ms) |
| `MAIL_RATE_LIMIT_SECONDS` | `60` | Per-recipient transactional rate-limit window |
| `PUBLIC_ORIGIN` | `http://localhost:3000` | Origin used to build links in emails |

`isMailConfigured = Boolean(MAIL_HOST && MAIL_AUTH_USER && MAIL_AUTH_PASS)` — computed once
in the module factory and surfaced to the service.

**No-config mode:** when `isMailConfigured` is false, the MailerModule transport is a
Nodemailer `jsonTransport` no-op whose `verify()` is patched to resolve (the mailer library
calls `verify().then()` unconditionally, and `jsonTransport`'s default `verify` returns
false). In this mode the processor **logs the rendered email** (recipient, subject, body
preview) rather than sending, and the module logs one startup warning. This keeps local dev
and CI fully functional without SMTP credentials.

---

## 4. Transport & MailerModule Wiring

`MailerModule.forRootAsync` factory:

- If `isMailConfigured`: real SMTP transport — `{ host, port, secure, auth: { user, pass } }`
  merged with the three timeout settings.
- Else: `createNoOpTransport()` — `nodemailer.createTransport({ jsonTransport: true })` with
  `transport.verify` patched to `() => Promise.resolve(true)`; log a warning.
- `defaults.from = buildEmailFrom(MAIL_SENDER, MAIL_SENDER_NAME)`.
- `template: { dir: <templates/pages>, adapter: new HandlebarsAdapter(helpers(env)), options: { strict: true } }`
  with the partials directory registered so `{{> header}}` / `{{> footer}}` / body partials resolve.

**Transport source = env only.** The reference's DB-overridable Notify/Automation transport
tiers (`getTransportConfigByName`, `NOTIFY_MAIL_TRANSPORT_CONFIG`, etc.) are intentionally
dropped: there is no runtime settings store in this repo, and the feature is not needed yet.

---

## 5. Templates (Handlebars)

- `pages/normal.hbs` — the layout: includes `{{> header}}`, renders the selected body
  partial, includes `{{> footer}}`. Brand context available to all templates:
  `brandName`, `publicOrigin`, `currentYear`.
- Body partials:
  - `verify-code.hbs` — context `{ code, expiresMinutes }`.
  - `reset-password.hbs` — context `{ resetLink, expiresMinutes }`.
  - `change-email.hbs` — context `{ code, expiresMinutes }`.
  - `common-body.hbs` — context `{ title, message }` (also used by the test endpoint).
- Handlebars helpers (`mail.helpers.ts`): `publicOrigin()` (returns `env.PUBLIC_ORIGIN`),
  `currentYear()`.

Templates are plain English (the repo has no i18n).

---

## 6. EmailService API & Async Delivery

All sends go through BullMQ (uniform retry/fault-tolerance; controllers return immediately).
Each public method performs a **rate-limit check, then enqueues** an `IEmailJob` onto
`QueueName.EMAIL` using the existing `DEFAULT_JOB_OPTIONS` (3 attempts, exponential backoff).

```ts
interface IEmailJob {
  to: string;
  subject: string;
  template: 'verify-code' | 'reset-password' | 'change-email' | 'common-body';
  context: Record<string, unknown>;
  schemaId: string;   // for rate-limit / log context
}
```

Public methods (the API Spec 2 calls):

| Method | Template | Context | Rate-limited |
|--------|----------|---------|--------------|
| `send({ to, subject, template, context })` | caller-chosen | caller-supplied | no (opt-in) |
| `sendVerificationCode({ to, code, expiresMinutes, ctx })` | `verify-code` | `{ code, expiresMinutes }` | yes (`signup`) |
| `sendPasswordReset({ to, resetLink, expiresMinutes, ctx })` | `reset-password` | `{ resetLink, expiresMinutes }` | yes (`reset`) |
| `sendChangeEmailCode({ to, code, expiresMinutes, ctx })` | `change-email` | `{ code, expiresMinutes }` | yes (`change-email`) |

`EmailProcessor.handle(job)` (extends `BaseProcessor`):

- Resolves nothing from the DB (email is tenant-agnostic at the transport level).
- Calls `mailerService.sendMail({ to, subject, template, context })` — Handlebars renders here.
- On success: `BaseProcessor` logs `job:completed`.
- On failure: throw → BullMQ retries up to 3× (exp backoff) → then dead-letters; logged by
  `BaseProcessor`. Send failures surface as the job error, not a synchronous HTTP error,
  because the originating request already returned.
- In no-config mode the underlying transport is the json no-op, so `sendMail` resolves
  without sending; the processor additionally logs the rendered email content for visibility.

The reference's 60-second debounce/digest **merge processor** for notification bursts is out
of scope — there is no notification feature in this repo.

---

## 7. Rate Limiting

Per `(purpose, recipient)` via the global cache (`@nestjs/cache-manager`, already `@Global`):

- New helper: `cacheKey.mailRate(schema: string, purpose: string, email: string) => \`cyb:${schema}:mail:rate:${purpose}:${email}\``.
- Before enqueue: if the key exists → throw `MAIL_RATE_LIMITED` (HTTP 429).
- On enqueue: `cache.set(key, 1, MAIL_RATE_LIMIT_SECONDS * 1000)`.
- Applies to the three transactional methods (each passes its own `purpose`). Generic `send`
  does not rate-limit unless the caller opts in.

`purpose` values: `signup`, `reset`, `change-email`. `schema` comes from the caller's
`ctx.schema_id` so limits are tenant-isolated.

---

## 8. Admin Test-Transport Endpoint

`POST /api/v1/mail/test-transport` (controller `@Controller('mail')`, default URI version `1`,
global prefix `api`).

- **Authorization:** admin-only via CASL — `@CheckPolicies((a) => a.can('manage', 'all'))`.
  Only the `admin` role is granted `manage`/`all` in `ability.factory.ts`; executive has
  `read`/`all` and managers have subject-scoped grants, so this gate is effectively admin-only.
  (Alternative considered: add a dedicated `'Email'` CASL subject — not taken, to avoid
  expanding the subject set for a single endpoint.)
- **Body:** `TestTransportDTO { to: string (email) }` (Zod-validated).
- **Behavior (synchronous by design):** if `isMailConfigured` is false → `MAIL_TRANSPORT_INVALID`
  (400) immediately (nothing to test). Otherwise `verifyTransport(currentTransportConfig)`; on
  failure → `MAIL_TRANSPORT_INVALID` (400). On success, send a `common-body` test email to `to`
  via a **direct** `mailerService.sendMail` (NOT the queue) so the admin gets immediate
  pass/fail feedback; a send error surfaces as `EMAIL_SEND_FAILED` (500). Return
  `buildOk(result, 'Test email sent')`. This is the one intentional synchronous send (see
  Confirmed decisions).
- The reference additionally accepted an ad-hoc transport config in the body (to validate SMTP
  creds before persisting them to DB). Dropped here, since there is no DB transport store.

---

## 9. Error Handling & Testing

### Error codes (added to `ERROR_CATALOG`)

```ts
EMAIL_SEND_FAILED:     { status: HttpStatus.INTERNAL_SERVER_ERROR,    message: 'Email send operation failed' },
MAIL_TRANSPORT_INVALID:{ status: HttpStatus.BAD_REQUEST,              message: 'Invalid mail transport configuration' },
MAIL_RATE_LIMITED:     { status: HttpStatus.TOO_MANY_REQUESTS,        message: 'Too many email requests; try again later' },
```

### Tests (Jest, following repo conventions: `AppException`, `buildOk`, `BaseProcessor`)

- `mail.helpers.spec.ts` — `buildEmailFrom` formatting; `verifyTransport` success and
  failure (mock `nodemailer.createTransport().verify`).
- `email.service.spec.ts` — each typed method enqueues the correct
  `{ template, context, subject }`; rate-limit gate rejects the second call within the window
  (fake cache); generic `send` bypasses the limit.
- `email.processor.spec.ts` — `handle()` calls `mailerService.sendMail` with the right args;
  no-config log path; throws on send failure (so BullMQ retries).
- `email.controller.spec.ts` (or integration) — endpoint authorization (admin passes,
  non-admin forbidden) and the happy path with a mocked `MailerService`.

---

## 10. Explicitly Out of Scope

| Item | Disposition |
|------|-------------|
| Auth endpoints (signup-verify, forgot/reset, change-email) | **Spec 2** |
| Verification-code generation/storage | **Spec 2** |
| `email_verified` schema/migration | **Spec 2** (if needed) |
| DB-overridable transports (Notify/Automation tiers) | Dropped — no settings store |
| Notification digest/merge processor (60s debounce) | Dropped — no notification feature |
| i18n / nestjs-i18n | Dropped — repo has no i18n; English-only templates |
| Cell-tag / space-invite / waitlist emails | Dropped — no such features in this repo |

---

## Confirmed decisions

- All **transactional/business** sends (including verification codes) go through the BullMQ
  queue — uniform retry; controllers return immediately. The **only** synchronous send is the
  admin test-transport endpoint (§8), which sends directly so the admin gets immediate
  verify-and-send feedback.
- A duplicate transactional send within the rate-limit window is **rejected with HTTP 429**
  (`MAIL_RATE_LIMITED`), not silently skipped.
- The test-transport endpoint is gated by `can('manage', 'all')` (admin-only) rather than a
  new CASL subject.
