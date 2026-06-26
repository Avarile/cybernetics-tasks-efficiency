import { Link } from 'react-router-dom';
import { useMyInitiatives } from '../lib/queries';
import { CaptureBar } from '../components/CaptureBar';

const statusLabel: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  paused: 'Paused',
  blocked: 'Blocked',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const statusColor: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  paused: 'bg-amber-100 text-amber-700',
  blocked: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500 line-through',
};

export function MyWork() {
  const { data, isLoading, error } = useMyInitiatives();

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">My Work</h1>
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">My Work</h1>
        <p className="text-red-600 text-sm">{(error as Error).message}</p>
      </div>
    );
  }

  const initiatives = data?.items ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">My Work</h1>

      {initiatives.length === 0 ? (
        <p className="text-gray-400 text-sm">No initiatives assigned to you yet.</p>
      ) : (
        <div className="space-y-4">
          {initiatives.map((ini) => {
            const s = ini.status ?? 'not_started';
            return (
              <div
                key={ini.id}
                className="bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-medium text-gray-800">{ini.title}</h2>
                    <span
                      className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusColor[s] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {statusLabel[s] ?? s}
                    </span>
                  </div>
                  <Link
                    to={`/initiatives/${ini.slug}/timeline`}
                    className="text-xs text-indigo-600 hover:underline shrink-0"
                  >
                    Timeline
                  </Link>
                </div>

                <CaptureBar slug={ini.slug} status={ini.status} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
