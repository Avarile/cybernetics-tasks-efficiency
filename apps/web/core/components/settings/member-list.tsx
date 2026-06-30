import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import type { UserRole } from "@cybernetic/types";
import { useStore } from "~/core/hooks/use-store";
import { PersonAvatar } from "~/core/components/common/person-avatar";
import { StatusBadge } from "~/core/components/common/status-badge";
import { EmptyState } from "~/core/components/common/empty-state";
import { SearchInput } from "~/core/components/common/search-input";
import { LoadingSpinner } from "~/core/components/common/loading-spinner";

const ROLE_VARIANT: Record<UserRole, "danger" | "info" | "warning" | "default"> = {
  admin: "danger",
  manager: "info",
  executive: "warning",
  member: "default",
};

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  executive: "Executive",
  member: "Member",
};

export const MemberList = observer(function MemberList() {
  const { person } = useStore();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    person.fetchPersons();
  }, []);

  const filtered = person.persons.filter((p) => {
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
  });

  if (person.isLoading && !person.persons.length) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SearchInput
        placeholder="Search members..."
        onSearch={setSearchQuery}
      />

      {!person.isLoading && filtered.length === 0 ? (
        <EmptyState
          title="No members found"
          description={searchQuery ? "Try a different search term." : "No members have been added yet."}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <PersonAvatar email={p.email} avatarUrl={p.avatarUrl ?? undefined} size="sm" />
                      <span className="text-sm font-medium text-gray-900">
                        {p.firstName} {p.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={ROLE_LABEL[p.role]} variant={ROLE_VARIANT[p.role]} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.position ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
