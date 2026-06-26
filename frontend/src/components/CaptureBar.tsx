import { useState } from 'react';
import {
  useStartInitiative,
  usePauseInitiative,
  useResumeInitiative,
  useBlockInitiative,
  useCompleteInitiative,
  useLogTime,
  useRecordOutcome,
} from '../lib/queries';

interface CaptureBarProps {
  slug: string;
  status?: string;
}

export function CaptureBar({ slug, status }: CaptureBarProps) {
  const [showLogTime, setShowLogTime] = useState(false);
  const [minutes, setMinutes] = useState('');
  const [showOutcome, setShowOutcome] = useState(false);
  const [outcome, setOutcome] = useState('');

  const start = useStartInitiative();
  const pause = usePauseInitiative();
  const resume = useResumeInitiative();
  const block = useBlockInitiative();
  const complete = useCompleteInitiative();
  const logTime = useLogTime();
  const recordOutcome = useRecordOutcome();

  const isActive = status === 'in_progress';
  const isPaused = status === 'paused';
  const isBlocked = status === 'blocked';
  const isDone = status === 'completed' || status === 'cancelled';

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      {/* Primary lifecycle actions */}
      {!isActive && !isDone && !isPaused && !isBlocked && (
        <button
          onClick={() => start.mutate({ slug })}
          disabled={start.isPending}
          className="px-3 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
        >
          Start
        </button>
      )}
      {isActive && (
        <button
          onClick={() => pause.mutate({ slug })}
          disabled={pause.isPending}
          className="px-3 py-1 text-xs font-medium rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
        >
          Pause
        </button>
      )}
      {isPaused && (
        <button
          onClick={() => resume.mutate({ slug })}
          disabled={resume.isPending}
          className="px-3 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Resume
        </button>
      )}
      {(isActive || isPaused) && (
        <button
          onClick={() => block.mutate({ slug })}
          disabled={block.isPending}
          className="px-3 py-1 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
        >
          Block
        </button>
      )}
      {!isDone && (
        <button
          onClick={() => complete.mutate({ slug })}
          disabled={complete.isPending}
          className="px-3 py-1 text-xs font-medium rounded bg-gray-700 text-white hover:bg-gray-900 disabled:opacity-50"
        >
          Complete
        </button>
      )}

      {/* Log time inline */}
      {!isDone && (
        <>
          <button
            onClick={() => setShowLogTime((v) => !v)}
            className="px-3 py-1 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Log time
          </button>
          {showLogTime && (
            <span className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="min"
                className="w-16 border border-gray-300 rounded px-1 py-0.5 text-xs"
              />
              <button
                onClick={() => {
                  const m = parseInt(minutes, 10);
                  if (m > 0) {
                    logTime.mutate({ slug, minutes: m });
                    setMinutes('');
                    setShowLogTime(false);
                  }
                }}
                disabled={logTime.isPending}
                className="px-2 py-0.5 text-xs rounded bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50"
              >
                Save
              </button>
            </span>
          )}
        </>
      )}

      {/* Record outcome */}
      {!isDone && (
        <>
          <button
            onClick={() => setShowOutcome((v) => !v)}
            className="px-3 py-1 text-xs font-medium rounded bg-purple-600 text-white hover:bg-purple-700"
          >
            Outcome
          </button>
          {showOutcome && (
            <span className="flex items-center gap-1">
              <input
                type="text"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="result…"
                className="w-32 border border-gray-300 rounded px-1 py-0.5 text-xs"
              />
              <button
                onClick={() => {
                  if (outcome.trim()) {
                    recordOutcome.mutate({ slug, result: outcome.trim() });
                    setOutcome('');
                    setShowOutcome(false);
                  }
                }}
                disabled={recordOutcome.isPending}
                className="px-2 py-0.5 text-xs rounded bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50"
              >
                Save
              </button>
            </span>
          )}
        </>
      )}
    </div>
  );
}
