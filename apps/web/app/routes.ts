import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  layout("layouts/auth.tsx", [
    route("auth/sign-in", "routes/auth/sign-in.tsx"),
  ]),
  layout("layouts/authenticated.tsx", [
    index("routes/home.tsx"),
  ]),
] satisfies RouteConfig;
