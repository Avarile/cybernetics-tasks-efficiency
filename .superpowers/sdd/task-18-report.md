# Task 18 Report: OKR Tree, My Work, Initiative Timeline UI

## Backend Timeline Endpoint

Added `GET /tracking/initiatives/:slug/timeline` to `tracking.controller.ts`:
- Injected `ActivityEventRepository` into the controller constructor.
- Resolves slug → initiative via `resolveInitiative` (404 if missing).
- Returns `activityEventRepo.listBySubject('initiative', ini.id, tenancy)` which already orders by `occurredAt ASC`.
- Guards: `@Roles(Role.member, Role.manager, Role.admin, Role.executive)`.
- `npx tsc --noEmit` clean; 22 backend tests pass (4 suites in module-tracking).

## Frontend Hooks (`frontend/src/lib/queries.ts`)

TanStack Query hooks built on the shared `createApiClient`:
- `useOkrTree(slug)` → GET `/okr/tree/:slug`
- `useMyInitiatives()` → POST `/initiatives/search` `{ ownerPersonId: user.id }`
- `useInitiativeTimeline(slug)` → GET `/tracking/initiatives/:slug/timeline`
- Mutations: `useStartInitiative`, `usePauseInitiative`, `useResumeInitiative`, `useBlockInitiative`, `useUnblockInitiative`, `useCompleteInitiative`, `useCancelInitiative`, `useLogTime`, `useRecordOutcome`, `useMeasureKr`
- All mutations invalidate `my-initiatives` + `initiative-timeline` on success.

## Frontend Components

### `KrProgressBar.tsx`
- Renders a bar at `progressPct * 100`% width using inline style.
- Pace color: behind → `bg-red-500`, on_track → `bg-amber-400`, ahead → `bg-green-500`.
- `data-testid="kr-bar"` for test targeting.

### `CaptureBar.tsx`
- Per-initiative one-click buttons: Start / Pause / Resume / Block / Complete.
- Inline expand-to-enter for Log Time (number input, save button) and Record Outcome (text input, save button).
- Buttons show/hide contextually based on `status` prop.

## Frontend Pages

### `OkrTree.tsx`
- Slug input form; loads tree on submit.
- Recursive `OkrTreeNode` component renders objective title, each KR with `KrProgressBar`, and nested children with indent + collapse toggle.

### `MyWork.tsx`
- Calls `useMyInitiatives()` for current user.
- Each initiative card shows title, status badge, `<CaptureBar />`, and a "Timeline" link → `/initiatives/:slug/timeline`.

### `InitiativeTimeline.tsx`
- Fetches via `useInitiativeTimeline(slug)` from route param.
- Vertical timeline list: icon, event label, formatted time, actor person ID, payload summary (minutes / result / reason / value).

## Routing

Router updated: added `/initiatives/:slug/timeline` route. AppShell nav already had OKR Tree and My Work links; timeline is deep-linked from MyWork.

## TDD (RED → GREEN)

### `KrProgressBar.test.tsx`
- RED: file didn't exist → test import failed.
- GREEN: 4 tests pass after implementing `KrProgressBar.tsx`.

### `queries.test.ts`
- RED: `queries.ts` didn't exist → test import failed.
- GREEN: 4 tests pass after implementing `queries.ts`; mocked `api-client` and `auth-context`.

## Test + Build Output

```
vitest run
✓ src/lib/api-client.test.ts (2 tests)
✓ src/components/KrProgressBar.test.tsx (4 tests)
✓ src/lib/queries.test.ts (4 tests)
Test Files: 3 passed (3)
Tests:      10 passed (10)

tsc && vite build
✓ 93 modules transformed
built in 1.19s
```

## Backend Jest + TSC

```
npx tsc --noEmit → clean (0 errors)
yarn jest src/modules/.../module-tracking → 22 passed, 4 suites
```

## Self-Review

- All spec requirements covered: OKR tree recursion, KR progress bars, CaptureBar single-click actions, My Work page, timeline vertical list.
- `ActivityEventRepository` was already provided in `TrackingModule` — no module changes needed, just constructor injection in the controller.
- Timeline endpoint returns events ordered by `occurredAt ASC` (enforced in the repo query).
- Frontend build is clean TypeScript — no `any` escapes except where the existing codebase used them (`(e as Error).message`).

## Concerns

- `@testing-library/dom` was missing from devDependencies; added it (`^10.4.1`). This was a pre-existing gap that blocked the React testing library from loading.
- The "force exited" worker warning in the backend integration spec is a pre-existing issue (database connection not fully torn down) — not introduced by this task.
- `useMyInitiatives` returns `{ items, total }` shaped by `IBaseQueryResult`; if the backend returns a plain array, the page would need adjustment. The type matches the brief's description.
- There is no pagination on My Work; first page only for Phase 1.
