import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { IDepartment } from "@cybernetic/types";
import { useStore } from "~/core/hooks/use-store";
import { EmptyState } from "~/core/components/common/empty-state";
import { LoadingSpinner } from "~/core/components/common/loading-spinner";

interface DeptNodeProps {
  dept: IDepartment;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  depth: number;
}

const DeptNode = observer(function DeptNode({ dept, expandedIds, onToggle, depth }: DeptNodeProps) {
  const { department } = useStore();
  const isExpanded = expandedIds.has(dept.id);
  const childIds = department.childMap[dept.id];
  const hasChildren = childIds === undefined || childIds.length > 0;

  const children = childIds
    ?.map((id) => department.deptMap[id])
    .filter((d): d is IDepartment => Boolean(d));

  return (
    <li>
      <div
        className="flex items-start gap-2 py-2 px-3 rounded hover:bg-gray-50 transition-colors"
        style={{ paddingLeft: `${(depth + 1) * 12}px` }}
      >
        <button
          onClick={() => onToggle(dept.id)}
          className={`mt-0.5 flex-shrink-0 transition-colors ${hasChildren ? "text-gray-400 hover:text-gray-600" : "text-gray-200 cursor-default"}`}
          aria-label={isExpanded ? "Collapse" : "Expand"}
          disabled={!hasChildren}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <div>
          <p className="text-sm font-medium text-gray-900">{dept.name}</p>
          {dept.description && (
            <p className="text-xs text-gray-500 mt-0.5">{dept.description}</p>
          )}
        </div>
      </div>

      {isExpanded && children && children.length > 0 && (
        <ul className="space-y-0.5">
          {children.map((child) => (
            <DeptNode
              key={child.id}
              dept={child}
              expandedIds={expandedIds}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
});

export const DepartmentTree = observer(function DepartmentTree() {
  const { department } = useStore();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    department.fetchRoots();
  }, []);

  function toggle(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!department.childMap[id]) {
          department.fetchChildren(id);
        }
      }
      return next;
    });
  }

  if (department.isLoading && !department.rootDepts.length) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!department.isLoading && !department.rootDepts.length) {
    return (
      <EmptyState
        title="No departments found"
        description="No departments have been created yet."
      />
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2">
      <ul className="space-y-0.5">
        {department.rootDepts.map((dept) => (
          <DeptNode
            key={dept.id}
            dept={dept}
            expandedIds={expandedIds}
            onToggle={toggle}
            depth={0}
          />
        ))}
      </ul>
    </div>
  );
});
