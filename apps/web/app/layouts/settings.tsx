import { NavLink, Outlet, useParams } from "react-router";

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
