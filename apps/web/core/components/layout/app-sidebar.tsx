import { useState } from "react";
import { NavLink, useParams } from "react-router";
import { observer } from "mobx-react-lite";
import {
  BookOpen,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Rocket,
  Target,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", path: "dashboard", icon: LayoutDashboard },
  { label: "Objectives", path: "objectives", icon: Target },
  { label: "Initiatives", path: "initiatives", icon: Rocket },
  { label: "Tasks", path: "tasks", icon: CheckSquare },
  { label: "Knowledge", path: "knowledge", icon: BookOpen },
];

export const AppSidebar = observer(function AppSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const slug = orgSlug ?? "";

  return (
    <aside
      className={`flex flex-col h-full bg-gray-900 text-white transition-all duration-200 ${
        isCollapsed ? "w-14" : "w-56"
      }`}
    >
      <nav className="flex-1 px-2 py-4 space-y-1">
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={slug ? `/${slug}/${path}` : `/${path}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="px-2 pb-4">
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="flex items-center justify-center w-full px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>
    </aside>
  );
});
