import { Sparkles } from 'lucide-react';

export function EmptyState({ onAddTrending }: { onAddTrending: (symbol: string) => void }) {
  const trending = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY'];
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 py-16 text-center">
      <Sparkles className="text-indigo-400" size={28} />
      <h3 className="mt-3 text-sm font-semibold text-slate-200">This watchlist is empty</h3>
      <p className="mt-1 max-w-sm text-xs text-slate-500">
        Add a ticker to start tracking live prices, volatility spikes, and custom price triggers.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {trending.map((s) => (
          <button
            key={s}
            onClick={() => onAddTrending(s)}
            className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-indigo-600 hover:text-white"
          >
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}
