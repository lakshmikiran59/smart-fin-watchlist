import { Activity, WifiOff, Wifi } from 'lucide-react';
import { SocketStatus } from '../hooks/useMarketSocket';

export function HealthIndicator({ status, latencyMs }: { status: SocketStatus; latencyMs: number | null }) {
  const isOpen = status === 'open';
  const latencyLabel = latencyMs === null ? '—' : `${latencyMs}ms`;
  const latencyColor =
    latencyMs === null ? 'text-slate-400' : latencyMs < 150 ? 'text-emerald-400' : latencyMs < 500 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs">
      {isOpen ? <Wifi size={14} className="text-emerald-400" /> : <WifiOff size={14} className="text-red-400" />}
      <span className={isOpen ? 'text-emerald-400' : 'text-red-400'}>
        {isOpen ? 'Live Stream Connected' : status === 'connecting' ? 'Connecting…' : 'Disconnected'}
      </span>
      <span className="flex items-center gap-1 text-slate-500">
        <Activity size={12} />
        Latency: <span className={latencyColor}>{latencyLabel}</span>
      </span>
    </div>
  );
}
