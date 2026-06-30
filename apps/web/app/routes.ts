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
