# Frontend Phase 1 — Foundation

## Goal

Scaffold the new monorepo-based frontend that replaces the existing `frontend/` prototype.
Delivers: working auth flow (sign-in → dashboard shell), MobX store architecture, API service layer, and app shell (sidebar + header). The existing `frontend/` directory is left untouched (do not delete it).

## Design Reference

`development/current_session/current_design` — read it for every detail not spelled out here.

---

## Global Constraints

- **Monorepo**: `apps/web/` + `packages/ui` + `packages/types` + `packages/utils`; managed with `pnpm`. Root `pnpm-workspace.yaml` and updated root `package.json` (remove yarn `workspaces` field, add `packageManager: "pnpm@11"` only — no other root-level changes needed).
- **Package versions (exact)**: React 19, React Router 7, MobX 6.12, MobX-React-Lite 4, Tailwind CSS 4, Vite 8, SWR 2, Axios 1, TypeScript 5.8, pnpm 11, Headless UI 2 (v1.7 is incompatible with React 19 — use 2.x), Lucide React 0.469, date-fns 3.
- **State management**: MobX with `makeObservable` classes + `mobx-react-lite` `observer` HOC. No React Query. No Redux.
- **Routing**: React Router v7 framework mode, `ssr: false`. Use `@react-router/dev` Vite plugin.
- **Tailwind 4**: Uses `@tailwindcss/vite` plugin (not PostCSS). CSS entry imports `@import "tailwindcss"`.
- **File naming**: `kebab-case.tsx/.ts` for files, `PascalCase` for exported components, `useCamelCase` for hooks files (`use-store.ts`), `domain.store.ts` for stores, `domain.service.ts` for services.
- **Path alias**: `~/` resolves to `apps/web/` root (React Router v7 convention). In tsconfig: `"~/*": ["./*"]`. In vite config: `"~": path.resolve(__dirname, ".")`.
- **No comments** unless the WHY is non-obvious. No multi-line docstrings.
- **TypeScript**: strict mode. No `any` except when unavoidable (mark with `// eslint-disable-line @typescript-eslint/no-explicit-any`).
- **Verification**: after every task, run `cd apps/web && pnpm exec tsc --noEmit` from the repo root. A passing `tsc` is the acceptance test for each task (no running server needed). If `pnpm` isn't installed yet (Task 1), skip tsc and just verify files exist.
- **No deleting `frontend/`**: the old prototype stays untouched.
- **No commit Co-Authored-By trailer**.

---

## Task 1 — Monorepo root + package stubs

**Scope:** Root config + stub packages. No apps/web yet.

### Deliverables

1. `pnpm-workspace.yaml` at repo root:
   ```yaml
   packages:
     - "apps/*"
     - "packages/*"
     - "backend"
   ```

2. Root `package.json` — update to remove the `workspaces` yarn field, add `packageManager`:
   ```json
   {
     "name": "cybernetic",
     "private": true,
     "packageManager": "pnpm@11.0.0"
   }
   ```

3. `packages/types/package.json`:
   ```json
   {
     "name": "@cybernetic/types",
     "version": "0.0.1",
     "private": true,
     "main": "./src/index.ts",
     "types": "./src/index.ts"
   }
   ```

4. `packages/types/tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ESNext",
       "module": "ESNext",
       "moduleResolution": "Bundler",
       "strict": true,
       "declaration": true,
       "outDir": "./dist"
     },
     "include": ["src"]
   }
   ```

5. `packages/types/src/index.ts` — core shared interfaces:
   ```ts
   export type UserRole = 'admin' | 'manager' | 'exec' | 'member';

   export interface IPerson {
     id: string;
     email: string;
     firstName: string;
     lastName: string;
     role: UserRole;
     organizationId: string;
     avatarUrl?: string;
   }

   export interface IOrganization {
     id: string;
     name: string;
     slug: string;
   }

   export interface IObjective {
     id: string;
     slug: string;
     title: string;
     ownerId: string;
     progress: number;
     status: string;
   }

   export interface IInitiative {
     id: string;
     slug: string;
     title: string;
     status: string;
     taskCount?: number;
   }

   export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';
   export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled';

   export interface ITask {
     id: string;
     slug: string;
     sequenceId: number;
     title: string;
     status: TaskStatus;
     priority: TaskPriority;
     initiativeId?: string;
     parentId?: string;
     assignees: IPerson[];
     labels: ILabel[];
   }

   export interface ILabel {
     id: string;
     name: string;
     color: string;
     organizationId: string;
   }

   export interface IKeyResult {
     id: string;
     slug: string;
     title: string;
     startValue: number;
     targetValue: number;
     currentValue: number;
     objectiveId: string;
   }

   export interface IKnowledge {
     id: string;
     slug: string;
     title: string;
     body: string;
     visibility: 'private' | 'shared' | 'organization';
     ownerId: string;
   }

   export interface IApiError {
     statusCode: number;
     message: string;
     error?: string;
   }
   ```

6. `packages/ui/package.json`:
   ```json
   {
     "name": "@cybernetic/ui",
     "version": "0.0.1",
     "private": true,
     "main": "./src/index.ts",
     "types": "./src/index.ts",
     "peerDependencies": {
       "react": "^19.0.0",
       "react-dom": "^19.0.0"
     }
   }
   ```

7. `packages/ui/tsconfig.json` — same as types tsconfig.

8. `packages/ui/src/index.ts` — empty stub: `export {};`

9. `packages/utils/package.json`:
   ```json
   {
     "name": "@cybernetic/utils",
     "version": "0.0.1",
     "private": true,
     "main": "./src/index.ts",
     "types": "./src/index.ts"
   }
   ```

10. `packages/utils/tsconfig.json` — same as types tsconfig.

11. `packages/utils/src/index.ts` — a few initial utilities:
    ```ts
    export function slugify(text: string): string {
      return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    }

    export function formatDate(date: string | Date): string {
      return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(
        typeof date === 'string' ? new Date(date) : date
      );
    }

    export function initials(firstName: string, lastName: string): string {
      return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
    }
    ```

### Verification

Files exist at the expected paths. No tsc check needed for this task (no tsconfig at root level with paths to check yet).

---

## Task 2 — apps/web project scaffold

**Scope:** Vite + React Router v7 + Tailwind 4 + TypeScript project config for `apps/web`. No application code yet — just the build configuration that makes `pnpm exec tsc --noEmit` pass on an empty project and `pnpm build` succeed.

### Deliverables

1. `apps/web/package.json`:
   ```json
   {
     "name": "@cybernetic/web",
     "version": "0.0.1",
     "private": true,
     "type": "module",
     "scripts": {
       "dev": "react-router dev",
       "build": "react-router build",
       "typecheck": "tsc --noEmit",
       "test": "vitest run"
     },
     "dependencies": {
       "@cybernetic/types": "workspace:*",
       "@cybernetic/ui": "workspace:*",
       "@cybernetic/utils": "workspace:*",
       "@headlessui/react": "^2.2.0",
       "axios": "^1.7.0",
       "date-fns": "^3.6.0",
       "lucide-react": "^0.469.0",
       "mobx": "^6.12.0",
       "mobx-react-lite": "^4.0.7",
       "react": "^19.0.0",
       "react-dom": "^19.0.0",
       "react-hook-form": "^7.53.0",
       "react-router": "^7.0.0",
       "swr": "^2.2.0"
     },
     "devDependencies": {
       "@react-router/dev": "^7.0.0",
       "@tailwindcss/vite": "^4.0.0",
       "@testing-library/jest-dom": "^6.6.0",
       "@testing-library/react": "^16.3.0",
       "@types/react": "^19.0.0",
       "@types/react-dom": "^19.0.0",
       "jsdom": "^25.0.0",
       "tailwindcss": "^4.0.0",
       "typescript": "^5.8.0",
       "vite": "^8.0.0",
       "vitest": "^2.1.0"
     }
   }
   ```

2. `apps/web/tsconfig.json`:
   ```json
   {
     "include": ["**/*.ts", "**/*.tsx", ".react-router/types/**/*"],
     "compilerOptions": {
       "lib": ["ES2022", "DOM", "DOM.Iterable"],
       "types": ["vite/client"],
       "isolatedModules": true,
       "esModuleInterop": true,
       "jsx": "react-jsx",
       "module": "ESNext",
       "moduleResolution": "Bundler",
       "resolvePackageJsonExports": true,
       "target": "ES2022",
       "strict": true,
       "allowJs": false,
       "skipLibCheck": true,
       "baseUrl": ".",
       "paths": {
         "~/*": ["./*"]
       },
       "noEmit": true,
       "rootDirs": [".", "./.react-router/types"]
     }
   }
   ```

3. `apps/web/vite.config.ts`:
   ```ts
   import { reactRouter } from "@react-router/dev/vite";
   import tailwindcss from "@tailwindcss/vite";
   import path from "node:path";
   import { defineConfig } from "vite";

   export default defineConfig({
     plugins: [tailwindcss(), reactRouter()],
     resolve: {
       alias: {
         "~": path.resolve(__dirname, "."),
       },
     },
   });
   ```

4. `apps/web/react-router.config.ts`:
   ```ts
   import type { Config } from "@react-router/dev/config";
   export default { ssr: false } satisfies Config;
   ```

5. `apps/web/index.html`:
   ```html
   <!DOCTYPE html>
   <html lang="en">
     <head>
       <meta charset="UTF-8" />
       <meta name="viewport" content="width=device-width, initial-scale=1.0" />
       <title>Cybernetic</title>
     </head>
     <body>
       <div id="root"></div>
     </body>
   </html>
   ```

6. `apps/web/app/styles/globals.css`:
   ```css
   @import "tailwindcss";
   ```

7. **Minimal `app/root.tsx`** (placeholder — will be replaced in Task 7 with full wiring):
   ```tsx
   import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
   import "./styles/globals.css";

   export default function Root() {
     return (
       <html lang="en">
         <head>
           <meta charSet="utf-8" />
           <meta name="viewport" content="width=device-width, initial-scale=1" />
           <Meta />
           <Links />
         </head>
         <body>
           <Outlet />
           <ScrollRestoration />
           <Scripts />
         </body>
       </html>
     );
   }
   ```

8. **Minimal `app/routes.ts`** (placeholder — will be replaced in Task 7):
   ```ts
   import type { RouteConfig } from "@react-router/dev/routes";
   export default [] satisfies RouteConfig;
   ```

9. **`app/entry.client.tsx`** (placeholder — will be completed in Task 7):
   ```tsx
   import { startTransition, StrictMode } from "react";
   import { hydrateRoot } from "react-dom/client";
   import { HydratedRouter } from "react-router/dom";

   startTransition(() => {
     hydrateRoot(
       document,
       <StrictMode>
         <HydratedRouter />
       </StrictMode>
     );
   });
   ```

### Verification

`cd apps/web && pnpm exec tsc --noEmit` passes (after `pnpm install` at repo root). If pnpm is not yet available in the environment, verify file contents are syntactically correct.

---

## Task 3 — MobX store layer

**Scope:** Root store, auth store, theme store, and the `useStore` hook. All within `apps/web/`.

### Deliverables

1. `apps/web/core/store/root.store.ts`:
   ```ts
   import { AuthStore } from "./auth/auth.store";
   import { ThemeStore } from "./theme/theme.store";

   export class RootStore {
     auth: AuthStore;
     theme: ThemeStore;

     constructor() {
       this.auth = new AuthStore(this);
       this.theme = new ThemeStore(this);
     }

     resetOnSignOut() {
       this.auth.reset();
       this.theme.reset();
     }
   }
   ```

2. `apps/web/core/store/auth/auth.store.ts`:
   ```ts
   import { action, computed, makeObservable, observable } from "mobx";
   import type { IPerson } from "@cybernetic/types";
   import type { RootStore } from "../root.store";

   export class AuthStore {
     currentUser: IPerson | null = null;
     isLoading = false;
     token: string | null = null;

     constructor(private root: RootStore) {
       makeObservable(this, {
         currentUser: observable,
         isLoading: observable,
         token: observable,
         isAuthenticated: computed,
         setCurrentUser: action,
         setToken: action,
         setLoading: action,
         reset: action,
       });
     }

     get isAuthenticated(): boolean {
       return !!this.currentUser;
     }

     setCurrentUser = (user: IPerson | null) => {
       this.currentUser = user;
     };

     setToken = (token: string | null) => {
       this.token = token;
       if (token) {
         localStorage.setItem("auth_token", token);
       } else {
         localStorage.removeItem("auth_token");
       }
     };

     setLoading = (loading: boolean) => {
       this.isLoading = loading;
     };

     reset = () => {
       this.currentUser = null;
       this.token = null;
       localStorage.removeItem("auth_token");
     };

     hydrateToken = () => {
       const stored = localStorage.getItem("auth_token");
       if (stored) this.token = stored;
     };
   }
   ```

3. `apps/web/core/store/theme/theme.store.ts`:
   ```ts
   import { action, makeObservable, observable } from "mobx";
   import type { RootStore } from "../root.store";

   export type ThemeMode = "light" | "dark";

   export class ThemeStore {
     mode: ThemeMode = "light";

     constructor(private root: RootStore) {
       makeObservable(this, {
         mode: observable,
         toggle: action,
         setMode: action,
         reset: action,
       });
       this.mode = (localStorage.getItem("theme") as ThemeMode) ?? "light";
     }

     toggle = () => {
       this.mode = this.mode === "light" ? "dark" : "light";
       localStorage.setItem("theme", this.mode);
       document.documentElement.classList.toggle("dark", this.mode === "dark");
     };

     setMode = (mode: ThemeMode) => {
       this.mode = mode;
       localStorage.setItem("theme", mode);
       document.documentElement.classList.toggle("dark", mode === "dark");
     };

     reset = () => {
       this.mode = "light";
       localStorage.removeItem("theme");
       document.documentElement.classList.remove("dark");
     };
   }
   ```

4. `apps/web/core/hooks/use-store.ts`:
   ```ts
   import { createContext, useContext } from "react";
   import type { RootStore } from "~/core/store/root.store";

   export const StoreContext = createContext<RootStore | null>(null);

   export const useStore = (): RootStore => {
     const store = useContext(StoreContext);
     if (!store) throw new Error("useStore must be used within StoreProvider");
     return store;
   };
   ```

5. `apps/web/core/hooks/use-permissions.ts`:
   ```ts
   import { useStore } from "./use-store";

   const ROLE_RANK: Record<string, number> = {
     admin: 4,
     manager: 3,
     exec: 2,
     member: 1,
   };

   export const usePermissions = () => {
     const { auth } = useStore();
     const role = auth.currentUser?.role ?? "member";

     return {
       isAdmin: role === "admin",
       isManager: ROLE_RANK[role] >= ROLE_RANK["manager"],
       isExec: ROLE_RANK[role] >= ROLE_RANK["exec"],
       can: (minRole: string) => ROLE_RANK[role] >= (ROLE_RANK[minRole] ?? 0),
     };
   };
   ```

### Verification

`cd apps/web && pnpm exec tsc --noEmit` (run from repo root as `cd apps/web && pnpm exec tsc --noEmit`).

---

## Task 4 — Service layer

**Scope:** `APIService` base class and `AuthService`.

### Deliverables

1. `apps/web/core/services/api.service.ts`:
   ```ts
   import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";

   const BASE_URL = `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001"}/api/v1`;

   export class APIService {
     protected axiosInstance: AxiosInstance;

     constructor(baseURL: string = BASE_URL) {
       this.axiosInstance = axios.create({
         baseURL,
         withCredentials: true,
       });

       this.axiosInstance.interceptors.request.use((config) => {
         const token = localStorage.getItem("auth_token");
         if (token) {
           config.headers.Authorization = `Bearer ${token}`;
         }
         return config;
       });
     }

     get<T>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig) {
       return this.axiosInstance.get<T>(url, { params, ...config });
     }

     post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
       return this.axiosInstance.post<T>(url, data, config);
     }

     patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
       return this.axiosInstance.patch<T>(url, data, config);
     }

     put<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
       return this.axiosInstance.put<T>(url, data, config);
     }

     delete<T>(url: string, config?: AxiosRequestConfig) {
       return this.axiosInstance.delete<T>(url, config);
     }
   }
   ```

2. `apps/web/core/services/auth.service.ts`:
   ```ts
   import type { IPerson } from "@cybernetic/types";
   import { APIService } from "./api.service";

   interface LoginResponse {
     accessToken: string;
     person: IPerson;
   }

   export class AuthService extends APIService {
     login(email: string, password: string) {
       return this.post<LoginResponse>("/auth/login", { email, password });
     }

     logout() {
       return this.post<void>("/auth/logout");
     }

     me() {
       return this.get<IPerson>("/auth/me");
     }

     refresh() {
       return this.post<LoginResponse>("/auth/refresh");
     }
   }
   ```

### Verification

`cd apps/web && pnpm exec tsc --noEmit`.

---

## Task 5 — Auth components

**Scope:** `SignInForm`, `AuthLayout`, `AuthGuard`. These are the auth entry point — connecting the form to `AuthStore` via `AuthService`.

### Design details

- `SignInForm` uses React Hook Form for validation, calls `authService.login()`, stores token + user in `AuthStore`, then navigates to `/`.
- `AuthGuard` wraps authenticated routes: if `auth.isLoading`, show spinner; if `!auth.isAuthenticated`, redirect to `/auth/sign-in`.
- `AuthLayout` is a centered-card wrapper (Tailwind: `min-h-screen flex items-center justify-center bg-gray-50`).

### Deliverables

1. `apps/web/core/components/common/loading-spinner.tsx`:
   ```tsx
   export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
     const dims = { sm: "h-4 w-4", md: "h-8 w-8", lg: "h-12 w-12" }[size];
     return (
       <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${dims}`} />
     );
   }
   ```

2. `apps/web/core/components/auth/auth-layout.tsx`:
   ```tsx
   interface AuthLayoutProps {
     children: React.ReactNode;
     title: string;
   }

   export function AuthLayout({ children, title }: AuthLayoutProps) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
         <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8">
           <h1 className="text-2xl font-semibold text-gray-900 mb-6">{title}</h1>
           {children}
         </div>
       </div>
     );
   }
   ```

3. `apps/web/core/components/auth/sign-in-form.tsx` — full implementation:
   - Imports: `useForm` from react-hook-form, `useStore`, `AuthService` (instantiated once), `useNavigate` from react-router.
   - Fields: `email` (required, valid email pattern), `password` (required, minLength 6).
   - On submit: calls `auth.setLoading(true)`, calls `authService.login()`, on success stores token (`auth.setToken`) and user (`auth.setCurrentUser`), navigates to `/`, on error shows error message below form, always `auth.setLoading(false)`.
   - Tailwind-styled: label + input pairs, red error text, submit button with loading state.

4. `apps/web/core/components/auth/auth-guard.tsx`:
   ```tsx
   import { observer } from "mobx-react-lite";
   import { Navigate } from "react-router";
   import { LoadingSpinner } from "~/core/components/common/loading-spinner";
   import { useStore } from "~/core/hooks/use-store";

   export const AuthGuard = observer(({ children }: { children: React.ReactNode }) => {
     const { auth } = useStore();

     if (auth.isLoading) {
       return (
         <div className="min-h-screen flex items-center justify-center">
           <LoadingSpinner size="lg" />
         </div>
       );
     }

     if (!auth.isAuthenticated) {
       return <Navigate to="/auth/sign-in" replace />;
     }

     return <>{children}</>;
   });
   ```

### Verification

`cd apps/web && pnpm exec tsc --noEmit`.

---

## Task 6 — App shell layout components

**Scope:** `AppSidebar`, `OrgHeader`, `PageContainer`. These form the authenticated-area shell visible on all protected pages.

### Design details (from the design doc)

- `AppSidebar`: collapsible left nav, links to `/[orgSlug]/dashboard`, `/[orgSlug]/objectives`, `/[orgSlug]/initiatives`, `/[orgSlug]/tasks`, `/[orgSlug]/knowledge`. Uses Lucide icons. Active link highlighted. Collapse toggle stored in local state.
- `OrgHeader`: displays org name (from `auth.currentUser?.organizationId` — placeholder until OrgStore exists), user avatar/initials, theme toggle button.
- `PageContainer`: `max-w-7xl mx-auto px-6 py-8` wrapper with optional `title` prop.

### Deliverables

1. `apps/web/core/components/common/person-avatar.tsx`:
   ```tsx
   import { initials } from "@cybernetic/utils";

   interface PersonAvatarProps {
     firstName: string;
     lastName: string;
     avatarUrl?: string;
     size?: "sm" | "md" | "lg";
   }

   const sizeClasses = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-12 w-12 text-base" };

   export function PersonAvatar({ firstName, lastName, avatarUrl, size = "md" }: PersonAvatarProps) {
     const cls = sizeClasses[size];
     if (avatarUrl) {
       return <img src={avatarUrl} alt={`${firstName} ${lastName}`} className={`${cls} rounded-full object-cover`} />;
     }
     return (
       <div className={`${cls} rounded-full bg-blue-600 flex items-center justify-center text-white font-medium`}>
         {initials(firstName, lastName)}
       </div>
     );
   }
   ```

2. `apps/web/core/components/layout/page-container.tsx`:
   ```tsx
   interface PageContainerProps {
     children: React.ReactNode;
     title?: string;
   }

   export function PageContainer({ children, title }: PageContainerProps) {
     return (
       <div className="max-w-7xl mx-auto px-6 py-8">
         {title && <h1 className="text-2xl font-semibold text-gray-900 mb-6">{title}</h1>}
         {children}
       </div>
     );
   }
   ```

3. `apps/web/core/components/layout/org-header.tsx` — observer component:
   - Uses `useStore` to get `auth.currentUser` and `theme`.
   - Renders: org name placeholder (hardcoded "Cybernetic" for now), `PersonAvatar`, theme toggle button (sun/moon Lucide icon).

4. `apps/web/core/components/layout/app-sidebar.tsx` — observer component:
   - Uses `useStore`, `useParams` from react-router to get `orgSlug`.
   - Nav links use `NavLink` from react-router with `className` callback for active state.
   - Icons: `LayoutDashboard`, `Target`, `Rocket`, `CheckSquare`, `BookOpen` from lucide-react.
   - Collapse toggle: local `useState` for `isCollapsed`. When collapsed, show only icons; when expanded show icon + label.
   - Outer div: `flex flex-col h-full bg-gray-900 text-white transition-all` with `w-56` expanded / `w-14` collapsed.

### Verification

`cd apps/web && pnpm exec tsc --noEmit`.

---

## Task 7 — Route wiring + providers + auth route + dashboard stub

**Scope:** Wire everything together: `StoreProvider`, route config, authenticated layout, sign-in route, dashboard stub page.

### Deliverables

1. `apps/web/app/provider.tsx` — `StoreProvider`:
   ```tsx
   import { createContext, useMemo, type ReactNode } from "react";
   import { RootStore } from "~/core/store/root.store";
   import { StoreContext } from "~/core/hooks/use-store";

   export function StoreProvider({ children }: { children: ReactNode }) {
     const store = useMemo(() => {
       const s = new RootStore();
       s.auth.hydrateToken();
       return s;
     }, []);

     return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
   }
   ```

2. **Update `apps/web/app/root.tsx`** — wrap Outlet in StoreProvider:
   ```tsx
   import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
   import { StoreProvider } from "./provider";
   import "./styles/globals.css";

   export default function Root() {
     return (
       <html lang="en">
         <head>
           <meta charSet="utf-8" />
           <meta name="viewport" content="width=device-width, initial-scale=1" />
           <Meta />
           <Links />
         </head>
         <body className="bg-white text-gray-900 antialiased">
           <StoreProvider>
             <Outlet />
           </StoreProvider>
           <ScrollRestoration />
           <Scripts />
         </body>
       </html>
     );
   }
   ```

3. `apps/web/app/layouts/auth.tsx` — layout for unauthenticated routes:
   ```tsx
   import { Outlet } from "react-router";

   export default function AuthLayout() {
     return <Outlet />;
   }
   ```

4. `apps/web/app/layouts/authenticated.tsx` — wraps all protected routes with `AuthGuard` + app shell:
   ```tsx
   import { observer } from "mobx-react-lite";
   import { Outlet } from "react-router";
   import { AuthGuard } from "~/core/components/auth/auth-guard";
   import { AppSidebar } from "~/core/components/layout/app-sidebar";
   import { OrgHeader } from "~/core/components/layout/org-header";

   const AuthenticatedLayout = observer(() => {
     return (
       <AuthGuard>
         <div className="flex h-screen overflow-hidden">
           <AppSidebar />
           <div className="flex-1 flex flex-col overflow-hidden">
             <OrgHeader />
             <main className="flex-1 overflow-y-auto">
               <Outlet />
             </main>
           </div>
         </div>
       </AuthGuard>
     );
   });

   export default AuthenticatedLayout;
   ```

5. `apps/web/app/routes/auth/sign-in.tsx`:
   ```tsx
   import { AuthLayout } from "~/core/components/auth/auth-layout";
   import { SignInForm } from "~/core/components/auth/sign-in-form";

   export default function SignInPage() {
     return (
       <AuthLayout title="Sign in to Cybernetic">
         <SignInForm />
       </AuthLayout>
     );
   }
   ```

6. `apps/web/app/routes/home.tsx` — dashboard stub:
   ```tsx
   import { PageContainer } from "~/core/components/layout/page-container";

   export default function DashboardPage() {
     return (
       <PageContainer title="Dashboard">
         <p className="text-gray-500">OKR health overview coming soon.</p>
       </PageContainer>
     );
   }
   ```

7. **Update `apps/web/app/routes.ts`** — full route config:
   ```ts
   import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

   export default [
     layout("layouts/auth.tsx", [
       route("auth/sign-in", "routes/auth/sign-in.tsx"),
     ]),
     layout("layouts/authenticated.tsx", [
       index("routes/home.tsx"),
     ]),
   ] satisfies RouteConfig;
   ```

8. Commit message: `feat(frontend): Phase 1 foundation — monorepo scaffold, auth, app shell`

### Verification

`cd apps/web && pnpm exec tsc --noEmit` passes. The full route tree renders and the sign-in form is reachable.

---

## Summary

| Task | Scope | Estimated files |
|------|-------|----------------|
| 1 | Monorepo root + stub packages | 11 |
| 2 | apps/web project scaffold | 9 |
| 3 | MobX store layer | 5 |
| 4 | Service layer | 2 |
| 5 | Auth components | 4 |
| 6 | App shell layout | 4 |
| 7 | Route wiring + dashboard stub | 7 |
