import { useParams, Link } from 'react-router-dom';
import { useInitiativeTimeline, ActivityEvent } from '../lib/queries';

const eventIcon: Record<string, string> = {
  created: '✦',
  started: '▶',
  paused: '⏸',
  resumed: '↺',
  blocked: '✖',
  unblocked: '✔',
  cancelled: '⊘',
  completed: '★',
  time_logged: '⏱',
  reason_recorded: '📝',
  outcome_recorded: '🏁',
  note_added: '💬',
  key_result_measured: '📊',
};

const eventLabel: Record<string, string> = {
  created: 'Created',
  started: 'Started',
  paused: 'Paused',
  resumed: 'Resumed',
  blocked: 'Blocked',
  unblocked: 'Unblocked',
  cancelled: 'Cancelled',
  completed: 'Completed',
  time_logged: 'Time logged',
  reason_recorded: 'Reason recorded',
  outcome_recorded: 'Outcome recorded',
  note_added: 'Note added',
  key_result_measured: 'KR measured',
};

function payloadSummary(event: ActivityEvent): string {
  const p = event.payload;
  if (!p || Object.keys(p).length === 0) return '';
  if (typeof p.minutes === 'number') return `${p.minutes} min`;
  if (typeof p.result === 'string') return p.result;
  if (typeof p.reason === 'string') return p.reason;
  if (typeof p.value === 'number') return `value: ${p.value}`;
  return JSON.stringify(p).slice(0, 80);
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function InitiativeTimeline() {
  const { slug } = useParams<{ slug: string }>();
  const { data: events, isLoading, error } = useInitiativeTimeline(slug ?? '');

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/my-work" className="text-indigo-600 hover:underline text-sm">
          ← My Work
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Initiative Timeline</h1>
        {slug && <span className="text-gray-400 text-sm font-mono">{slug}</span>}
      </div>

      {isLoading && <p className="text-gray-500 text-sm">Loading timeline…</p>}
      {error && <p className="text-red-600 text-sm">{(error as Error).message}</p>}

      {events && events.length === 0 && (
        <p className="text-gray-400 text-sm">No events recorded yet.</p>
      )}

      {events && events.length > 0 && (
        <ol className="relative border-l-2 border-gray-200 ml-4 space-y-6">
          {events.map((event) => {
            const icon = eventIcon[event.type] ?? '•';
            const label = eventLabel[event.type] ?? event.type;
            const summary = payloadSummary(event);

            return (
              <li key={event.id} className="ml-6">
                {/* dot */}
                <span className="absolute -left-3 flex items-center justify-center w-6 h-6 bg-white border-2 border-gray-300 rounded-full text-xs">
                  {icon}
                </span>

                <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-800 text-sm">{label}</span>
                    <time className="text-xs text-gray-400">
                      {formatTime(event.occurredAt)}
                    </time>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      Person #{event.actorPersonId}
                    </span>
                    {summary && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-600">{summary}</span>
                      </>
                    )}
                    {event.source !== 'human' && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-indigo-500 italic">{event.source}</span>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
