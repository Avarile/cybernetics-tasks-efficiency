import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "~/core/hooks/use-store";
import { usePermissions } from "~/core/hooks/use-permissions";
import { EmptyState } from "~/core/components/common/empty-state";
import { LoadingSpinner } from "~/core/components/common/loading-spinner";

export const LabelList = observer(function LabelList() {
  const { label } = useStore();
  const { can } = usePermissions();

  useEffect(() => {
    label.fetchLabels();
  }, []);

  if (label.isLoading && !label.labels.length) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!label.isLoading && label.labels.length === 0) {
    return (
      <EmptyState
        title="No labels"
        description="Labels help organize your work"
      />
    );
  }

  return (
    <div className="space-y-4">
      {can("manager") && (
        <div className="flex justify-end">
          <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            Add label
          </button>
        </div>
      )}

      <ul className="space-y-px border border-gray-200 rounded-lg divide-y divide-gray-200">
        {label.labels.map((lbl) => (
          <li key={lbl.id} className="px-4 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start gap-3">
              <div
                style={{ backgroundColor: lbl.color }}
                className="h-4 w-4 rounded-full flex-shrink-0 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{lbl.name}</p>
                {lbl.description && (
                  <p className="text-sm text-gray-500 mt-1">{lbl.description}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
});
