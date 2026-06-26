# Cybernetic — OKR-Driven Execution Tracking & AI Efficiency Engine

**Status:** Draft v1 (approved design, pre-implementation)
**Date:** 2026-06-27
**Author:** Avarile (with Claude Code)
**Source goal:** `development/goal/general_goal`

---

## 1. Summary & Vision

Cybernetic is, on the surface, an OKR-structured task system: work cascades from
company objectives down through departments to the concrete initiatives employees
execute day to day. But the surface is not the product. **The product is the
high-fidelity, temporal record of how work actually gets done — and the AI layer
that mines it** to find bottlenecks, recommend optimizations, measure the real
effect of decisions over time, and identify where AI itself can take over or
augment work.

In one sentence: *task management on the surface, an efficiency-and-AI-adoption
intelligence engine underneath.*

The central architectural bet is that **execution data should be captured as an
append-only stream of immutable events**, not as mutable status columns. A stream
lets the system reconstruct what was true at any moment, cluster the *reasons*
work stalls, and measure *cause → effect* over time. A status column throws all of
that away. Everything else in this design serves that bet.

---

## 2. Goals & Non-Goals

### Goals
- Model company work as OKRs: **Objective → Key Result → Initiative**, with
  alignment links that roll progress upward (individual deal → "close 10%" →
  "$100M income").
- Capture the *execution trace* of every initiative with low friction: status
  changes, time spent, **why** something succeeded/failed/delayed, and the
  **immediate result**.
- Make capture cheap via **AI-assisted structuring**: lightweight natural-language
  input in, structured events out.
- Deliver four advisory intelligence outputs: bottleneck detection, optimization
  suggestions, decision/experiment measurement, and AI-automation candidate
  flagging.
- Run as a **single-tenant-per-deployment** product: one company per isolated
  instance.

### Non-Goals (v1)
- **No autonomous action.** The AI advises; humans act. (Seams are left for an
  "assisted action" phase later.)
- **No multi-tenancy.** Isolation is by deployment, not by `tenant_id`.
- **No data warehouse / OLAP layer.** Postgres handles company-scale analytics.
- **No outbound integration write-back.** v1 integrations are inbound-only signals.
- Not a replacement for chat, docs, or code review — it *links to* those, it does
  not reimplement them.

---

## 3. Foundational Decisions

These four pillars were settled during design and constrain everything downstream:

| Pillar | Decision | Consequence |
|---|---|---|
| **Positioning** | Hybrid — native OKR/task core (system of record) **+** integrations for signals | We own the OKR + outcome data; integrations enrich, they don't own |
| **Data capture** | AI-assisted — lightweight input, Mastra agents structure it | Capture UX + an extraction agent are first-class, not afterthoughts |
| **AI scope** | Advisory v1 — analyze / measure / recommend; humans act | Smallest trust surface; design seams for assisted-action later |
| **Tenancy** | Single-tenant-per-deployment | No tenancy layer; isolation by construction; RBAC *within* the company |

**Macro-architecture:** a **modular monolith** with an event-sourced activity log
and an embedded Mastra worker (chosen over a microservices split or a
warehouse-centric design). It is the simplest thing to run per-customer, and it is
deliberately structured so the `intelligence` module can later extract into its own
service, and a warehouse can be added if a customer's data volume ever demands it.

---

## 4. Domain Model — Bounded Contexts

Five modules, each with clear responsibility, its own entities and repositories
(`*.repo.ts`), communicating through an internal event bus:

| Module | Responsibility |
|---|---|
| `identity` | Organization, departments, teams, people, roles/permissions |
| `okr` | Objectives, Key Results, Initiatives, alignment links, Interventions |
| `tracking` | The append-only **activity-event log** + derived current-state projections |
| `integrations` | Connectors, inbound signal ingestion, normalization |
| `intelligence` | Mastra agents: capture-structuring + the four analysis jobs; Insights |

---

## 5. Data Model

### 5.1 `identity`
- **Organization** (singleton per deployment): `id, name, settings`.
- **Department**: `id, name, parent_id?` (nesting), `lead_person_id`.
- **Team**: `id, department_id, name, lead_person_id`.
- **Person**: `id, name, email, department_id?, team_id?, role, status`.
- **Role** (enum): `Admin | Manager | Member | Executive` (see §11).

### 5.2 `okr`
- **Objective**: `id, title, description, owner_person_id, scope (org|dept|team),
  scope_ref_id, period, status`.
- **KeyResult**: `id, objective_id, title, metric_type (number|percent|currency|
  boolean), start_value, target_value, current_value, unit, direction
  (increase|decrease)`.
- **Initiative** (the unit that gets executed & traced): `id, title, description,
  owner_person_id, priority, due_date`; linked to KRs via **InitiativeKeyResult**
  (`initiative_id, key_result_id`). Its *status* is a projection (see §5.3), not a
  stored column.
- **AlignmentLink**: `id, from_ref, to_ref, weight` — rolls a child Objective/KR up
  into a parent, so company-level progress aggregates from the bottom.
- **Intervention**: `id, title, description, decided_by_person_id, started_at,
  scope, affected_key_result_ids[], hypothesis, measurement_window, status` — a
  dated, scoped decision whose effect the intelligence layer measures (§8.3).

> **Resolving the "Key-Task" ambiguity in the source goal:** the goal used
> "Key-Task" for both *measurable outcomes* (views, clicks, 5% conversion) and
> *discrete work* (close client A). These are split here into **Key Results**
> (measurable) and **Initiatives** (work).

### 5.3 `tracking` — the event log (crown jewel)

**ActivityEvent** (append-only, immutable; the source of truth):
```
id, occurred_at, recorded_at, actor_person_id,
subject_type (initiative|key_result|objective), subject_id,
type, payload (jsonb), source (human|agent|integration),
confidence (0..1, null for human), raw_input_ref?, correlation_id
```

Event taxonomy:
- **Lifecycle:** `Created, Started, Paused, Resumed, Blocked, Unblocked,
  Cancelled, Completed`
- **Signals:** `TimeLogged, ReasonRecorded` (why delayed/failed/succeeded),
  `OutcomeRecorded` (immediate result), `NoteAdded`, `KeyResultMeasured` (metric
  value at a point in time)

Supporting tables:
- **RawInput**: `id, person_id, channel (web|slack|voice|integration), text,
  received_at, metadata` — the original lightweight input an agent extracted from;
  referenced by `ActivityEvent.raw_input_ref` for traceability and feedback.
- **ReasonTaxonomy**: `id, label, category` — controlled reason classes the capture
  agent maps free text onto (while preserving the original text).
- **Projections** (derived, rebuildable from the stream):
  - **InitiativeState**: `initiative_id, status, total_time_logged, blocked_since?,
    last_event_at, ...`
  - **KeyResultSeries**: the time-series of `KeyResultMeasured` values per KR (used
    for pace-to-target and Intervention measurement).

`source` + `confidence` + `raw_input_ref` exist because most events are
**AI-extracted**; a human confirmation or correction is *itself* an event, forming
the feedback loop in §7.

### 5.4 `intelligence`
- **Insight**: `id, type (bottleneck|optimization|measurement|automation_candidate),
  scope_ref, title, body, evidence_refs (jsonb: event/entity ids), confidence,
  suggested_action, status (new|ack|dismissed|actioned), created_by_job, created_at,
  actioned_outcome_ref?`. Insights are themselves trackable so we can later measure
  whether acting on one helped (**meta-learning**).
- **FeedbackExample**: `id, raw_input_ref, corrected_events, created_at` — confirmed
  corrections that become few-shot examples to improve extraction.

---

## 6. Macro-Architecture

**Modular monolith**, single deployable backend + a worker process, single Postgres,
single SPA. Internal event bus connects modules (e.g., creating an Intervention
emits an event that triggers an intelligence job).

```
backend/src/
  identity/      entities, *.repo.ts, service, controller
  okr/           objectives, key-results, initiatives, interventions, alignment
  tracking/      events, projectors, *.repo.ts (append-only writer + read models)
  integrations/  connectors/*  (common connector interface)
  intelligence/  insight.repo.ts, job triggers (agents live in mastra_ai)
  shared/        db, event-bus, auth, config
mastra_ai/       capture agent + the four intelligence workflows (consumed by worker)
frontend/        React + TS SPA
devops/          Docker/compose, migrations runner, per-deployment config
```

The AI worker (pg-boss jobs) runs the Mastra agents on schedule and on triggers,
reading the event log and writing Insights/events back. This keeps heavy/async AI
work off the request path while staying in one deployable. **Evolution seam:** the
`intelligence` module + worker can be extracted into a separate service later
without touching the other modules, because they already communicate only through
the event bus and the event log.

---

## 7. AI-Assisted Capture Pipeline

The flow that feeds the whole system:

1. **Input surfaces** — a sentence ("spent the morning on the Acme deal, stuck
   waiting on legal"), a standup note, a Slack line, a quick form, or voice-to-text;
   plus passive integration signals.
2. **Capture agent (Mastra)** takes raw input + context (the person's active
   Initiatives, recent events, the OKR tree) and:
   - **Entity-links** it to the right Initiative/KR (one-tap disambiguation only
     when genuinely unsure).
   - **Extracts candidate events** — status change, time, reason, outcome, metric.
   - Emits them with `source=agent`, a `confidence`, and `raw_input_ref`.
3. **Confirmation loop** — high-confidence/low-risk events auto-commit; low-confidence
   or high-impact ones surface for one-tap confirm/correct. **Corrections become
   events** and feed `FeedbackExample` so extraction improves.
4. **Normalization** — free-text reasons map to the `ReasonTaxonomy` while keeping
   the original text, so the AI can cluster without losing nuance.

**Guardrails:** the agent never invents outcomes — it structures what's stated and
*prompts* for gaps ("you marked it done — what was the immediate result?"). Time
reported from multiple sources (a human note + a git signal) **reconciles, not
double-counts** (via `correlation_id`).

---

## 8. Intelligence Layer — The Four Jobs

Scheduled/triggered Mastra workflows over the event log + OKR tree. Each writes an
**Insight** with evidence references and a confidence.

### 8.1 Bottleneck / caveat detection
Scans for long `Blocked`/`Paused` durations, cycle-time outliers vs. history/peers,
recurring delay-reason clusters within a department, dependency stalls, and KRs
trending below pace-to-target. Output: ranked bottlenecks *with the evidence*
(which events, which window).

### 8.2 Optimization suggestions
For each detected pattern, a concrete grounded proposal (e.g., "legal review adds
~4 days to deal-close; pre-clear standard contracts"). Advisory only — lands as a
`suggested_action` on the Insight.

### 8.3 Experiment / decision measurement
For each **Intervention**, compute before/after on the affected KR time-series over
its window, and — where possible — compare against an unaffected segment as a rough
control (e.g., reps who didn't adopt the new script). Reports an effect estimate
**with honest caveats** ("2-week window, small sample, possible seasonality"):
correlation with guardrails, never false certainty. This is the "did the new sales
strategy work in 2 weeks?" capability from the source goal.

### 8.4 AI-automation candidate flagging *(the AI-adoption deliverable)*
Mines recurring Initiatives by type × frequency × time-spent × structured-ness and
ranks them by automation potential × effort saved (e.g., "weekly competitor summary:
12 people, ~3h/wk each, highly structured → est. 36h/wk saved; sketch: a Mastra
agent with web-search + summarize tools"). Stops at an ROI-backed recommendation —
the on-ramp to the assisted-action future.

---

## 9. Integrations

- **Connector interface** — each integration implements `auth`, `pull(since)` /
  `webhook`, and `normalize()` (external events → internal signal format).
- **v1 connectors** (few, high-signal): GitHub (commits/PRs → work signals),
  calendar (time allocation), Slack (updates/blockers), one CRM (deal-stage → sales
  KRs).
- **Inbound only in v1.** Signals are low-confidence *hints* that corroborate human
  capture (git activity backs up "worked on X for 3h"); they rarely stand alone for
  *why/outcome*. Outbound write-back lives behind the same interface, reserved for
  the assisted-action future.

---

## 10. UX Surfaces

1. **OKR tree / alignment map** — cascading Objective→KR→Initiative with roll-up +
   pace-to-target; CEO view drills down by department.
2. **My Work (daily capture)** — Initiatives + the one-line update box + the capture
   agent's confirm/correct chips. *Adoption lives or dies here — it must be fast.*
3. **Initiative timeline** — the reconstructed event trace for one Initiative
   (status, time, reasons, outcomes, signals) straight from the log.
4. **Insights inbox** — ranked Insights with evidence + ack/dismiss/action.
5. **Interventions & measurement** — declare a decision, pick affected KRs/window,
   see before/after when ready.
6. **AI-automation opportunities** — ranked candidate board with ROI estimates.
7. **Admin** — org/dept/team/people, roles, integration setup.

---

## 11. Auth, Roles, Security & Trust

- **Roles & visibility:**
  - **Admin** — org config, integrations, retention settings.
  - **Manager/Lead** — owns Objectives/KRs; sees their team's traces + insights.
  - **Member** — captures own work; sees own initiatives.
  - **Executive/Viewer** — reads roll-ups.
  - Default visibility: own + team upward. **Raw inputs** (original text) are
    access-controlled.
- **Auth:** session/JWT for v1, with optional **OIDC/SSO** (per-company B2B often
  requires it).
- **Audit:** the append-only event log doubles as the audit trail.
- **Trust framing (load-bearing for adoption *and* ethics):** the system captures
  performance-adjacent data, so it is explicitly positioned as an
  *efficiency/improvement* tool, **not** surveillance-for-punishment — with
  transparency to employees about what's captured, access limits, and a retention
  policy. Honest logging depends on this.
- **LLM data handling:** raw inputs are sent to the model provider; per-deployment
  provider/region configuration is supported. Default model family: **Claude
  (latest — Opus/Sonnet)**, small/fast model for extraction, stronger model for
  analysis.

---

## 12. Tech Stack (recommended defaults)

| Layer | Choice | Rationale |
|---|---|---|
| Backend | Node + TS, **NestJS** | Modules map 1:1 to bounded contexts; DI suits the repo pattern |
| DB access | **Drizzle** over Postgres | SQL-close; needed for jsonb + time-series window queries |
| Datastore | **Postgres only** | Append-only event table (jsonb, GIN + BRIN-on-`occurred_at`, monthly partitioning at scale); projections as plain tables; analytics via SQL window functions |
| Jobs | **pg-boss** (Postgres-backed) | Runs the AI worker without adding Redis per deployment; swap to BullMQ only if Redis already exists |
| Agents | **Mastra** (in worker) | Capture agent + four intelligence workflows; tools = DB-read + integration tools |
| LLM | **Claude (latest)** | Small model for extraction, stronger for analysis; per-deployment config |
| Frontend | React + TS + Vite, **tRPC** | End-to-end type safety; REST/OpenAPI facade can be added later |
| Auth | Session/JWT + optional **OIDC** | Per-company SSO support |
| Deploy | Docker, one stack per customer | Fits single-tenant-per-deployment; Drizzle migrations |

Monorepo via **Yarn workspaces**, mapped onto the existing `backend/`, `mastra_ai/`,
`frontend/`, `devops/` directories.

---

## 13. Phased Roadmap

Each phase is independently valuable and becomes its own spec → plan → build cycle.

| Phase | Delivers | Why this order |
|---|---|---|
| **0 — Foundations** | Monorepo, Postgres + migrations, `identity`, auth, UI shell | Nothing works without it |
| **1 — OKR core + manual tracking** | `okr` module, OKR tree, My Work, **event log + projections**, manual entry, Initiative timeline | A usable OKR tracker *and* it starts producing the substrate |
| **2 — AI-assisted capture** | Mastra capture agent, confirm/correct loop, reason taxonomy, feedback store | Logging gets cheap → data quality jumps |
| **3 — Intelligence v1** | Insight entity, bottleneck detection, optimization suggestions, Insights inbox | First real intelligence |
| **4 — Interventions & measurement** | Intervention entity, KR time-series measurement, measurement UI | The "did it work?" capability |
| **5 — AI-automation opportunities** | Candidate-flagging job + opportunities board | The AI-adoption deliverable |
| **6 — Integrations** | Connector framework + 2–3 connectors | Enrichment *after* native capture already yields fidelity |

**Principle:** the system *earns its data before it mines it* — a usable product by
Phase 1, a fast adoption win by Phase 2, heavy intelligence only once the substrate
exists.

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Capture friction kills adoption | AI-assisted capture prioritized at Phase 2; My Work surface optimized for speed |
| Employee-trust / surveillance perception | Explicit improvement-not-punishment framing, transparency, access controls, retention policy |
| Causal-inference overclaiming | Measurement job is humble — reports correlation + caveats, rough controls only |
| LLM cost / latency on capture | Small/fast model for extraction, batch + cache, escalate to stronger model only for analysis |
| Extraction accuracy cold-start | Confirmation loop + `FeedbackExample` few-shot store; conservative auto-commit threshold |
| Module boundaries eroding into a "big ball of mud" | Strict module isolation, communication only via event bus / event log |

---

## 15. Future / Deferred (seams already in place)

- **Assisted action** — the AI drafts/executes low-risk actions on approval (status
  updates, reassignments, kicking off an AI agent for a flagged task). Same connector
  interface, outbound direction.
- **Autonomous task execution** — Mastra agents run a subset of automatable
  initiatives end-to-end.
- **Separate Intelligence service** — extract the `intelligence` module + worker
  when scale/isolation demands it.
- **Analytics warehouse** — add an OLAP layer if a deployment's data volume outgrows
  Postgres analytics.
- **Multi-tenant SaaS** — only if the business model shifts from per-deployment.
