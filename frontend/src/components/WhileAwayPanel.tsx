import { TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { WhileAwayDelta } from '../types';
import { formatINR } from '../utils/currency';

function formatDuration(ms: number): string {
  if (ms <= 0) return 'market open';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function WhileAwayBadge({ delta }: { delta: WhileAwayDelta | undefined }) {
  if (!delta) return null;
  const isUp = delta.deltaAbs >= 0;
  const label =
    delta.basisLabel === 'last_session'
      ? `Since you left (${formatDuration(delta.sinceMs)})`
      : 'Since market open';

  if (Math.abs(delta.deltaPct) < 0.01) {
    return (
      <div className="mt-2 flex items-center gap-1 rounded-md bg-slate-800/60 px-2 py-1 text-[11px] text-slate-400">
        <Clock size={11} /> No meaningful change {label.toLowerCase()}
      </div>
    );
  }

  return (
    <div
      className={`mt-2 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${
        isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
      }`}
    >
      {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {label}: {isUp ? '+' : ''}
      {formatINR(delta.deltaAbs)} ({isUp ? '+' : ''}
      {delta.deltaPct.toFixed(2)}%)
    </div>
  );
}
