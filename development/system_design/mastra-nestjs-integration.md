# Can you embed Mastra AI directly into NestJS?

**Short answer:** Yes, directly and officially. Mastra ships a first-party NestJS adapter package — `@mastra/nestjs` — that mounts Mastra's agent/workflow/MCP endpoints inside your existing NestJS app using native NestJS primitives (modules, DI, guards, interceptors, filters). You do **not** need to run Mastra as a separate sidecar server.

There is one hard requirement worth flagging up front: **the NestJS adapter supports the Express adapter only — not Fastify.**

---

## How it works

Mastra's "server adapters" let you run Mastra inside your own HTTP server instead of the standalone Hono server that `mastra build` generates. There are official adapters for **Express, Hono, Fastify, Koa, and NestJS**. For NestJS specifically, the integration is a normal NestJS module.

### 1. Install

```bash
npm install @mastra/nestjs @mastra/core
```

### 2. Register the module

Define your Mastra instance as usual (`./mastra`), then import `MastraModule`:

```typescript
import { Module } from '@nestjs/common'
import { MastraModule } from '@mastra/nestjs'
import { mastra } from './mastra'

@Module({
  imports: [
    MastraModule.register({
      mastra,
    }),
  ],
})
export class AppModule {}
```

### 3. Bootstrap normally

```typescript
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)  // Express adapter (default)
  await app.listen(3000)
}
bootstrap()
```

That's it. With the default prefix (`/api`), Mastra's routes for agents, workflows, and any configured MCP servers mount under `http://localhost:3000/api/...` (e.g. `/api/agents`, `/api/workflows`), running alongside your own NestJS controllers.

### Async registration (recommended for real apps)

When your Mastra config depends on runtime services like `ConfigService`, use async registration. It supports `useFactory`, `useClass`, and `useExisting`:

```typescript
MastraModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    mastra: buildMastra(config),
  }),
})
```

---

## What you get (NestJS-native features)

| Feature | Detail |
|---|---|
| **DI integration** | `MastraService` is injectable, with `getMastra()`, `getOptions()`, `getAgent()`, `getWorkflow()` — so you can call agents/workflows from your own controllers and services. |
| **Request context middleware** | Attaches the Mastra instance, request context, tools, and abort signal to every request, available to all downstream middleware/handlers. |
| **Auth** | Mastra's built-in bearer-token auth is **disabled by default** (most NestJS apps already have their own auth). When enabled, it reads bearer tokens from the `Authorization` header. Use the `Public` decorator to exempt routes; `customRouteAuthConfig` for per-route overrides. |
| **Rate limiting** | Enabled by default (opt-out). Control via `@MastraThrottle({ limit, windowMs })` and `@SkipThrottle` decorators. |
| **Streaming** | SSE streaming for AI responses, with `streamOptions: { redact: true, heartbeatMs: 20_000 }` for optional redaction and heartbeats. |
| **Graceful shutdown** | In-flight request tracking with optional SSE notifications. |
| **Guards / interceptors / filters** | Standard NestJS primitives are respected. |
| **Custom routes** | Your own routes added after init have access to the Mastra context. |
| **OpenAPI** | Optional spec generation via `openapiPath`. |
| **Route prefix** | Customizable (default `/api`). |

---

## ⚠️ Key limitations / requirements

1. **Express adapter only.** If your NestJS app uses **Fastify**, `MastraModule` **fails fast at bootstrap with a clear error** rather than partially initializing. This is the single biggest gotcha.
2. **Rate limiting is on by default** — explicitly opt out or tune it if you already have your own throttling, to avoid double limiting.
3. **Auth is off by default** — by design, since you'll typically wire Mastra's routes into your existing NestJS auth (guards). Don't assume the Mastra endpoints are protected unless you protect them.
4. Community demand was strong (GitHub issues [#5081](https://github.com/mastra-ai/mastra/issues/5081), [#8602](https://github.com/mastra-ai/mastra/issues/8602)) before the official package landed — so confirm you're on a recent `@mastra/core` / `@mastra/nestjs` version, since this is a relatively new, evolving package.

---

## Alternatives (in case the adapter doesn't fit)

Even though direct embedding works, here are the fallbacks — most relevant if you're on **Fastify** and can't switch to Express:

1. **Generic server adapter via your own Express layer** — Even outside NestJS, Mastra exposes `MastraServer` for Express/Hono/Fastify/Koa. You could mount Mastra in a small Express instance and bridge it, but inside NestJS the native `@mastra/nestjs` module is the cleaner path.

2. **Use Mastra's core SDK directly, skip the HTTP adapter** — You don't have to expose Mastra's REST routes at all. Import your agents/workflows from `@mastra/core` and call them from inside your NestJS services/controllers (`agent.generate(...)`, `workflow.execute(...)`). This gives you full control over routing, auth, and validation using your existing NestJS patterns, and **works regardless of Express vs Fastify**. This is often the best choice when you only need agent logic, not Mastra's prebuilt API surface (e.g. for the Mastra playground/client).

3. **Run Mastra as a standalone server (sidecar)** — Deploy Mastra's built-in Hono server (`mastra build` → self-contained server entry point) as a separate service, and have NestJS call it over HTTP/SSE. Fully decoupled; useful if you want independent scaling/deploy lifecycles, but adds a network hop and another deployable.

**Recommendation:** If you're on Express → use `@mastra/nestjs`. If you're on Fastify or want maximum control → use the core SDK directly inside your NestJS services (Alternative #2). Only reach for the sidecar (Alternative #3) if you need independent scaling/deployment.

---

## Sources

- [Server Adapters | Mastra Docs](https://mastra.ai/docs/server/server-adapters)
- [@mastra/nestjs — npm](https://www.npmjs.com/package/@mastra/nestjs)
- [Deploy a Mastra server | Mastra Docs](https://mastra.ai/docs/deployment/mastra-server)
- [Mastra GitHub repository](https://github.com/mastra-ai/mastra)
- [FEATURE: Use NestJS to provide services — Issue #5081](https://github.com/mastra-ai/mastra/issues/5081)
- [FEATURE: support for nestjs — Issue #8602](https://github.com/mastra-ai/mastra/issues/8602)
- [Running Mastra behind NestJS — AnswerOverflow](https://www.answeroverflow.com/m/1458131868254863475)
