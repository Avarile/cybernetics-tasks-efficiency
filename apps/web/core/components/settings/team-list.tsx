import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useStore } from "~/core/hooks/use-store";
import { EmptyState } from "~/core/components/common/empty-state";
import { LoadingSpinner } from "~/core/components/common/loading-spinner";

export const TeamList = observer(function TeamList() {
  const { team } = useStore();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    team.fetchTeams();
  }, []);

  function toggle(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!team.memberMap[id]) {
          team.fetchMembers(id);
        }
      }
      return next;
    });
  }

  if (team.isLoading && !team.teams.length) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!team.isLoading && !team.teams.length) {
    return (
      <EmptyState
        title="No teams found"
        description="No teams have been created yet."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8" />
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Members</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {team.teams.map((t) => {
            const isExpanded = expandedIds.has(t.id);
            const members = team.memberMap[t.id];
            const memberCount = members?.length ?? "—";

            return (
              <>
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(t.id)}
                      className="text-gray-400 hover:text-gray-600"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{t.departmentId ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{memberCount}</td>
                </tr>
                {isExpanded && (
                  <tr key={`${t.id}-members`} className="bg-gray-50">
                    <td />
                    <td colSpan={3} className="px-4 py-3">
                      {!members ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <LoadingSpinner size="sm" />
                          <span>Loading members…</span>
                        </div>
                      ) : members.length === 0 ? (
                        <p className="text-sm text-gray-500">No members.</p>
                      ) : (
                        <ul className="flex flex-wrap gap-2">
                          {members.map((m) => (
                            <li key={m.id} className="text-sm text-gray-700 bg-white border border-gray-200 rounded px-2 py-0.5">
                              {m.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
