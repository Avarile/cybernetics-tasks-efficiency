export type PaceStatus = 'behind' | 'on_track' | 'ahead';

interface KrProgressBarProps {
  progressPct: number; // 0-1
  paceStatus: PaceStatus;
}

const paceColorClass: Record<PaceStatus, string> = {
  behind: 'bg-red-500',
  on_track: 'bg-amber-400',
  ahead: 'bg-green-500',
};

export function KrProgressBar({ progressPct, paceStatus }: KrProgressBarProps) {
  const pct = Math.min(Math.max(progressPct * 100, 0), 100);
  const colorClass = paceColorClass[paceStatus] ?? 'bg-gray-400';

  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div
        data-testid="kr-bar"
        className={`h-2 rounded-full transition-all ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
