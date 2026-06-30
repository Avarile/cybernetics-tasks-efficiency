# Frontend Phase 2 — Org Structure

## Goal

Add read-mostly org-structure capability: organization context loading, department/team/person/label stores and services, settings pages (members, teams, departments, labels), and common UI components. After this phase the app has a working `/:orgSlug/settings/*` area and the sidebar/header use real org data.

## Design Reference

`development/current_session/current_design` — authoritative for component inventory and route tree.

---

## Global Constraints

- All frontend changes are under `apps/web/` and `packages/types/`.
- Same naming conventions as Phase 1: `kebab-case.tsx`, `PascalCase` components, `domain.store.ts`, `domain.service.ts`.
- MobX: explicit `makeObservable` with annotated `observable`/`action`/`computed`. `observer` HOC from `mobx-react-lite`.
- Path alias `~/` → `apps/web/` root.
- No Co-Authored-By commit trailers.
- No files outside `apps/web/` and `packages/types/src/index.ts`.
- Verification: `cd apps/web && /home/avarile/.nvm/versions/node/v24.14.0/bin/pnpm exec tsc --noEmit` (pnpm is at that path, deps already installed).
- All API responses are wrapped: `{ data: <payload>, status_code, message, ... }`. The `APIService` interceptor (already in place) unwraps to `response.data` = payload automatically.
- YAGNI: only what the task specifies. No extra error handling, no speculative features.

---

## Backend API Contracts (verified)

| Entity | Key endpoints |
|--------|--------------|
| Organization | `GET /organizations/slug/:slug`, `PATCH /organizations/:id` |
| Department | `GET /departments/roots`, `GET /departments/:id/children`, `POST /departments`, `PATCH /departments/:id`, `DELETE /departments/:id` |
| Team | `GET /teams`, `GET /teams/:id/members`, `POST /teams`, `PATCH /teams/:id`, `DELETE /teams/:id` |
| Person | `GET /persons`, `POST /persons/search`, `POST /persons`, `PATCH /persons/:id`, `DELETE /persons/:id` |
| Label | `GET /labels`, `POST /labels`, `PATCH /labels/:id`, `DELETE /labels/:id` |

---

## Task 1 — Update types + create org-structure services

**Scope:** `packages/types/src/index.ts` updates + 5 new service files under `apps/web/core/services/`.

### Deliverables

**1. Update `packages/types/src/index.ts`** — add/update these interfaces (keep all existing exports untouched):

```ts
// Replace the existing IOrganization with the full backend shape:
export interface IOrganization {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Add IDepartment:
export interface IDepartment {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  leadPersonId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Add ITeam:
export interface ITeam {
  id: string;
  slug: string;
  name: string;
  departmentId?: string | null;
  leadPersonId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Replace the existing stub IPerson with the full backend shape:
export interface IPerson {
  id: string;
  slug: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  position?: string | null;
  departmentId?: string | null;
  teamId?: string | null;
  avatarUrl?: string | null;  // resolved by backend on profile reads
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Update ILabel to match backend (add parentId, sortOrder):
export interface ILabel {
  id: string;
  slug: string;
  name: string;
  color: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number | null;
  organizationId?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Also update `IAuthSession` — add `name?: string` field (backend returns it):
```ts
export interface IAuthSession {
  id: number;
  slug: string;
  name?: string;
  email: string;
  role: UserRole;
  departmentId?: number | null;
  teamId?: number | null;
}
```

**2. `apps/web/core/services/organization.service.ts`:**
```ts
import type { IOrganization } from "@cybernetic/types";
import { APIService } from "./api.service";

export class OrganizationService extends APIService {
  getBySlug(slug: string) {
    return this.get<IOrganization>(`/organizations/slug/${slug}`);
  }

  update(id: string, data: Partial<Pick<IOrganization, "name" | "description">>) {
    return this.patch<IOrganization>(`/organizations/${id}`, data);
  }
}
```

**3. `apps/web/core/services/department.service.ts`:**
```ts
import type { IDepartment } from "@cybernetic/types";
import { APIService } from "./api.service";

interface CreateDepartmentDto {
  name: string;
  description?: string;
  parentId?: string;
  leadPersonId?: string;
}

export class DepartmentService extends APIService {
  getRoots() {
    return this.get<IDepartment[]>("/departments/roots");
  }

  getChildren(id: string) {
    return this.get<IDepartment[]>(`/departments/${id}/children`);
  }

  create(data: CreateDepartmentDto) {
    return this.post<IDepartment>("/departments", data);
  }

  update(id: string, data: Partial<CreateDepartmentDto>) {
    return this.patch<IDepartment>(`/departments/${id}`, data);
  }

  remove(id: string) {
    return this.delete<null>(`/departments/${id}`);
  }
}
```

**4. `apps/web/core/services/team.service.ts`:**
```ts
import type { IPerson, ITeam } from "@cybernetic/types";
import { APIService } from "./api.service";

interface CreateTeamDto {
  name: string;
  departmentId?: string;
  leadPersonId?: string;
}

export class TeamService extends APIService {
  list() {
    return this.get<ITeam[]>("/teams");
  }

  getMembers(id: string) {
    return this.get<IPerson[]>(`/teams/${id}/members`);
  }

  create(data: CreateTeamDto) {
    return this.post<ITeam>("/teams", data);
  }

  update(id: string, data: Partial<CreateTeamDto>) {
    return this.patch<ITeam>(`/teams/${id}`, data);
  }

  remove(id: string) {
    return this.delete<null>(`/teams/${id}`);
  }
}
```

**5. `apps/web/core/services/person.service.ts`:**
```ts
import type { IPerson } from "@cybernetic/types";
import { APIService } from "./api.service";

interface SearchPersonDto {
  query: string;
  limit?: number;
}

export class PersonService extends APIService {
  list() {
    return this.get<IPerson[]>("/persons");
  }

  search(data: SearchPersonDto) {
    return this.post<IPerson[]>("/persons/search", data);
  }

  getBySlug(slug: string) {
    return this.get<IPerson>(`/persons/slug/${slug}`);
  }

  update(id: string, data: Partial<Pick<IPerson, "firstName" | "lastName" | "position" | "role">>) {
    return this.patch<IPerson>(`/persons/${id}`, data);
  }

  remove(id: string) {
    return this.delete<null>(`/persons/${id}`);
  }
}
```

**6. `apps/web/core/services/label.service.ts`:**
```ts
import type { ILabel } from "@cybernetic/types";
import { APIService } from "./api.service";

interface CreateLabelDto {
  name: string;
  color: string;
  description?: string;
}

export class LabelService extends APIService {
  list() {
    return this.get<ILabel[]>("/labels");
  }

  create(data: CreateLabelDto) {
    return this.post<ILabel>("/labels", data);
  }

  update(id: string, data: Partial<CreateLabelDto>) {
    return this.patch<ILabel>(`/labels/${id}`, data);
  }

  remove(id: string) {
    return this.delete<null>(`/labels/${id}`);
  }
}
```

### Verification

`tsc --noEmit` passes.

---

## Task 2 — Org stores + RootStore wiring

**Scope:** 5 new store files + update `RootStore` to include them.

### Deliverables

**1. `apps/web/core/store/organization/organization.store.ts`:**
```ts
import { action, makeObservable, observable } from "mobx";
import type { IOrganization } from "@cybernetic/types";
import { OrganizationService } from "~/core/services/organization.service";
import type { RootStore } from "../root.store";

const orgService = new OrganizationService();

export class OrganizationStore {
  currentOrg: IOrganization | null = null;
  isLoading = false;

  constructor(private root: RootStore) {
    makeObservable(this, {
      currentOrg: observable,
      isLoading: observable,
      setCurrentOrg: action,
      setLoading: action,
      fetchBySlug: action,
      reset: action,
    });
  }

  setCurrentOrg = (org: IOrganization | null) => {
    this.currentOrg = org;
  };

  setLoading = (v: boolean) => {
    this.isLoading = v;
  };

  fetchBySlug = async (slug: string) => {
    if (this.currentOrg?.slug === slug) return;
    this.setLoading(true);
    try {
      const { data } = await orgService.getBySlug(slug);
      this.setCurrentOrg(data);
    } finally {
      this.setLoading(false);
    }
  };

  reset = () => {
    this.currentOrg = null;
    this.isLoading = false;
  };
}
```

**2. `apps/web/core/store/department/department.store.ts`:**
- `deptMap: Record<string, IDepartment>` observable
- `rootDeptIds: string[]` observable (IDs of root departments)
- `childMap: Record<string, string[]>` observable (parentId → child IDs)
- `isLoading: boolean` observable
- `action fetchRoots()`: calls `deptService.getRoots()`, populates `deptMap` and `rootDeptIds`
- `action fetchChildren(id: string)`: calls `deptService.getChildren(id)`, adds to `deptMap` and `childMap`
- `computed get rootDepts(): IDepartment[]`: maps `rootDeptIds` through `deptMap`
- `action reset()`: clears all state

**3. `apps/web/core/store/team/team.store.ts`:**
- `teamMap: Record<string, ITeam>` observable
- `teamIds: string[]` observable
- `memberMap: Record<string, IPerson[]>` observable (teamId → members)
- `isLoading: boolean` observable
- `action fetchTeams()`: calls `teamService.list()`, populates map and ids
- `action fetchMembers(id: string)`: calls `teamService.getMembers(id)`, populates `memberMap`
- `computed get teams(): ITeam[]`: maps `teamIds` through `teamMap`
- `action reset()`

**4. `apps/web/core/store/person/person.store.ts`:**
- `personMap: Record<string, IPerson>` observable
- `personIds: string[]` observable
- `isLoading: boolean` observable
- `action fetchPersons()`: calls `personService.list()`, populates map + ids
- `action searchPersons(query: string)`: calls `personService.search({ query })`, returns results (does NOT mutate global map)
- `computed get persons(): IPerson[]`
- `action reset()`

**5. `apps/web/core/store/label/label.store.ts`:**
- `labelMap: Record<string, ILabel>` observable
- `labelIds: string[]` observable
- `isLoading: boolean` observable
- `action fetchLabels()`: calls `labelService.list()`, populates map + ids
- `computed get labels(): ILabel[]`
- `action reset()`

**6. Update `apps/web/core/store/root.store.ts`** — import and add all 5 stores:
```ts
import { AuthStore } from "./auth/auth.store";
import { DepartmentStore } from "./department/department.store";
import { LabelStore } from "./label/label.store";
import { OrganizationStore } from "./organization/organization.store";
import { PersonStore } from "./person/person.store";
import { TeamStore } from "./team/team.store";
import { ThemeStore } from "./theme/theme.store";

export class RootStore {
  auth: AuthStore;
  department: DepartmentStore;
  label: LabelStore;
  org: OrganizationStore;
  person: PersonStore;
  team: TeamStore;
  theme: ThemeStore;

  constructor() {
    this.auth = new AuthStore(this);
    this.department = new DepartmentStore(this);
    this.label = new LabelStore(this);
    this.org = new OrganizationStore(this);
    this.person = new PersonStore(this);
    this.team = new TeamStore(this);
    this.theme = new ThemeStore(this);
  }

  resetOnSignOut() {
    this.auth.reset();
    this.department.reset();
    this.label.reset();
    this.org.reset();
    this.person.reset();
    this.team.reset();
    this.theme.reset();
  }
}
```

### Verification

`tsc --noEmit` passes.

---

## Task 3 — Route structure: `/:orgSlug` parent + settings shell

**Scope:** Update `routes.ts`, create `app/layouts/org.tsx`, `app/layouts/settings.tsx`, and stub `app/routes/home.tsx` redirect. Update `OrgHeader` to use real org name.

### Deliverables

**1. `app/layouts/org.tsx`** — loads org by slug, renders `<Outlet />`:
```tsx
import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { Outlet, useParams } from "react-router";
import { LoadingSpinner } from "~/core/components/common/loading-spinner";
import { useStore } from "~/core/hooks/use-store";

const OrgLayout = observer(() => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { org } = useStore();

  useEffect(() => {
    if (orgSlug) org.fetchBySlug(orgSlug);
  }, [orgSlug]);

  if (org.isLoading && !org.currentOrg) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <Outlet />;
});

export default OrgLayout;
```

**2. `app/layouts/settings.tsx`** — settings shell with tab navigation:
```tsx
import { NavLink, Outlet } from "react-router";
import { useParams } from "react-router";

const TABS = [
  { label: "Members", path: "members" },
  { label: "Teams", path: "teams" },
  { label: "Departments", path: "departments" },
  { label: "Labels", path: "labels" },
];

export default function SettingsLayout() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Settings</h1>
      <div className="flex gap-1 border-b border-gray-200 mb-8">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={`/${orgSlug}/settings/${tab.path}`}
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
```

**3. Update `app/routes/home.tsx`** — replace dashboard stub with a redirect to settings (temporary until dashboard is built in Phase 4; for now redirect to `/`):
Keep as-is (dashboard stub). No change needed — the dashboard stub at `/` is fine.

**4. Update `app/routes.ts`** — add `/:orgSlug` parent with settings subroutes:
```ts
import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("layouts/auth.tsx", [
    route("auth/sign-in", "routes/auth/sign-in.tsx"),
  ]),
  layout("layouts/authenticated.tsx", [
    index("routes/home.tsx"),
    route(":orgSlug", "layouts/org.tsx", [
      route("settings", "layouts/settings.tsx", [
        route("members", "routes/settings/members.tsx"),
        route("teams", "routes/settings/teams.tsx"),
        route("departments", "routes/settings/departments.tsx"),
        route("labels", "routes/settings/labels.tsx"),
      ]),
    ]),
  ]),
] satisfies RouteConfig;
```

**5. Update `apps/web/core/components/layout/org-header.tsx`** — show real org name from `org.currentOrg?.name` instead of hardcoded "Cybernetic":
- Import `org` from `useStore()`
- Replace hardcoded `"Cybernetic"` with `org.currentOrg?.name ?? "Cybernetic"`

### Verification

`tsc --noEmit` passes.

---

## Task 4 — Common UI components

**Scope:** 4 new reusable components in `apps/web/core/components/common/`.

### Deliverables

**1. `apps/web/core/components/common/empty-state.tsx`:**
```tsx
interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3 className="text-sm font-medium text-gray-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      {action}
    </div>
  );
}
```

**2. `apps/web/core/components/common/status-badge.tsx`:**
```tsx
type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-yellow-100 text-yellow-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
};

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function StatusBadge({ label, variant = "default" }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]}`}>
      {label}
    </span>
  );
}
```

**3. `apps/web/core/components/common/slug-badge.tsx`:**
```tsx
interface SlugBadgeProps {
  id: string;        // e.g. "TASK-123"
}

export function SlugBadge({ id }: SlugBadgeProps) {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono font-medium bg-gray-100 text-gray-600">
      {id}
    </span>
  );
}
```

**4. `apps/web/core/components/common/search-input.tsx`:**
```tsx
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SearchInputProps {
  placeholder?: string;
  onSearch: (value: string) => void;
  debounceMs?: number;
  className?: string;
}

export function SearchInput({ placeholder = "Search...", onSearch, debounceMs = 300, className = "" }: SearchInputProps) {
  const [value, setValue] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(value), debounceMs);
    return () => clearTimeout(timer.current);
  }, [value, debounceMs, onSearch]);

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}
```

### Verification

`tsc --noEmit` passes.

---

## Task 5 — Settings: Members page

**Scope:** `MemberList` component + `/settings/members` route + stub `apps/web/app/routes/settings/` directory.

### Deliverables

**1. `apps/web/core/components/settings/member-list.tsx`:**
- `observer` component
- Uses `useStore()` to access `person` store
- `useEffect` calls `person.fetchPersons()` on mount
- Shows `SearchInput` at top (filters displayed list client-side by name/email)
- Table columns: Name (PersonAvatar + full name), Email, Role (StatusBadge), Department, Actions (if `can("manager")`)
- Shows `LoadingSpinner` while `person.isLoading && !person.persons.length`
- Shows `EmptyState` if no persons
- `StatusBadge` variant for role: `admin` → "danger", `manager` → "info", `executive` → "warning", `member` → "default"
- Role displayed as human label: `admin` → "Admin", `manager` → "Manager", `executive` → "Executive", `member` → "Member"

**2. `apps/web/app/routes/settings/members.tsx`:**
```tsx
import { MemberList } from "~/core/components/settings/member-list";

export default function MembersPage() {
  return <MemberList />;
}
```

### Verification

`tsc --noEmit` passes.

---

## Task 6 — Settings: Teams + Departments pages

**Scope:** `TeamList`, `DepartmentTree` components + their routes.

### Deliverables

**1. `apps/web/core/components/settings/team-list.tsx`:**
- `observer` component
- Uses `team` store — calls `team.fetchTeams()` on mount
- Displays teams in a table: Name, Department (from `deptMap` if available or just the ID), Lead (person lookup), member count
- Each row has an expand/collapse toggle (local `useState` set) that calls `team.fetchMembers(id)` and shows member avatars below the row
- Shows `EmptyState` if no teams

**2. `apps/web/app/routes/settings/teams.tsx`:**
```tsx
import { TeamList } from "~/core/components/settings/team-list";

export default function TeamsPage() {
  return <TeamList />;
}
```

**3. `apps/web/core/components/settings/department-tree.tsx`:**
- `observer` component
- Uses `department` store — calls `department.fetchRoots()` on mount
- Renders a recursive tree. Start with `department.rootDepts`.
- Each node shows: dept name, lead person name (if `leadPersonId` available — just show ID for now since full person lookup is Phase 2 extra work), expand button if it might have children.
- Clicking expand calls `department.fetchChildren(id)` and shows children.
- Use local `useState` for `expandedIds: Set<string>`.
- Children are fetched lazily on first expand.

**4. `apps/web/app/routes/settings/departments.tsx`:**
```tsx
import { DepartmentTree } from "~/core/components/settings/department-tree";

export default function DepartmentsPage() {
  return <DepartmentTree />;
}
```

### Verification

`tsc --noEmit` passes.

---

## Task 7 — Settings: Labels page

**Scope:** `LabelList` component + route.

### Deliverables

**1. `apps/web/core/components/settings/label-list.tsx`:**
- `observer` component
- Uses `label` store — calls `label.fetchLabels()` on mount
- Displays labels in a grid/list: color swatch + name + description
- Color swatch: `<div style={{ backgroundColor: label.color }}` with `h-4 w-4 rounded-full`
- Shows `EmptyState` if no labels
- `usePermissions()` — show "Add label" button placeholder (non-functional) only if `can("manager")`

**2. `apps/web/app/routes/settings/labels.tsx`:**
```tsx
import { LabelList } from "~/core/components/settings/label-list";

export default function LabelsPage() {
  return <LabelList />;
}
```

### Verification

`tsc --noEmit` passes. Final commit message: `feat(frontend): Phase 2 complete — org structure, settings pages`

---

## Summary

| Task | Scope | Key files |
|------|-------|-----------|
| 1 | Types update + 5 services | `packages/types`, 5 service files |
| 2 | 5 stores + RootStore update | 5 store files + root.store.ts |
| 3 | Route structure + org layout + OrgHeader update | routes.ts, org.tsx, settings.tsx, org-header.tsx |
| 4 | 4 common components | empty-state, status-badge, slug-badge, search-input |
| 5 | Members settings page | member-list.tsx + route |
| 6 | Teams + Departments settings pages | team-list.tsx, department-tree.tsx + routes |
| 7 | Labels settings page | label-list.tsx + route |
